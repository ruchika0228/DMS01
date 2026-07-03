from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from sqlalchemy import or_, func, cast, String
from database import get_db
from models.block import Block
import uuid
import hashlib
import json
from datetime import datetime
from pydantic import BaseModel
from typing import Optional, List

router = APIRouter(
    prefix="/api/files",
    tags=["blockchain"]
)

class RegisterRequest(BaseModel):
    id: str
    owner_id: str
    file_name: str
    file_type: str
    file_size: int
    cid: str
    sender_latitude: Optional[str] = "0"
    sender_longitude: Optional[str] = "0"
    sender_address: Optional[str] = None
    accuracy_meters: Optional[float] = None
    device_timestamp: Optional[int] = None
    location_tier: Optional[str] = "unknown"

class TransferRequest(BaseModel):
    id: str
    file_id: str
    sender_id: str
    receiver_id: str
    sender_latitude: Optional[str] = "0"
    sender_longitude: Optional[str] = "0"
    sender_address: Optional[str] = None
    receiver_latitude: Optional[str] = "0"
    receiver_longitude: Optional[str] = "0"
    receiver_address: Optional[str] = None
    accuracy_meters: Optional[float] = None
    device_timestamp: Optional[int] = None
    location_tier: Optional[str] = "unknown"

class RegisterRedactedRequest(BaseModel):
    id: str
    primary_file_id: str
    redacted_by: str
    redacted_cid: str
    shared_with: str
    sender_latitude: Optional[str] = "0"
    sender_longitude: Optional[str] = "0"
    sender_address: Optional[str] = None
    receiver_latitude: Optional[str] = "0"
    receiver_longitude: Optional[str] = "0"
    receiver_address: Optional[str] = None
    accuracy_meters: Optional[float] = None
    device_timestamp: Optional[int] = None
    location_tier: Optional[str] = "unknown"

class EditRequest(BaseModel):
    id: str
    file_name: str
    file_type: str
    file_size: int
    cid: str
    owner_id: str
    sender_latitude: Optional[str] = "0"
    sender_longitude: Optional[str] = "0"
    sender_address: Optional[str] = None

class LocationUpdateRequest(BaseModel):
    file_id: str
    user_id: str
    latitude: str
    longitude: str
    address: Optional[str] = None
    action: Optional[str] = "Location Updated"

def calculate_block_hash(prev_tx_id: str, file_id: str, data: dict, timestamp: str) -> str:
    """
    Calculates the SHA-256 hash of a block.
    """
    # Canonical JSON string of data
    data_str = json.dumps(data, sort_keys=True)
    block_string = f"{prev_tx_id}{file_id}{data_str}{timestamp}"
    return hashlib.sha256(block_string.encode()).hexdigest()

@router.post("/register")
async def register_file(req: RegisterRequest, x_api_key: str = Header(None), db: Session = Depends(get_db)):
    timestamp = datetime.utcnow()
    prev_tx_id = "GENESIS"
    
    block_data = {
        "owner_id": req.owner_id,
        "file_name": req.file_name,
        "file_type": req.file_type,
        "file_size": req.file_size,
        "cid": req.cid,
        "sender_latitude": req.sender_latitude,
        "sender_longitude": req.sender_longitude,
        "sender_address": req.sender_address,
        "accuracy_meters": req.accuracy_meters,
        "device_timestamp": req.device_timestamp,
        "location_tier": req.location_tier,
        "action": "Registered"
    }
    
    tx_id = calculate_block_hash(prev_tx_id, req.id, block_data, timestamp.isoformat())
    
    new_block = Block(
        tx_id=tx_id,
        prev_tx_id=prev_tx_id,
        file_id=req.id,
        timestamp=timestamp,
        data=block_data
    )
    db.add(new_block)
    db.commit()
    return {"success": True, "message": "File registered on blockchain", "tx_id": tx_id}

@router.post("/transfer")
async def transfer_file(req: TransferRequest, x_api_key: str = Header(None), db: Session = Depends(get_db)):
    last_block = db.query(Block).filter(Block.file_id == req.file_id).order_by(Block.timestamp.desc()).first()
    if not last_block:
        raise HTTPException(status_code=404, detail="File not found on blockchain")
    
    timestamp = datetime.utcnow()
    prev_tx_id = last_block.tx_id
    
    block_data = last_block.data.copy()
    block_data.update({
        "owner_id": req.receiver_id,
        "transferred_by": req.sender_id,
        "sender_latitude": req.sender_latitude,
        "sender_longitude": req.sender_longitude,
        "sender_address": req.sender_address,
        "receiver_latitude": req.receiver_latitude,
        "receiver_longitude": req.receiver_longitude,
        "receiver_address": req.receiver_address,
        "accuracy_meters": req.accuracy_meters,
        "device_timestamp": req.device_timestamp,
        "location_tier": req.location_tier,
        "action": "Transferred"
    })

    tx_id = calculate_block_hash(prev_tx_id, req.file_id, block_data, timestamp.isoformat())

    new_block = Block(
        tx_id=tx_id,
        prev_tx_id=prev_tx_id,
        file_id=req.file_id,
        timestamp=timestamp,
        data=block_data
    )
    db.add(new_block)
    db.commit()
    return {"success": True, "message": "Transfer recorded on blockchain", "tx_id": tx_id}

@router.post("/update-location")
async def update_location(req: LocationUpdateRequest, x_api_key: str = Header(None), db: Session = Depends(get_db)):
    last_block = db.query(Block).filter(Block.file_id == req.file_id).order_by(Block.timestamp.desc()).first()
    if not last_block:
        raise HTTPException(status_code=404, detail="File not found on blockchain")
    
    timestamp = datetime.utcnow()
    prev_tx_id = last_block.tx_id
    
    block_data = last_block.data.copy()
    if block_data.get("owner_id") == req.user_id:
        block_data.update({
            "receiver_latitude": req.latitude,
            "receiver_longitude": req.longitude,
            "receiver_address": req.address,
            "action": req.action
        })
    else:
        block_data.update({
            "sender_latitude": req.latitude,
            "sender_longitude": req.longitude,
            "sender_address": req.address,
            "action": req.action
        })

    tx_id = calculate_block_hash(prev_tx_id, req.file_id, block_data, timestamp.isoformat())

    new_block = Block(
        tx_id=tx_id,
        prev_tx_id=prev_tx_id,
        file_id=req.file_id,
        timestamp=timestamp,
        data=block_data
    )
    db.add(new_block)
    db.commit()
    return {"success": True, "message": "Location update recorded on blockchain", "tx_id": tx_id}

@router.post("/register-redacted")
async def register_redacted(req: RegisterRedactedRequest, x_api_key: str = Header(None), db: Session = Depends(get_db)):
    timestamp = datetime.utcnow()
    prev_tx_id = "REDACTED_GENESIS"
    
    block_data = {
        "redacted_by": req.redacted_by,
        "redacted_cid": req.redacted_cid,
        "shared_with": req.shared_with,
        "sender_latitude": req.sender_latitude,
        "sender_longitude": req.sender_longitude,
        "sender_address": req.sender_address,
        "receiver_latitude": req.receiver_latitude,
        "receiver_longitude": req.receiver_longitude,
        "receiver_address": req.receiver_address,
        "accuracy_meters": req.accuracy_meters,
        "device_timestamp": req.device_timestamp,
        "location_tier": req.location_tier,
        "action": "Redacted Copy Shared"
    }
    
    tx_id = calculate_block_hash(prev_tx_id, req.id, block_data, timestamp.isoformat())

    new_block = Block(
        tx_id=tx_id,
        prev_tx_id=prev_tx_id,
        file_id=req.id,
        primary_file_id=req.primary_file_id,
        timestamp=timestamp,
        data=block_data
    )
    db.add(new_block)
    db.commit()
    return {"success": True, "message": "Redacted copy registered on blockchain", "tx_id": tx_id}

@router.post("/edit")
async def edit_file(req: EditRequest, x_api_key: str = Header(None), db: Session = Depends(get_db)):
    last_block = db.query(Block).filter(Block.file_id == req.id).order_by(Block.timestamp.desc()).first()
    if not last_block:
        raise HTTPException(status_code=404, detail="File not found on blockchain")

    timestamp = datetime.utcnow()
    prev_tx_id = last_block.tx_id
    
    block_data = last_block.data.copy()
    block_data.update({
        "owner_id": req.owner_id,
        "file_name": req.file_name,
        "file_type": req.file_type,
        "file_size": req.file_size,
        "cid": req.cid,
        "sender_latitude": req.sender_latitude,
        "sender_longitude": req.sender_longitude,
        "sender_address": req.sender_address,
        "last_edited_by": req.owner_id,
        "action": "Edited"
    })

    tx_id = calculate_block_hash(prev_tx_id, req.id, block_data, timestamp.isoformat())

    new_block = Block(
        tx_id=tx_id,
        prev_tx_id=prev_tx_id,
        file_id=req.id,
        timestamp=timestamp,
        data=block_data
    )
    db.add(new_block)
    db.commit()
    return {"success": True, "message": "Edit recorded on blockchain", "tx_id": tx_id}

@router.get("/{file_id}/history")
async def get_history(file_id: str, x_api_key: str = Header(None), db: Session = Depends(get_db)):
    target_file_id = file_id

    cid_block = db.query(Block).filter(
        or_(
            cast(Block.data['cid'], String) == f'"{file_id}"',
            cast(Block.data['redacted_cid'], String) == f'"{file_id}"'
        )
    ).first()

    if cid_block:
        target_file_id = cid_block.file_id

    main_chain = db.query(Block).filter(Block.file_id == target_file_id).order_by(Block.timestamp.asc()).all()
    redacted_copies = db.query(Block).filter(Block.primary_file_id == target_file_id).order_by(Block.timestamp.asc()).all()
    
    return {
        "success": True,
        "queried_id": file_id,
        "resolved_primary_id": target_file_id if target_file_id != file_id else None,
        "data": [
            {
                "tx_id": b.tx_id,
                "prev_tx_id": b.prev_tx_id,
                "file_id": b.file_id,
                "timestamp": b.timestamp.isoformat(),
                "data": b.data
            } for b in main_chain
        ],
        "redacted_copies": [
            {
                "id": b.file_id,
                "tx_id": b.tx_id,
                "primary_file_id": b.primary_file_id,
                "redacted_by": b.data.get("redacted_by"),
                "redacted_cid": b.data.get("redacted_cid"),
                "shared_with": b.data.get("shared_with"),
                "created_at": b.timestamp.isoformat(),
                "sender_latitude": b.data.get("sender_latitude"),
                "sender_longitude": b.data.get("sender_longitude"),
                "sender_address": b.data.get("sender_address"),
                "receiver_latitude": b.data.get("receiver_latitude"),
                "receiver_longitude": b.data.get("receiver_longitude"),
                "receiver_address": b.data.get("receiver_address")
            } for b in redacted_copies
        ]
    }
