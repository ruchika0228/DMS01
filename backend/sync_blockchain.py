import uuid
from sqlalchemy import create_engine, cast, String, or_
from sqlalchemy.orm import sessionmaker
from datetime import datetime
from database import Base, SQLALCHEMY_DATABASE_URL
from models.user import User
from models.file import File, Transfer
from models.block import Block

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

import hashlib
import json
from models.block import Block

def calculate_block_hash(prev_tx_id: str, file_id: str, data: dict, timestamp: str) -> str:
    data_str = json.dumps(data, sort_keys=True)
    block_string = f"{prev_tx_id}{file_id}{data_str}{timestamp}"
    return hashlib.sha256(block_string.encode()).hexdigest()

def backfill_blockchain():
    db = SessionLocal()
    print("Starting blockchain backfill...")
    
    try:
        # 1. Backfill Files (Registration)
        files = db.query(File).all()
        for f in files:
            exists = db.query(Block).filter(Block.file_id == str(f.id), Block.prev_tx_id == "GENESIS").first()
            if not exists:
                print(f"Registering existing file: {f.file_name} ({f.id})")
                
                block_data = {
                    "owner_id": str(f.owner_id),
                    "file_name": f.file_name,
                    "file_type": f.file_type,
                    "file_size": f.file_size,
                    "cid": f.cid,
                    "sender_latitude": "0",
                    "sender_longitude": "0",
                    "action": "Registered"
                }
                
                timestamp = f.created_at
                prev_tx_id = "GENESIS"
                tx_id = calculate_block_hash(prev_tx_id, str(f.id), block_data, timestamp.isoformat())

                new_block = Block(
                    tx_id=tx_id,
                    prev_tx_id=prev_tx_id,
                    file_id=str(f.id),
                    timestamp=timestamp,
                    data=block_data
                )
                db.add(new_block)
        
        db.commit()

        # 2. Backfill Transfers
        transfers = db.query(Transfer).all()
        for t in transfers:
            # Check if this transfer is already on the blockchain
            # (Simplification: using action='Transferred' and receiver_id)
            exists = db.query(Block).filter(
                Block.file_id == str(t.file_id),
                cast(Block.data['owner_id'], String) == f'"{str(t.receiver_id)}"',
                cast(Block.data['action'], String) == '"Transferred"'
            ).first()
            
            if not exists:
                print(f"Recording existing transfer for file: {t.file_id}")
                last_block = db.query(Block).filter(Block.file_id == str(t.file_id)).order_by(Block.timestamp.desc()).first()
                prev_tx = last_block.tx_id if last_block else "GENESIS"
                
                base_data = last_block.data.copy() if last_block else {
                    "file_name": t.file.file_name,
                    "file_type": t.file.file_type,
                    "file_size": t.file.file_size,
                    "cid": t.file.cid
                }
                
                block_data = base_data.copy()
                block_data.update({
                    "owner_id": str(t.receiver_id),
                    "transferred_by": str(t.sender_id),
                    "sender_latitude": t.sender_latitude or "0",
                    "sender_longitude": t.sender_longitude or "0",
                    "receiver_latitude": t.receiver_latitude or "0",
                    "receiver_longitude": t.receiver_longitude or "0",
                    "action": "Transferred"
                })

                timestamp = t.sent_at
                tx_id = calculate_block_hash(prev_tx, str(t.file_id), block_data, timestamp.isoformat())

                new_block = Block(
                    tx_id=tx_id,
                    prev_tx_id=prev_tx,
                    file_id=str(t.file_id),
                    timestamp=timestamp,
                    data=block_data
                )
                db.add(new_block)
        
        db.commit()
        print("Backfill completed successfully.")

    except Exception as e:
        print(f"Error during backfill: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    backfill_blockchain()
