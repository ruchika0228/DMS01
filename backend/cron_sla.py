import time
from datetime import datetime
from sqlalchemy.orm import Session
from database import SessionLocal
from models.workflow import Document, ApprovalStage, AuditLog, Notification, WorkflowStatus, StageStatus
from models.user import User

def process_escalations():
    db: Session = SessionLocal()
    try:
        # Fetch all Pending stages that are overdue
        now = datetime.utcnow()
        overdue_stages = db.query(ApprovalStage).filter(
            ApprovalStage.status == StageStatus.PENDING,
            ApprovalStage.due_date < now
        ).all()

        for stage in overdue_stages:
            print(f"Escalating Stage {stage.stage_number} of Document {stage.document_id} (Assigned to: {stage.user_id})")
            
            # 1. Mark current stage as Skipped
            stage.status = StageStatus.SKIPPED
            stage.action_at = now
            stage.remarks = "Skipped due to SLA breach"

            doc = stage.document

            # 2. Audit Log for escalation
            audit = AuditLog(
                document_id=doc.id,
                user_id=None, # System action
                action="Escalated",
                details=f"Stage {stage.stage_number} (User: {stage.user_id}) skipped due to SLA breach."
            )
            db.add(audit)

            # 3. Notify the user who missed the SLA
            missed_notif = Notification(
                user_id=stage.user_id,
                title="SLA Breach / Stage Skipped",
                message=f"Your approval for document '{doc.title}' at Stage {stage.stage_number} was skipped due to an SLA breach.",
                document_id=doc.id
            )
            db.add(missed_notif)

            # 4. Move to next stage or auto-approve
            next_stage = db.query(ApprovalStage).filter(
                ApprovalStage.document_id == doc.id,
                ApprovalStage.stage_number == stage.stage_number + 1
            ).first()

            if next_stage:
                next_stage.status = StageStatus.PENDING
                next_stage.assigned_at = now
                # Notify next user
                next_notif = Notification(
                    user_id=next_stage.user_id,
                    title="Escalated Document Assignment",
                    message=f"A document '{doc.title}' has been escalated to you at Stage {next_stage.stage_number}.",
                    document_id=doc.id
                )
                db.add(next_notif)
            else:
                # Last stage skipped
                doc.status = WorkflowStatus.APPROVED
                # Notify creator
                creator_notif = Notification(
                    user_id=doc.creator_id,
                    title="Document Auto-Approved",
                    message=f"Your document '{doc.title}' was auto-approved after the final stage missed its SLA.",
                    document_id=doc.id
                )
                db.add(creator_notif)

            db.commit()

    except Exception as e:
        print(f"Error in escalation engine: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    print("SLA Escalation Engine started...")
    while True:
        process_escalations()
        # Sleep for 5 minutes (300 seconds)
        time.sleep(300)
