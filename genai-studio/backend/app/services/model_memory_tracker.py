# backend/app/services/model_memory_tracker.py
import json
import time
from pathlib import Path
from typing import Dict, Optional, List
from dataclasses import dataclass, asdict
from datetime import datetime

@dataclass
class ModelMemoryRecord:
    model_id: str
    memory_used_gb: float
    memory_total_gb: float
    timestamp: str
    is_loaded: bool

class ModelMemoryTracker:
    """Track memory usage for loaded models"""
    
    def __init__(self):
        # Get the backend directory and create absolute path to data directory
        BACKEND_DIR = Path(__file__).resolve().parents[2]  # backend/
        DATA_DIR = BACKEND_DIR / "data"
        self.data_file = DATA_DIR / "model_memory_tracking.json"
        self.data_file.parent.mkdir(exist_ok=True)
        self._records: List[ModelMemoryRecord] = []
        self._load_records()
    
    def _load_records(self):
        """Load existing records from file"""
        try:
            if self.data_file.exists():
                with open(self.data_file, 'r') as f:
                    data = json.load(f)
                    self._records = [
                        ModelMemoryRecord(**record) for record in data
                    ]
        except Exception as e:
            print(f"Failed to load model memory records: {e}")
            self._records = []
    
    def _save_records(self):
        """Save records to file"""
        try:
            with open(self.data_file, 'w') as f:
                json.dump([asdict(record) for record in self._records], f, indent=2)
        except Exception as e:
            print(f"Failed to save model memory records: {e}")
    
    def record_model_loaded(self, model_id: str, memory_used_gb: float, memory_total_gb: float):
        """Record when a model is loaded"""
        record = ModelMemoryRecord(
            model_id=model_id,
            memory_used_gb=memory_used_gb,
            memory_total_gb=memory_total_gb,
            timestamp=datetime.now().isoformat(),
            is_loaded=True
        )
        self._records.append(record)
        self._save_records()
        print(f"Recorded model {model_id} loaded with {memory_used_gb:.2f} GB memory usage")
    
    def record_model_unloaded(self, model_id: str):
        """Record when a model is unloaded"""
        record = ModelMemoryRecord(
            model_id=model_id,
            memory_used_gb=0.0,
            memory_total_gb=0.0,
            timestamp=datetime.now().isoformat(),
            is_loaded=False
        )
        self._records.append(record)
        self._save_records()
        print(f"Recorded model {model_id} unloaded")
    
    def get_current_memory_usage(self, model_id: str) -> Optional[ModelMemoryRecord]:
        """Get the most recent memory usage record for a model"""
        # Find the most recent record for this model
        model_records = [r for r in self._records if r.model_id == model_id]
        if not model_records:
            return None
        
        # Return the most recent record
        return max(model_records, key=lambda r: r.timestamp)
    
    def get_all_current_models(self) -> List[ModelMemoryRecord]:
        """Get all currently loaded models"""
        current_models = {}
        
        # Group by model_id and get the most recent record for each
        for record in self._records:
            if record.model_id not in current_models or record.timestamp > current_models[record.model_id].timestamp:
                current_models[record.model_id] = record
        
        # Return only loaded models
        return [record for record in current_models.values() if record.is_loaded]
    
    def get_memory_history(self, model_id: str, limit: int = 50) -> List[ModelMemoryRecord]:
        """Get memory usage history for a specific model"""
        model_records = [r for r in self._records if r.model_id == model_id]
        # Sort by timestamp descending and limit results
        return sorted(model_records, key=lambda r: r.timestamp, reverse=True)[:limit]

# Global instance
model_memory_tracker = ModelMemoryTracker()





