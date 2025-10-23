from fastapi import APIRouter

router = APIRouter()

@router.get("/ping")
def ping_chat():
    return {"module":"chat", "ping":"pong"}
