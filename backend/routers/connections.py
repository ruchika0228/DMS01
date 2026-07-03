from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from database import get_db
from models.user import User
from models.connection import Connection, ConnectionStatus
from schemas import ConnectionRequest, ConnectionResponse, ConnectionListResponse, UserProfileResponse
from routers.auth import get_current_user
import uuid
from datetime import datetime

router = APIRouter(
    prefix="/connections",
    tags=["connections"]
)

@router.post("/request", response_model=ConnectionResponse)
def send_connection_request(
    request: ConnectionRequest, 
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    # 1. Find the user by friend_code
    addressee = db.query(User).filter(User.friend_code == request.friend_code).first()
    if not addressee:
        raise HTTPException(status_code=404, detail="User not found with this Friend Code")
    
    if addressee.id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot connect with yourself")

    # 2. Check if connection already exists
    existing_connection = db.query(Connection).filter(
        or_(
            (Connection.requester_id == current_user.id) & (Connection.addressee_id == addressee.id),
            (Connection.requester_id == addressee.id) & (Connection.addressee_id == current_user.id)
        )
    ).first()

    if existing_connection:
        if existing_connection.status == ConnectionStatus.PENDING:
            if existing_connection.addressee_id == current_user.id:
                # Step B: Auto-Accept
                existing_connection.status = ConnectionStatus.ACCEPTED
                existing_connection.updated_at = datetime.utcnow()
                db.commit()
                db.refresh(existing_connection)
                return existing_connection
            else:
                raise HTTPException(status_code=400, detail="Connection request already sent and is pending")
        
        # Step C: Already connected or blocked
        status_msg = f"Connection already exists with status: {existing_connection.status}"
        raise HTTPException(status_code=400, detail=status_msg)

    # 3. Create new connection (Step D)
    new_connection = Connection(
        requester_id=current_user.id,
        addressee_id=addressee.id,
        status=ConnectionStatus.PENDING
    )
    
    db.add(new_connection)
    
    # Step E: Race Condition Handling
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        # Fetch the row that was just inserted by the other thread
        race_connection = db.query(Connection).filter(
            or_(
                (Connection.requester_id == current_user.id) & (Connection.addressee_id == addressee.id),
                (Connection.requester_id == addressee.id) & (Connection.addressee_id == current_user.id)
            )
        ).first()

        if race_connection and race_connection.status == ConnectionStatus.PENDING and race_connection.addressee_id == current_user.id:
            race_connection.status = ConnectionStatus.ACCEPTED
            race_connection.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(race_connection)
            return race_connection
        elif race_connection:
            raise HTTPException(status_code=400, detail=f"Connection already exists with status: {race_connection.status}")
        else:
            raise HTTPException(status_code=500, detail="Database integrity error occurred")

    db.refresh(new_connection)
    return new_connection

@router.put("/accept/{connection_id}", response_model=ConnectionResponse)
def accept_connection(
    connection_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    connection = db.query(Connection).filter(Connection.id == connection_id).first()
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    # Only the addressee can accept
    if connection.addressee_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to accept this request")
    
    if connection.status != ConnectionStatus.PENDING:
        raise HTTPException(status_code=400, detail="Connection is not pending")
    
    connection.status = ConnectionStatus.ACCEPTED
    connection.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(connection)
    return connection

@router.get("/", response_model=list[ConnectionListResponse])
def list_connections(
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    # Fetch all connections involving current user
    connections = db.query(Connection).filter(
        or_(
            Connection.requester_id == current_user.id,
            Connection.addressee_id == current_user.id
        )
    ).all()

    result = []
    for conn in connections:
        is_requester = conn.requester_id == current_user.id
        friend = conn.addressee if is_requester else conn.requester
        
        result.append({
            "id": conn.id,
            "friend_user": friend,
            "status": conn.status,
            "created_at": conn.created_at,
            "is_requester": is_requester
        })
        
    return result
