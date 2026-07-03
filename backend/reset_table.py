from database import engine
from models.file import Transfer 

Transfer.__table__.drop(engine)
print("Transfers table dropped! Ready to rebuild.")
