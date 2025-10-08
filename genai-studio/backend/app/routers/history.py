# backend/app/routers/history.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any, Union
from datetime import datetime
import json
from pathlib import Path

router = APIRouter(prefix="/history", tags=["history"])

# Data storage paths
DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
EVALS_FILE = DATA_DIR / "evaluations.json"
CHATS_FILE = DATA_DIR / "chats.json"
AUTOMATIONS_FILE = DATA_DIR / "automations.json"

# Ensure data directory exists
DATA_DIR.mkdir(parents=True, exist_ok=True)

# Pydantic models
class ModelInfo(BaseModel):
    id: str
    provider: str

class UsedText(BaseModel):
    ocrText: Optional[str] = None
    referenceText: Optional[str] = None
    promptText: Optional[str] = None
    context: Optional[str] = None
    chatHistory: Optional[List[Dict[str, Any]]] = None

class FileInfo(BaseModel):
    sourceFileName: Optional[str] = None
    referenceFileName: Optional[str] = None
    promptFileName: Optional[str] = None

class SavedEvaluation(BaseModel):
    id: str
    type: str  # 'ocr' or 'prompt'
    title: str
    model: ModelInfo
    parameters: Dict[str, Any]
    metrics: List[str]
    usedText: UsedText
    files: FileInfo
    results: Optional[Dict[str, Any]] = None
    startedAt: datetime
    finishedAt: Optional[datetime] = None

class SavedChat(BaseModel):
    id: str
    title: str
    model: ModelInfo
    parameters: Dict[str, Any]
    context: Optional[str] = None
    messagesSummary: Optional[str] = None
    usedText: Optional[UsedText] = None
    lastActivityAt: datetime

class AutomationRun(BaseModel):
    id: str
    startedAt: datetime
    completedAt: Optional[datetime] = None
    status: str
    results: Optional[Dict[str, Any]] = None

class SavedAutomation(BaseModel):
    id: str
    name: str
    model: ModelInfo
    parameters: Dict[str, Any]
    runs: List[AutomationRun] = []
    status: str = "unknown"
    completedAt: Optional[datetime] = None

# Helper functions
def load_evaluations() -> List[SavedEvaluation]:
    """Load evaluations from file"""
    if not EVALS_FILE.exists():
        return []
    try:
        with open(EVALS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return [SavedEvaluation(**item) for item in data]
    except Exception as e:
        print(f"Error loading evaluations: {e}")
        return []

def save_evaluations(evaluations: List[SavedEvaluation]) -> None:
    """Save evaluations to file"""
    try:
        with open(EVALS_FILE, "w", encoding="utf-8") as f:
            json.dump([eval.dict() for eval in evaluations], f, indent=2, default=str)
    except Exception as e:
        print(f"Error saving evaluations: {e}")

def load_chats() -> List[SavedChat]:
    """Load chats from file"""
    if not CHATS_FILE.exists():
        return []
    try:
        with open(CHATS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return [SavedChat(**item) for item in data]
    except Exception as e:
        print(f"Error loading chats: {e}")
        return []

def save_chats(chats: List[SavedChat]) -> None:
    """Save chats to file"""
    try:
        with open(CHATS_FILE, "w", encoding="utf-8") as f:
            json.dump([chat.dict() for chat in chats], f, indent=2, default=str)
    except Exception as e:
        print(f"Error saving chats: {e}")

def load_automations() -> List[SavedAutomation]:
    """Load automations from file"""
    if not AUTOMATIONS_FILE.exists():
        return []
    try:
        with open(AUTOMATIONS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return [SavedAutomation(**item) for item in data]
    except Exception as e:
        print(f"Error loading automations: {e}")
        return []

def save_automations(automations: List[SavedAutomation]) -> None:
    """Save automations to file"""
    try:
        with open(AUTOMATIONS_FILE, "w", encoding="utf-8") as f:
            json.dump([automation.dict() for automation in automations], f, indent=2, default=str)
    except Exception as e:
        print(f"Error saving automations: {e}")

# API Endpoints
@router.get("/evals")
def get_evaluations():
    """Get all saved evaluations"""
    try:
        evaluations = load_evaluations()
        return {"evaluations": [eval.dict() for eval in evaluations]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/evals/{eval_id}")
def get_evaluation(eval_id: str):
    """Get a specific evaluation by ID"""
    try:
        evaluations = load_evaluations()
        evaluation = next((eval for eval in evaluations if eval.id == eval_id), None)
        if not evaluation:
            raise HTTPException(status_code=404, detail="Evaluation not found")
        return evaluation.dict()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/evals")
def create_evaluation(evaluation: SavedEvaluation):
    """Create a new evaluation record"""
    try:
        evaluations = load_evaluations()
        evaluations.append(evaluation)
        save_evaluations(evaluations)
        return {"id": evaluation.id, "message": "Evaluation saved successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/chats")
def get_chats():
    """Get all saved chats"""
    try:
        chats = load_chats()
        return {"chats": [chat.dict() for chat in chats]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/chats/{chat_id}")
def get_chat(chat_id: str):
    """Get a specific chat by ID"""
    try:
        chats = load_chats()
        chat = next((chat for chat in chats if chat.id == chat_id), None)
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")
        return chat.dict()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/chats")
def create_chat(chat: SavedChat):
    """Create a new chat record"""
    try:
        chats = load_chats()
        chats.append(chat)
        save_chats(chats)
        return {"id": chat.id, "message": "Chat saved successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/chats/{chat_id}")
def update_chat(chat_id: str, chat: SavedChat):
    """Update an existing chat"""
    try:
        chats = load_chats()
        chat_index = next((i for i, c in enumerate(chats) if c.id == chat_id), None)
        if chat_index is None:
            raise HTTPException(status_code=404, detail="Chat not found")
        
        chats[chat_index] = chat
        save_chats(chats)
        return {"id": chat_id, "message": "Chat updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/evals/{eval_id}")
def delete_evaluation(eval_id: str):
    """Delete an evaluation"""
    try:
        evaluations = load_evaluations()
        evaluations = [eval for eval in evaluations if eval.id != eval_id]
        save_evaluations(evaluations)
        return {"message": "Evaluation deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/chats/{chat_id}")
def delete_chat(chat_id: str):
    """Delete a chat"""
    try:
        chats = load_chats()
        chats = [chat for chat in chats if chat.id != chat_id]
        save_chats(chats)
        return {"message": "Chat deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Automation endpoints
@router.get("/automations")
def get_automations():
    """Get all saved automations"""
    try:
        automations = load_automations()
        return {"automations": [automation.dict() for automation in automations]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/automations/{automation_id}")
def get_automation(automation_id: str):
    """Get a specific automation by ID"""
    try:
        automations = load_automations()
        automation = next((automation for automation in automations if automation.id == automation_id), None)
        if not automation:
            raise HTTPException(status_code=404, detail="Automation not found")
        return automation.dict()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/automations")
def create_automation(automation: SavedAutomation):
    """Create a new automation record"""
    try:
        automations = load_automations()
        automations.append(automation)
        save_automations(automations)
        return {"id": automation.id, "message": "Automation saved successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/automations/{automation_id}")
def delete_automation(automation_id: str):
    """Delete an automation"""
    try:
        automations = load_automations()
        automations = [automation for automation in automations if automation.id != automation_id]
        save_automations(automations)
        return {"message": "Automation deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/automations/aggregates")
def get_automation_aggregates():
    """Get aggregated automation results for home page"""
    try:
        automations = load_automations()
        return [automation.dict() for automation in automations]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

