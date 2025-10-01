from fastapi import APIRouter

router = APIRouter()

@router.get("/ping")
def ping_custom():
    return {"module":"custom", "ping":"pong"}
