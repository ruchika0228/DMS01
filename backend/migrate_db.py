import sys
import os
import uuid
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Add backend to path to import models
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import SQLALCHEMY_DATABASE_URL, Base
from models.user import User, Department, Position

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)

def migrate():
    # 1. Connect and create new columns on users if they don't exist
    with engine.begin() as conn:
        res = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='users'"))
        cols = [r[0] for r in res]
        
        if 'full_name' not in cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN full_name VARCHAR(255)"))
            print("Added column 'full_name' to users")
        if 'phone' not in cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN phone VARCHAR(50)"))
            print("Added column 'phone' to users")
        if 'department_id' not in cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN department_id UUID"))
            print("Added column 'department_id' to users")
        if 'position_id' not in cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN position_id UUID"))
            print("Added column 'position_id' to users")

    # 2. Create the departments and positions tables using metadata
    Base.metadata.create_all(bind=engine)
    print("Ensured departments and positions tables exist")

    db = SessionLocal()
    try:
        # 3. Seed unique departments
        users = db.query(User).all()
        
        # Get unique departments from existing users
        dept_names = set(u.department for u in users if u.department)
        # Add a default one if empty
        if not dept_names:
            dept_names.add("General Administration")
            
        dept_map = {}
        for name in dept_names:
            dept = db.query(Department).filter(Department.name == name).first()
            if not dept:
                dept = Department(id=uuid.uuid4(), name=name, description=f"{name} Department", status=True)
                db.add(dept)
                db.flush()
                print(f"Created department: {name}")
            dept_map[name] = dept.id

        # Commit departments
        db.commit()

        # 4. Seed unique positions/designations linked to departments
        pos_map = {}
        for u in users:
            d_name = u.department or "General Administration"
            p_name = u.designation or "Staff"
            
            d_id = dept_map.get(d_name)
            
            if d_id:
                # Find or create Position under that department
                pos = db.query(Position).filter(Position.department_id == d_id, Position.name == p_name).first()
                if not pos:
                    pos = Position(id=uuid.uuid4(), department_id=d_id, name=p_name, description=f"{p_name} Role", status=True)
                    db.add(pos)
                    db.flush()
                    print(f"Created position: {p_name} under department {d_name}")
                pos_map[(d_id, p_name)] = pos.id
        
        # Commit positions
        db.commit()

        # 5. Map users to department_id and position_id
        for u in users:
            d_name = u.department or "General Administration"
            p_name = u.designation or "Staff"
            d_id = dept_map.get(d_name)
            p_id = pos_map.get((d_id, p_name))
            
            u.department_id = d_id
            u.position_id = p_id
            if not u.full_name:
                u.full_name = u.username.title()
            db.add(u)
            
        db.commit()
        print("Successfully mapped all existing users to relational departments and positions!")

    except Exception as e:
        db.rollback()
        print(f"Error during migration: {e}")
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    migrate()
