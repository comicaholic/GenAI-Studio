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
    automationSetId: Optional[str] = None  # Links evaluation to automation set
    automationId: Optional[str] = None  # Links evaluation to specific automation
    runId: Optional[str] = None  # Links evaluation to specific run
    error: Optional[str] = None  # Error message for failed evaluations

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
    runId: Optional[str] = None
    runName: Optional[str] = None
    name: Optional[str] = None  # For backward compatibility
    type: Optional[str] = None
    title: Optional[str] = None
    model: Optional[ModelInfo] = None
    parameters: Dict[str, Any]
    metrics: Optional[Dict[str, Any]] = None
    usedText: Optional[UsedText] = None
    # File information for OCR/Prompt automations
    sourceFileName: Optional[str] = None
    referenceFileName: Optional[str] = None
    promptFileName: Optional[str] = None
    # Results and status
    results: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    status: Optional[str] = "pending"
    modelId: Optional[str] = None
    modelProvider: Optional[str] = None
    prompt: Optional[str] = None
    startedAt: Optional[str] = None
    finishedAt: Optional[str] = None
    completedAt: Optional[datetime] = None

class SavedAutomation(BaseModel):
    id: str
    name: str
    title: Optional[str] = None
    type: str  # 'ocr' | 'prompt' | 'chat'
    model: ModelInfo
    parameters: Dict[str, Any]
    runs: List[AutomationRun] = []
    status: str = "unknown"
    createdAt: Optional[str] = None
    completedAt: Optional[datetime] = None
    automationSetId: Optional[str] = None  # Groups related automations together

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
    """Get all saved evaluations, excluding those from automations"""
    try:
        evaluations = load_evaluations()
        # Filter out evaluations that are part of automations
        standalone_evaluations = [eval for eval in evaluations if not hasattr(eval, 'automationId') or not eval.automationId]
        return {"evaluations": [eval.dict() for eval in standalone_evaluations]}
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

@router.get("/automations/aggregates")
def get_automation_aggregates():
    """Get aggregated automation results for home page"""
    try:
        automations = load_automations()
        return [automation.dict() for automation in automations]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/automations/sets")
def get_automation_sets():
    """Get automation sets grouped by automationSetId"""
    try:
        automations = load_automations()
        evaluations = load_evaluations()
        
        # Group automations by automationSetId
        automation_sets = {}
        
        for automation in automations:
            # Use automationSetId if available, otherwise create a unique ID based on automation name and creation time
            # This ensures each execution creates its own separate card
            set_id = automation.automationSetId or f"{automation.name}_{automation.createdAt}"
            
            if set_id not in automation_sets:
                automation_sets[set_id] = {
                    "setId": set_id,
                    "name": automation.name,
                    "automations": [],
                    "evaluations": [],
                    "totalRuns": 0,
                    "successCount": 0,
                    "errorCount": 0,
                    "createdAt": automation.createdAt or "Unknown",
                    "lastRunAt": None
                }
            
            # Normalize the automation data for frontend compatibility
            automation_dict = automation.dict()
            
            # Normalize run data to ensure runName is available
            if automation_dict.get("runs"):
                for run in automation_dict["runs"]:
                    # If runName is not set but name is, use name as runName
                    if not run.get("runName") and run.get("name"):
                        run["runName"] = run["name"]
                    # If runId is not set, use id as runId
                    if not run.get("runId"):
                        run["runId"] = run["id"]
                    # If startedAt is not set, use a default
                    if not run.get("startedAt"):
                        run["startedAt"] = automation.createdAt or "Unknown"
            
            automation_sets[set_id]["automations"].append(automation_dict)
            automation_sets[set_id]["totalRuns"] += len(automation.runs or [])
            
            # Count success/error runs
            for run in automation.runs or []:
                if run.error:
                    automation_sets[set_id]["errorCount"] += 1
                else:
                    automation_sets[set_id]["successCount"] += 1
            
            # Track latest run date
            if automation.completedAt:
                if not automation_sets[set_id]["lastRunAt"] or automation.completedAt > automation_sets[set_id]["lastRunAt"]:
                    automation_sets[set_id]["lastRunAt"] = automation.completedAt
        
        # Add evaluations that belong to automation sets
        for evaluation in evaluations:
            if evaluation.automationSetId:
                set_id = evaluation.automationSetId
                if set_id in automation_sets:
                    automation_sets[set_id]["evaluations"].append(evaluation.dict())
                    # Count evaluation results
                    if evaluation.results:
                        automation_sets[set_id]["successCount"] += 1
                    else:
                        automation_sets[set_id]["errorCount"] += 1
                    
                    # Track latest evaluation date
                    if evaluation.finishedAt:
                        if not automation_sets[set_id]["lastRunAt"] or evaluation.finishedAt > automation_sets[set_id]["lastRunAt"]:
                            automation_sets[set_id]["lastRunAt"] = evaluation.finishedAt
        
        return list(automation_sets.values())
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

