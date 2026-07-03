from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_
from typing import List
from datetime import datetime, timedelta
from database import get_db
from models.user import User, Department, Position
from models.workflow import Document, ApprovalStage, AuditLog, Notification, WorkflowStatus, StageStatus
from models.file import File
from schemas import (
    DocumentCreate, DocumentResponse, ApprovalAction, ApprovalStageResponse, NotificationResponse, UserResponse,
    DepartmentResponse, PositionResponse
)
from routers.auth import get_current_user
from email_utils import send_email_async

router = APIRouter(
    prefix="/workflow",
    tags=["workflow"]
)

@router.get("/approvers/{stage_number}", response_model=List[UserResponse])
def get_approvers_by_stage(
    stage_number: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns a list of users who are assigned to a specific approval stage,
    OR users who have no stage assigned yet (making them available for any stage).
    """
    return db.query(User).filter(
        or_(User.approval_stage == stage_number, User.approval_stage == None),
        User.is_active == True
    ).all()


@router.get("/departments", response_model=List[DepartmentResponse])
def get_workflow_departments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(Department).filter(Department.status == True).all()


@router.get("/positions", response_model=List[PositionResponse])
def get_workflow_positions(
    department_id: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Position).filter(Position.status == True)
    if department_id:
        query = query.filter(Position.department_id == department_id)
    return query.all()


@router.get("/users-filter", response_model=List[UserResponse])
def get_workflow_users_filter(
    department_id: str = None,
    position_id: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # FILTER: Creator cannot be an approver
    query = db.query(User).filter(User.is_active == True, User.id != current_user.id)
    if department_id:
        query = query.filter(User.department_id == department_id)
    if position_id:
        query = query.filter(User.position_id == position_id)
    return query.all()

@router.post("/documents", response_model=DocumentResponse)
def create_document(
    doc_in: DocumentCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Validation
    if len(doc_in.stages) < 1 or len(doc_in.stages) > 6:
        raise HTTPException(status_code=400, detail="Document must have between 1 and 6 approval stages")
    
    # Check if file exists and current user owns it
    file = db.query(File).filter(File.id == doc_in.file_id).first()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    if file.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not own this file")

    # Creator cannot assign themselves as approver
    for stage in doc_in.stages:
        if stage.user_id == current_user.id:
            raise HTTPException(status_code=400, detail="Creator cannot be an approver in any stage")
        
        # Smart Validation/Correction:
        # If user has no stage, assign them to this stage permanently.
        # If user has a stage, it MUST match the current stage to maintain isolation.
        approver = db.query(User).filter(User.id == stage.user_id).first()
        if not approver:
            raise HTTPException(status_code=404, detail=f"User {stage.user_id} not found")
        
        if approver.approval_stage is None:
            # Auto-correction: Assign the user to this stage for the first time
            approver.approval_stage = stage.stage_number
            db.add(approver)
            print(f"Auto-assigned {approver.username} to Stage {stage.stage_number}")
        elif approver.approval_stage != stage.stage_number:
            # Enforcement: Prevent cross-stage assignment
            raise HTTPException(
                status_code=400, 
                detail=f"User {approver.username} is already permanently assigned to Stage {approver.approval_stage}. They cannot be used for Stage {stage.stage_number}."
            )

    # Create Document
    db_doc = Document(
        title=doc_in.title,
        description=doc_in.description,
        file_id=doc_in.file_id,
        creator_id=current_user.id,
        status=WorkflowStatus.IN_PROGRESS
    )
    db.add(db_doc)
    db.flush() # Get ID

    # Create Stages
    for i, stage_in in enumerate(doc_in.stages):
        status = StageStatus.QUEUED
        assigned_at = None
        if i == 0:
            status = StageStatus.PENDING
            assigned_at = datetime.utcnow()
        
        # Default due_date if not provided (e.g., 48 hours)
        due_date = stage_in.due_date
        if not due_date:
            due_date = datetime.utcnow() + timedelta(hours=48)

        db_stage = ApprovalStage(
            document_id=db_doc.id,
            stage_number=stage_in.stage_number,
            stage_name=stage_in.stage_name,
            user_id=stage_in.user_id,
            status=status,
            assigned_at=assigned_at,
            due_date=due_date
        )
        db.add(db_stage)
        
        if i == 0:
            # Notify first stage user
            notification = Notification(
                user_id=stage_in.user_id,
                title="New Document Approval Request",
                message=f"You have been assigned to Stage 1 of document: {db_doc.title}",
                document_id=db_doc.id
            )
            db.add(notification)

            # Email Notification for Stage 1
            approver_user = db.query(User).filter(User.id == stage_in.user_id).first()
            if approver_user and approver_user.email:
                email_subject = f"[DMS] Action Required: Approval Request for {db_doc.title}"
                
                approver_name = approver_user.full_name if approver_user.full_name else approver_user.username
                creator_name = current_user.full_name if current_user.full_name else current_user.username
                due_date_str = stage_in.due_date if stage_in.due_date else 'Not Specified'

                email_body = (
                    f"Dear {approver_name},\n\n"
                    f"A new document workflow has been initiated that requires your formal review and approval.\n\n"
                    f"--- Workflow Information ---\n"
                    f"Document: {db_doc.title}\n"
                    f"Initiator: {creator_name}\n"
                    f"Assignment: Stage 1 - {stage_in.stage_name}\n"
                    f"SLA Due Date: {due_date_str}\n\n"
                    f"Instructions:\n"
                    f"1. Log in to the DMS Portal.\n"
                    f"2. Navigate to 'Pending Approvals'.\n"
                    f"3. Review the associated document and metadata.\n"
                    f"4. Select 'Approve' or 'Reject' with relevant comments.\n\n"
                    f"Your timely response ensures the continuity of this business process.\n\n"
                    f"Regards,\n"
                    f"G-DMAS Workflow Engine"
                )
                background_tasks.add_task(send_email_async, approver_user.email, email_subject, email_body)

    # Audit Log
    audit = AuditLog(
        document_id=db_doc.id,
        user_id=current_user.id,
        action="Created",
        details=f"Document created with {len(doc_in.stages)} stages"
    )
    db.add(audit)

    # ADMIN NOTIFICATION: New document created
    admins = db.query(User).filter(User.is_admin == True).all()
    for admin_user in admins:
        if admin_user.id != current_user.id:
            admin_notif = Notification(
                user_id=admin_user.id,
                title="New Document Created",
                message=f"User {current_user.username} created a new document: {db_doc.title}",
                document_id=db_doc.id
            )
            db.add(admin_notif)

    db.commit()
    db.refresh(db_doc)
    return db_doc

@router.get("/my-documents", response_model=List[DocumentResponse])
def get_my_documents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(Document).options(
        joinedload(Document.file),
        joinedload(Document.creator),
        joinedload(Document.stages).joinedload(ApprovalStage.user)
    ).filter(Document.creator_id == current_user.id).all()

@router.get("/pending-approvals", response_model=List[ApprovalStageResponse])
def get_pending_approvals(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(ApprovalStage).options(
        joinedload(ApprovalStage.document).joinedload(Document.file),
        joinedload(ApprovalStage.document).joinedload(Document.creator)
    ).filter(
        ApprovalStage.user_id == current_user.id,
        ApprovalStage.status == StageStatus.PENDING
    ).all()

@router.post("/stages/{stage_id}/action", response_model=ApprovalStageResponse)
def take_stage_action(
    stage_id: str,
    action: ApprovalAction,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stage = db.query(ApprovalStage).filter(ApprovalStage.id == stage_id).first()
    if not stage:
        raise HTTPException(status_code=404, detail="Stage not found")
    
    if stage.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You are not assigned to this stage")
    
    if stage.status != StageStatus.PENDING:
        raise HTTPException(status_code=400, detail="This stage is not pending action")

    stage.status = StageStatus.APPROVED if action.status == "Approved" else StageStatus.REJECTED
    stage.action_at = datetime.utcnow()
    stage.remarks = action.remarks

    doc = stage.document
    admins = db.query(User).filter(User.is_admin == True).all()

    if action.status == "Rejected":
        doc.status = WorkflowStatus.REJECTED
        # Notify creator
        notification = Notification(
            user_id=doc.creator_id,
            title="Document Rejected",
            message=f"Your document '{doc.title}' was rejected at Stage {stage.stage_number} by {current_user.username}",
            document_id=doc.id
        )
        db.add(notification)

        # Email Notification for Rejection
        creator = db.query(User).filter(User.id == doc.creator_id).first()
        if creator and creator.email:
            email_subject = f"[DMS] Update: Document Rejected - {doc.title}"
            
            creator_name = creator.full_name if creator.full_name else creator.username
            reviewer_name = current_user.full_name if current_user.full_name else current_user.username
            remarks = action.remarks if action.remarks else "No comments provided."

            email_body = (
                f"Dear {creator_name},\n\n"
                f"This is to inform you that your document '{doc.title}' has been reviewed and was not approved at the current stage.\n\n"
                f"--- Rejection Details ---\n"
                f"Rejected at: Stage {stage.stage_number} ({stage.stage_name})\n"
                f"Reviewed by: {reviewer_name}\n"
                f"Reason/Remarks: {remarks}\n\n"
                f"Please review the feedback and make the necessary adjustments to the document before re-initiating the workflow.\n\n"
                f"Regards,\n"
                f"G-DMAS Notification Service"
            )
            background_tasks.add_task(send_email_async, creator.email, email_subject, email_body)

        # ADMIN NOTIFICATION: Document Rejected
        for admin_user in admins:
            if admin_user.id != current_user.id:
                admin_notif = Notification(
                    user_id=admin_user.id,
                    title="Document Rejected",
                    message=f"Document '{doc.title}' was rejected at Stage {stage.stage_number} by {current_user.username}",
                    document_id=doc.id
                )
                db.add(admin_notif)

        # PREVIOUS APPROVERS NOTIFICATION: Document Rejected
        prev_stages = db.query(ApprovalStage).filter(
            ApprovalStage.document_id == doc.id,
            ApprovalStage.stage_number < stage.stage_number
        ).all()
        for prev_stage in prev_stages:
            if prev_stage.user_id != current_user.id:
                prev_notif = Notification(
                    user_id=prev_stage.user_id,
                    title="Document Rejected (Previously Approved)",
                    message=f"A document you approved ('{doc.title}') was rejected at Stage {stage.stage_number} by {current_user.username}",
                    document_id=doc.id
                )
                db.add(prev_notif)
    else:
        # Move to next stage if exists
        next_stage = db.query(ApprovalStage).filter(
            ApprovalStage.document_id == doc.id,
            ApprovalStage.stage_number == stage.stage_number + 1
        ).first()

        # ADMIN NOTIFICATION: Document Approved (at this stage)
        for admin_user in admins:
            if admin_user.id != current_user.id:
                admin_notif = Notification(
                    user_id=admin_user.id,
                    title="Document Approved Stage",
                    message=f"Document '{doc.title}' was approved at Stage {stage.stage_number} by {current_user.username}",
                    document_id=doc.id
                )
                db.add(admin_notif)

        if next_stage:
            next_stage.status = StageStatus.PENDING
            next_stage.assigned_at = datetime.utcnow()
            # Notify next user
            notification = Notification(
                user_id=next_stage.user_id,
                title="New Document Approval Request",
                message=f"You have been assigned to Stage {next_stage.stage_number} of document: {doc.title}",
                document_id=doc.id
            )
            db.add(notification)

            # Email Notification for Next Stage
            next_approver = db.query(User).filter(User.id == next_stage.user_id).first()
            if next_approver and next_approver.email:
                email_subject = f"[DMS] Action Required: Approval Request for {doc.title}"
                
                approver_name = next_approver.full_name if next_approver.full_name else next_approver.username
                prev_reviewer = current_user.full_name if current_user.full_name else current_user.username
                due_date_str = next_stage.due_date.strftime('%Y-%m-%d %H:%M') if next_stage.due_date else 'Not Specified'

                email_body = (
                    f"Dear {approver_name},\n\n"
                    f"A document workflow has progressed to a stage that requires your formal review and approval.\n\n"
                    f"--- Workflow Information ---\n"
                    f"Document: {doc.title}\n"
                    f"Current Assignment: Stage {next_stage.stage_number} - {next_stage.stage_name}\n"
                    f"Previously Approved By: {prev_reviewer}\n"
                    f"SLA Due Date: {due_date_str}\n\n"
                    f"Instructions:\n"
                    f"1. Log in to the DMS Portal.\n"
                    f"2. Navigate to 'Pending Approvals'.\n"
                    f"3. Review the document history and associated metadata.\n"
                    f"4. Select 'Approve' or 'Reject' to conclude this stage.\n\n"
                    f"Regards,\n"
                    f"G-DMAS Workflow Engine"
                )
                background_tasks.add_task(send_email_async, next_approver.email, email_subject, email_body)
        else:
            # Final Authority Approved
            doc.status = WorkflowStatus.APPROVED
            # Notify creator
            notification = Notification(
                user_id=doc.creator_id,
                title="Document Fully Approved",
                message=f"Your document '{doc.title}' has been fully approved.",
                document_id=doc.id
            )
            db.add(notification)

            # Email Notification for Full Approval
            creator = db.query(User).filter(User.id == doc.creator_id).first()
            if creator and creator.email:
                email_subject = f"[DMS] Confirmation: Document Fully Approved - {doc.title}"
                
                creator_name = creator.full_name if creator.full_name else creator.username
                final_approver = current_user.full_name if current_user.full_name else current_user.username
                timestamp_str = datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')

                email_body = (
                    f"Dear {creator_name},\n\n"
                    f"Congratulations. Your document submission has completed the full multi-stage approval cycle and is now officially approved.\n\n"
                    f"--- Approval Finalization ---\n"
                    f"Document: {doc.title}\n"
                    f"Status: COMPLETED / APPROVED\n"
                    f"Final Authority: {final_approver}\n"
                    f"Timestamp: {timestamp_str}\n\n"
                    f"The document is now stored in the permanent archive and its provenance has been securely recorded on the blockchain ledger.\n\n"
                    f"Regards,\n"
                    f"Document Management System Team"
                )
                background_tasks.add_task(send_email_async, creator.email, email_subject, email_body)

    # Audit Log
    audit = AuditLog(
        document_id=doc.id,
        user_id=current_user.id,
        action=action.status,
        details=f"Stage {stage.stage_number} {action.status.lower()} with remarks: {action.remarks}"
    )
    db.add(audit)

    db.commit()
    db.refresh(stage)
    return stage

@router.get("/notifications", response_model=List[NotificationResponse])
def get_my_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(Notification).filter(Notification.user_id == current_user.id).order_by(Notification.created_at.desc()).all()

@router.put("/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    notif = db.query(Notification).filter(Notification.id == notification_id, Notification.user_id == current_user.id).first()
    if notif:
        notif.is_read = True
        db.commit()
    return {"status": "success"}
