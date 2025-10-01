# backend/app/routers/files.py
from __future__ import annotations
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from typing import Literal, List
from pathlib import Path

# If you already have a settings helper, reuse it. Otherwise these safe defaults work.
BASE_DIR = Path(__file__).resolve().parents[2]  # .../backend
DATA_DIR = BASE_DIR / "data"
DEFAULTS = {
    "source_dir": DATA_DIR / "source",
    "reference_dir": DATA_DIR / "reference",
    "context_dir": DATA_DIR / "context",
}

router = APIRouter(tags=["files"])

SOURCE_EXT = {".pdf", ".png", ".jpg", ".jpeg", ".tif", ".tiff"}
REF_EXT    = {".pdf", ".png", ".jpg", ".jpeg", ".tif", ".tiff", ".txt"}
CTX_EXT    = REF_EXT


def _dir_for(kind: Literal["source", "reference", "context"]) -> Path:
    if kind == "source":
        p = DEFAULTS["source_dir"]
    elif kind == "reference":
        p = DEFAULTS["reference_dir"]
    else:
        p = DEFAULTS["context_dir"]
    p.mkdir(parents=True, exist_ok=True)
    return p


def _exts_for(kind: Literal["source", "reference", "context"]) -> set[str]:
    if kind == "source":
        return SOURCE_EXT
    if kind == "reference":
        return REF_EXT
    return CTX_EXT


@router.get("/files/list")
def list_files(kind: Literal["source", "reference", "context"] = "source"):
    """
    Return the filenames (not paths) for the configured directory.
    """
    root = _dir_for(kind)
    exts = _exts_for(kind)
    files: List[str] = []
    for f in root.iterdir():
        if f.is_file() and f.suffix.lower() in exts:
            files.append(f.name)
    files.sort()
    return {"files": files}


@router.get("/files/load")
async def load_file(kind: Literal["source", "reference", "context"], name: str):
    """
    For kind == 'source': return the actual file blob (client will re-post to /api/ocr/extract).
    For kind in {'reference','context'}: extract text server-side and return JSON { filename, text }.
    """
    root = _dir_for(kind)
    path = (root / name).resolve()

    # Prevent path traversal
    if root not in path.parents and path != root:
        raise HTTPException(400, "Invalid path")

    if not path.exists() or not path.is_file():
        raise HTTPException(404, "File not found")

    if kind == "source":
        # Return the raw file so the frontend can submit it to /api/ocr/extract
        return FileResponse(str(path), filename=path.name)

    # reference/context → extract text on the server
    from app.services.ocr.reference import extract_reference_text

    class _UploadLike:
        def __init__(self, p: Path):
            self.filename, self._p = p.name, p

        async def read(self):
            return self._p.read_bytes()

    up = _UploadLike(path)
    try:
        text = await extract_reference_text(up)
    except Exception as e:
        raise HTTPException(500, f"Reference extraction failed: {e}")

    return {"filename": path.name, "text": text}
