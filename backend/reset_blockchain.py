import sys
import os

# Add the current directory to sys.path to import modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from database import SessionLocal
from models.block import Block

def reset_blockchain():
    db = SessionLocal()
    try:
        print("Clearing blockchain blocks...")
        db.execute(text("TRUNCATE TABLE blockchain_blocks;"))
        db.commit()
        print("Blockchain cleared.")
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    reset_blockchain()
