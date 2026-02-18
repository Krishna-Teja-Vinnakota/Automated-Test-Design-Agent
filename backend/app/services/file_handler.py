"""File upload handling service."""
import tempfile
import os
from typing import List, Dict, Any
from pathlib import Path
from fastapi import UploadFile


class FileHandler:
    """Service for handling file uploads."""
    
    def __init__(self):
        self.temp_dir = Path(tempfile.gettempdir()) / "qa_wizard_uploads"
        self.temp_dir.mkdir(exist_ok=True)
    
    async def save_uploaded_files(self, files: List[UploadFile]) -> List[Dict[str, Any]]:
        """Save uploaded files and return metadata."""
        saved_files = []
        
        for file in files:
            file_path = self.temp_dir / file.filename
            content = await file.read()
            file_path.write_bytes(content)
            
            saved_files.append({
                "filename": file.filename,
                "path": str(file_path),
                "size": len(content),
                "content": content.decode('utf-8', errors='ignore')
            })
        
        return saved_files
    
    def read_file_content(self, file_path: str) -> str:
        """Read file content."""
        path = Path(file_path)
        if path.exists():
            return path.read_text(encoding='utf-8', errors='ignore')
        raise FileNotFoundError(f"File not found: {file_path}")
    
    def cleanup_files(self, file_paths: List[str]):
        """Clean up temporary files."""
        for file_path in file_paths:
            path = Path(file_path)
            if path.exists():
                path.unlink()
