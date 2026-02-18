"""FastAPI application entry point."""
import os
import webbrowser
import threading
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager

from app.config.database import connect_to_mongo, close_mongo_connection
from app.api.routes import router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    # Startup
    await connect_to_mongo()
    
    # Open frontend in browser after a short delay
    def open_browser():
        import time
        time.sleep(1.5)  # Wait for server to start
        webbrowser.open('http://localhost:8000')
    
    threading.Thread(target=open_browser, daemon=True).start()
    
    yield
    # Shutdown
    await close_mongo_connection()


app = FastAPI(
    title="AI Testing Automation API",
    description="Backend API for AI-driven testing automation system",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify actual origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers (must be before static files)
app.include_router(router, prefix="/api", tags=["api"])

# Serve frontend static files
frontend_path = Path(__file__).parent.parent.parent / "frontend"
if frontend_path.exists():
    # Mount static files for CSS, JS, and pages
    app.mount("/css", StaticFiles(directory=str(frontend_path / "css")), name="css")
    app.mount("/js", StaticFiles(directory=str(frontend_path / "js")), name="js")
    app.mount("/pages", StaticFiles(directory=str(frontend_path / "pages")), name="pages")
    
    # Serve index.html at root
    @app.get("/")
    async def serve_root():
        index_path = frontend_path / "index.html"
        if index_path.exists():
            return FileResponse(str(index_path))
        return {"message": "Frontend not found"}
    
    # Also serve index.html at /index.html
    @app.get("/index.html")
    async def serve_index():
        index_path = frontend_path / "index.html"
        if index_path.exists():
            return FileResponse(str(index_path))
        return {"message": "Frontend not found"}


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}
