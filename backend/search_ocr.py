from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv

load_dotenv()

SQLALCHEMY_DATABASE_URL = "postgresql://postgres:1234@localhost/postgres"
engine = create_engine(SQLALCHEMY_DATABASE_URL)

def search_ocr(keyword):
    print(f"\n--- Searching OCR for keyword: {keyword} ---")
    with engine.connect() as conn:
        result = conn.execute(text("SELECT f.file_name, o.extracted_text FROM ocr_results o JOIN files f ON o.file_id = f.id WHERE o.extracted_text ILIKE :kw"), {"kw": f"%{keyword}%"})
        matches = result.fetchall()
        if not matches:
            print("No matches found in OCR results.")
            return
        
        for m in matches:
            print(f"File: {m[0]}")
            print(f"Text: {m[1][:1000]}...")

if __name__ == "__main__":
    search_ocr("zety")
