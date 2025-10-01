# backend/app/routers/ocr.py
from fastapi import APIRouter, File, UploadFile, HTTPException
from app.services.ocr.extractor import extract_text_from_file
from app.services.ocr.reference import extract_reference_text

router = APIRouter(tags=["ocr"])

@router.post("/extract")
async def extract(file: UploadFile = File(...)):
    """
    Extract text from uploaded source file (PDF/Image).
    """
    try:
        text, pages = await extract_text_from_file(file)
        return {
            "file_id": f"file_{hash(file.filename)}_{hash(text)}",
            "filename": file.filename,
            "text": text, 
            "pages": pages, 
            "page_count": len(pages)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR extraction failed: {str(e)}")


@router.post("/reference")
async def reference(file: UploadFile = File(...)):
    """
    Extract plain text from reference file (PDF/TXT).
    """
    try:
        text = await extract_reference_text(file)
        return {"text": text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Reference extraction failed: {str(e)}")
