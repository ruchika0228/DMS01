from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv

load_dotenv()

SQLALCHEMY_DATABASE_URL = "postgresql://postgres:1234@localhost/postgres"
engine = create_engine(SQLALCHEMY_DATABASE_URL)

def search_file(filename):
    print(f"\n--- Searching for file: {filename} ---")
    with engine.connect() as conn:
        result = conn.execute(text("SELECT id, file_name, cid FROM files WHERE file_name ILIKE :name"), {"name": f"%{filename}%"})
        files = result.fetchall()
        if not files:
            print("No file found in database.")
            # Let's list all files just in case
            print("\n--- All Files in DB ---")
            result = conn.execute(text("SELECT id, file_name, cid FROM files"))
            for row in result:
                print(f"ID: {row[0]}, Name: {row[1]}, CID: {row[2]}")
            return
        
        for f in files:
            print(f"ID: {f[0]}, Name: {f[1]}, CID: {f[2]}")
            # Check for OCR results
            ocr_result = conn.execute(text("SELECT extracted_text FROM ocr_results WHERE file_id = :fid"), {"fid": f[0]})
            ocr = ocr_result.fetchone()
            if ocr:
                print(f"OCR Result: {ocr[0][:500]}...")
            else:
                print("No OCR result found for this file.")

if __name__ == "__main__":
    search_file("zety")
