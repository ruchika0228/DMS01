"""
wipe_data.py
Clears ALL data from the DMS database in the correct foreign-key order.
Tables dropped (data only — schema is preserved):
  notifications, audit_logs, approval_stages, documents,
  ocr_results, transfers, files, connections,
  users, positions, departments
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from database import SessionLocal
from models.user import User, Department, Position
from models.workflow import Document, ApprovalStage, AuditLog, Notification
from models.file import File, Transfer, OCRResult
from models.connection import Connection

def wipe_all():
    db = SessionLocal()
    try:
        print("⚠️  Starting full database wipe...")

        n = db.query(Notification).delete()
        print(f"  ✓ Deleted {n} notifications")

        al = db.query(AuditLog).delete()
        print(f"  ✓ Deleted {al} audit logs")

        ast = db.query(ApprovalStage).delete()
        print(f"  ✓ Deleted {ast} approval stages")

        d = db.query(Document).delete()
        print(f"  ✓ Deleted {d} documents")

        ocr = db.query(OCRResult).delete()
        print(f"  ✓ Deleted {ocr} OCR results")

        t = db.query(Transfer).delete()
        print(f"  ✓ Deleted {t} transfers")

        f = db.query(File).delete()
        print(f"  ✓ Deleted {f} files")

        c = db.query(Connection).delete()
        print(f"  ✓ Deleted {c} connections")

        u = db.query(User).delete()
        print(f"  ✓ Deleted {u} users")

        p = db.query(Position).delete()
        print(f"  ✓ Deleted {p} positions")

        dept = db.query(Department).delete()
        print(f"  ✓ Deleted {dept} departments")

        db.commit()
        print("\n✅ Database wiped successfully. You can now create fresh departments, positions, and users from the Admin panel.")

    except Exception as e:
        db.rollback()
        print(f"\n❌ Error during wipe: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    confirm = input("This will DELETE ALL DATA permanently. Type YES to confirm: ")
    if confirm.strip() == "YES":
        wipe_all()
    else:
        print("Aborted.")
