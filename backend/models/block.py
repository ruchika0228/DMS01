from sqlalchemy import Column, String, DateTime, JSON
from database import Base
from datetime import datetime

class Block(Base):
    __tablename__ = "blockchain_blocks"

    tx_id = Column(String, primary_key=True, index=True)
    prev_tx_id = Column(String, nullable=False)
    file_id = Column(String, index=True, nullable=False)
    primary_file_id = Column(String, index=True, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    data = Column(JSON, nullable=False)
