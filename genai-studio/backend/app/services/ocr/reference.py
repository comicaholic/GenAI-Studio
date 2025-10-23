# backend/app/services/ocr/reference.py
from __future__ import annotations
import io
from PIL import Image
import fitz  # PyMuPDF
import pytesseract

import fitz  # PyMuPDF

async def extract_reference_text(file) -> str:
    """
    Extract text from a reference file (PDF or TXT).
    """
    filename = file.filename.lower()
    content = await file.read()

    if filename.endswith(".txt"):
        return content.decode("utf-8")

    if filename.endswith(".pdf"):
        pdf = fitz.open(stream=content, filetype="pdf")
        text = "\n\n".join([page.get_text("text") for page in pdf])
        pdf.close()
        return text

    raise ValueError("Unsupported reference file type. Upload PDF or TXT.")
