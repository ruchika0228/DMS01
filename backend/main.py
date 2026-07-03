from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from models import user, file, connection, block, workflow
from database import engine, Base
from routers import auth, connections, files, cad, blockchain, chatbot, admin, workflow, search

# Create FastAPI app
app = FastAPI(
    title="File Management System API",
    description="Backend API for File Management System using FastAPI and PostgreSQL",
    version="1.0.0"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth.router)
app.include_router(connections.router)
app.include_router(files.router)
app.include_router(cad.router)
app.include_router(blockchain.router)
app.include_router(chatbot.router)
app.include_router(search.router)
app.include_router(admin.router)
app.include_router(workflow.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to File Management System API"}

# Create tables (For init dev only)
Base.metadata.create_all(bind=engine)

