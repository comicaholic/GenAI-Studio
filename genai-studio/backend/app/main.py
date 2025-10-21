import os
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from dotenv import load_dotenv
BACKEND_DIR = Path(__file__).resolve().parents[1]  # backend/
ENV_PATH = BACKEND_DIR / ".env"
load_dotenv(dotenv_path=ENV_PATH)


# import routers
from .routers import (
    files,
    health,
    models,
    llm,
    ocr,
    eval as eval_router,
    presets,
    analytics,
    settings,
    chat,
    custom,
    history,
)

app = FastAPI(title="GenAI Studio")

# Start background metrics recording on startup
@app.on_event("startup")
async def startup_event():
    """Start background services on application startup"""
    try:
        from .routers.analytics import ensure_background_recording
        ensure_background_recording()
        print("✅ Background metrics recording started")
    except Exception as e:
        print(f"⚠️ Failed to start background metrics recording: {e}")

# Also start recording immediately when the module is imported
try:
    from .routers.analytics import ensure_background_recording
    ensure_background_recording()
except Exception as e:
    print(f"⚠️ Failed to start background metrics recording on import: {e}")

# CORS – tighten to dev origins if you like


origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost",    
    "http://127.0.0.1",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Mount routers (one prefix each)
app.include_router(health.router,    prefix="/api",            tags=["health"])          # GET /api/health
app.include_router(settings.router,  prefix="/api/settings",   tags=["settings"])        # GET/POST /api/settings/paths
app.include_router(files.router,     prefix="/api",            tags=["files"])           # /api/files/...
app.include_router(models.router,    prefix="/api/models",     tags=["models"])          # /api/models/...
app.include_router(llm.router,       prefix="/api/llm",        tags=["llm"])             # /api/llm/...
app.include_router(ocr.router,       prefix="/api/ocr",        tags=["ocr"])             # /api/ocr/...
app.include_router(eval_router.router, prefix="/api/eval",     tags=["eval"])            # /api/eval/...
app.include_router(presets.router,   prefix="/api/presets",    tags=["presets"])
app.include_router(analytics.router, prefix="/api/analytics",  tags=["analytics"])
app.include_router(chat.router,      prefix="/api/chat",       tags=["chat"])
app.include_router(custom.router,    prefix="/api/custom",     tags=["custom"])
app.include_router(history.router,   prefix="/api",            tags=["history"])

# --- SPA static serving for production builds (only when not in Docker) ---
if not os.getenv("DOCKER"):
    _dist_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../frontend/dist"))
    _assets_dir = os.path.join(_dist_dir, "assets")
    if os.path.isdir(_assets_dir):
        app.mount("/assets", StaticFiles(directory=_assets_dir), name="assets")

    @app.get("/{full_path:path}")
    def spa(full_path: str):
        """Serve index.html for any non-API path to support client-side routing."""
        index_path = os.path.join(_dist_dir, "index.html")
        if os.path.isfile(index_path):
            return FileResponse(index_path)
        # If dist is missing, return a simple hint
        return {"detail": "Run 'npm run build' in frontend/."}
