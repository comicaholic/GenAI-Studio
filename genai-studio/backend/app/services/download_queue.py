# backend/app/services/download_queue.py
import json
import threading
import time
from pathlib import Path
from typing import Dict, List, Optional
from dataclasses import dataclass, asdict
from enum import Enum
from app.services.model_downloader import ModelDownloader

class DownloadStatus(Enum):
    QUEUED = "queued"
    DOWNLOADING = "downloading"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

@dataclass
class DownloadItem:
    id: str
    model_id: str
    status: DownloadStatus
    progress: float  # 0-100
    downloaded_bytes: int
    total_bytes: int
    speed: float  # bytes per second
    eta: int  # estimated time remaining in seconds
    error: Optional[str] = None
    started_at: Optional[float] = None
    completed_at: Optional[float] = None
    local_path: Optional[str] = None

class DownloadQueue:
    """Manages download queue and progress tracking"""
    
    def __init__(self):
        # Get the backend directory and create absolute path to data directory
        BACKEND_DIR = Path(__file__).resolve().parents[2]  # backend/
        DATA_DIR = BACKEND_DIR / "data"
        self.queue_file = DATA_DIR / "download_queue.json"
        self.queue_file.parent.mkdir(parents=True, exist_ok=True)
        self.downloads: Dict[str, DownloadItem] = {}
        self.downloader = ModelDownloader()
        self._lock = threading.Lock()
        self._load_queue()
    
    def _load_queue(self):
        """Load download queue from file"""
        try:
            if self.queue_file.exists():
                with open(self.queue_file, 'r') as f:
                    data = json.load(f)
                    for item_data in data.get("downloads", []):
                        item = DownloadItem(**item_data)
                        item.status = DownloadStatus(item.status)
                        self.downloads[item.id] = item
        except Exception as e:
            print(f"Failed to load download queue: {e}")
    
    def _save_queue(self):
        """Save download queue to file"""
        try:
            with self._lock:
                data = {
                    "downloads": [asdict(item) for item in self.downloads.values()]
                }
                with open(self.queue_file, 'w') as f:
                    json.dump(data, f, indent=2)
        except Exception as e:
            print(f"Failed to save download queue: {e}")
    
    def add_download(self, model_id: str) -> str:
        """Add a model to the download queue"""
        download_id = f"{model_id}_{int(time.time())}"
        
        with self._lock:
            # Check if already downloading or completed
            for item in self.downloads.values():
                if item.model_id == model_id and item.status in [DownloadStatus.QUEUED, DownloadStatus.DOWNLOADING]:
                    return item.id
            
            # Create new download item
            download_item = DownloadItem(
                id=download_id,
                model_id=model_id,
                status=DownloadStatus.QUEUED,
                progress=0.0,
                downloaded_bytes=0,
                total_bytes=0,
                speed=0.0,
                eta=0
            )
            
            self.downloads[download_id] = download_item
            self._save_queue()
        
        # Start processing queue
        self._process_queue()
        
        return download_id
    
    def _process_queue(self):
        """Process the download queue"""
        def process():
            while True:
                with self._lock:
                    # Find next queued item
                    next_item = None
                    for item in self.downloads.values():
                        if item.status == DownloadStatus.QUEUED:
                            next_item = item
                            break
                
                if not next_item:
                    break
                
                # Start download
                next_item.status = DownloadStatus.DOWNLOADING
                next_item.started_at = time.time()
                self._save_queue()
                
                def on_progress(update: Dict):
                    try:
                        with self._lock:
                            # Item could be removed or cancelled; guard access
                            current = self.downloads.get(next_item.id)
                            if not current or current.status not in [DownloadStatus.DOWNLOADING, DownloadStatus.QUEUED]:
                                return
                            current.downloaded_bytes = int(update.get("downloaded_bytes", current.downloaded_bytes))
                            if update.get("total_bytes") is not None:
                                current.total_bytes = int(update.get("total_bytes", current.total_bytes))
                            current.progress = float(update.get("progress", current.progress))
                            current.speed = float(update.get("speed", current.speed))
                            if update.get("eta") is not None:
                                current.eta = int(update.get("eta", current.eta))
                            self._save_queue()
                    except Exception as e:
                        print(f"Failed to update progress: {e}")
                
                try:
                    print(f"Starting download for {next_item.model_id}")
                    # Download the model with progress callback
                    result = self.downloader.download_model(next_item.model_id, progress_callback=on_progress)
                    print(f"Download result for {next_item.model_id}: {result}")
                    
                    if result["success"]:
                        next_item.status = DownloadStatus.COMPLETED
                        next_item.progress = 100.0
                        next_item.completed_at = time.time()
                        next_item.local_path = result["local_path"]
                        # Ensure final size is recorded
                        if isinstance(result.get("model_info"), dict) and result["model_info"].get("total_bytes"):
                            next_item.total_bytes = int(result["model_info"]["total_bytes"]) 
                        print(f"Download completed successfully for {next_item.model_id}")
                    else:
                        next_item.status = DownloadStatus.FAILED
                        next_item.error = result.get("error", "Unknown error")
                        next_item.completed_at = time.time()
                        print(f"Download failed for {next_item.model_id}: {next_item.error}")
                    
                except Exception as e:
                    print(f"Exception during download for {next_item.model_id}: {e}")
                    import traceback
                    traceback.print_exc()
                    next_item.status = DownloadStatus.FAILED
                    next_item.error = str(e)
                    next_item.completed_at = time.time()
                
                self._save_queue()
        
        # Start processing in background thread
        thread = threading.Thread(target=process, daemon=True)
        thread.start()
    
    def get_download_status(self, download_id: str) -> Optional[DownloadItem]:
        """Get download status by ID"""
        with self._lock:
            return self.downloads.get(download_id)
    
    def get_all_downloads(self) -> List[DownloadItem]:
        """Get all downloads"""
        with self._lock:
            return list(self.downloads.values())
    
    def get_active_downloads(self) -> List[DownloadItem]:
        """Get active downloads (queued or downloading)"""
        with self._lock:
            return [item for item in self.downloads.values() 
                   if item.status in [DownloadStatus.QUEUED, DownloadStatus.DOWNLOADING]]
    
    def get_completed_downloads(self) -> List[DownloadItem]:
        """Get completed downloads"""
        with self._lock:
            return [item for item in self.downloads.values() 
                   if item.status == DownloadStatus.COMPLETED]
    
    def cancel_download(self, download_id: str) -> bool:
        """Cancel a download"""
        with self._lock:
            if download_id in self.downloads:
                item = self.downloads[download_id]
                if item.status in [DownloadStatus.QUEUED, DownloadStatus.DOWNLOADING]:
                    item.status = DownloadStatus.CANCELLED
                    item.completed_at = time.time()
                    self._save_queue()
                    return True
        return False
    
    def remove_download(self, download_id: str) -> bool:
        """Remove a download from the queue"""
        with self._lock:
            if download_id in self.downloads:
                del self.downloads[download_id]
                self._save_queue()
                return True
        return False
    
    def clear_completed(self) -> int:
        """Clear all completed downloads"""
        with self._lock:
            completed_ids = [item.id for item in self.downloads.values() 
                           if item.status == DownloadStatus.COMPLETED]
            for download_id in completed_ids:
                del self.downloads[download_id]
            self._save_queue()
            return len(completed_ids)

# Global download queue instance
download_queue = DownloadQueue()
