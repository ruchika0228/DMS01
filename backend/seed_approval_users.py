import sys
import os

# Add the current directory to sys.path to import modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from database import SessionLocal, engine, Base
from models.user import User
from routers.auth import get_password_hash
import random

# Ensure tables are created
Base.metadata.create_all(bind=engine)

def seed_users():
    db = SessionLocal()
    try:
        stages = [
            {"num": 1, "name": "Clerk / Assistant"},
            {"num": 2, "name": "Section Officer"},
            {"num": 3, "name": "Under Secretary"},
            {"num": 4, "name": "Deputy Secretary"},
            {"num": 5, "name": "Joint Secretary"},
            {"num": 6, "name": "Secretary"}
        ]

        first_names = ["Rahul", "Amit", "Priya", "Sneha", "Vikram", "Anjali", "Suresh", "Meena", "Karan", "Pooja", "Arjun", "Aditi"]
        last_names = ["Sharma", "Verma", "Gupta", "Singh", "Patel", "Reddy", "Iyer", "Deshmukh", "Choudhury", "Nair"]

        for stage in stages:
            for i in range(1, 3): # 2 users per stage
                f_name = random.choice(first_names)
                l_name = random.choice(last_names)
                username = f"user_s{stage['num']}_{i}"
                email = f"{username}@example.com"
                
                # Check if user already exists
                existing = db.query(User).filter(User.username == username).first()
                if existing:
                    print(f"User {username} already exists, skipping...")
                    continue

                friend_code = User.generate_unique_friend_code(db)
                password = "password123"
                hashed_pw = get_password_hash(password)

                new_user = User(
                    username=username,
                    email=email,
                    password_hash=hashed_pw,
                    friend_code=friend_code,
                    designation=stage['name'],
                    approval_stage=stage['num'],
                    department="General Administration",
                    is_active=True
                )
                db.add(new_user)
                print(f"Created User: {username} ({f_name} {l_name}) for Stage {stage['num']} - {stage['name']}")

        db.commit()
        print("Seeding completed successfully!")
    except Exception as e:
        print(f"Error during seeding: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_users()
