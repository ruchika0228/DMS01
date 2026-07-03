import sys
import os

# Add the current directory to sys.path to import modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from database import SessionLocal
from models.user import User
from routers.auth import get_password_hash

def setup_admin():
    db = SessionLocal()
    try:
        # Clear all users and cascade to dependent rows to ensure a clean slate
        db.execute(text("TRUNCATE TABLE users CASCADE;"))
        
        # Create a fresh Admin user
        hashed_pw = get_password_hash("admin123")
        friend_code = User.generate_unique_friend_code(db)
        admin = User(
            username="admin",
            email="admin@dms.com",
            password_hash=hashed_pw,
            friend_code=friend_code,
            is_active=True,
            is_admin=True,
            department="General Administration",
            designation="Administrator",
            approval_stage=6
        )
        db.add(admin)
        db.commit()
        print("Admin user created successfully.")
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    setup_admin()
