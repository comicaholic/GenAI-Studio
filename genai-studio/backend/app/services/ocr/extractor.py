from pathlib import Path
from typing import List
import fitz  # PyMuPDF
import io
import os
import pytesseract
from PIL import Image
pytesseract.pytesseract.tesseract_cmd = os.getenv(
    "TESSERACT_CMD", pytesseract.pytesseract.tesseract_cmd
)


def _ocr_page_pix(pix) -> str:
    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
    # Allow custom path via env var TESSERACT_CMD if needed
    # import os; pytesseract.pytesseract.tesseract_cmd = os.getenv("TESSERACT_CMD", pytesseract.pytesseract.tesseract_cmd)
    return pytesseract.image_to_string(img)

def extract_text(path: Path) -> List[str]:
    texts: List[str] = []
    doc = fitz.open(path)
    for page in doc:
        t = page.get_text().strip()
        if not t:
            # Fallback to OCR only if text layer is empty
            pix = page.get_pixmap(dpi=300)
            try:
                t = _ocr_page_pix(pix)
            except Exception as e:
                # Give a helpful message that the caller can surface
                raise RuntimeError(f"OCR required but not available: {e}")
        texts.append(t)
    return texts

async def extract_text_from_file(file) -> tuple[str, list[str]]:
    """
    Extract text from a PDF or image file using OCR.
    Returns: (full_text, pages[])
    """
    filename = file.filename.lower()
    content = await file.read()
    pages = []

    if filename.endswith(".pdf"):
        pdf = fitz.open(stream=content, filetype="pdf")
        for page_num in range(len(pdf)):
            page = pdf[page_num]
            text = page.get_text("text").strip()
            if not text:
                # fallback to OCR on rendered page
                pix = page.get_pixmap(dpi=200)
                img = Image.open(io.BytesIO(pix.tobytes("png")))
                text = pytesseract.image_to_string(img)
            pages.append(text)
        pdf.close()
    elif filename.endswith((".png", ".jpg", ".jpeg")):
        img = Image.open(io.BytesIO(content))
        text = pytesseract.image_to_string(img)
        pages.append(text)
    elif filename.endswith((".png", ".jpg", ".jpeg", ".tif", ".tiff")):
        img = Image.open(io.BytesIO(content))
        text = pytesseract.image_to_string(img)
        pages.append(text)
    else:
        raise ValueError("Unsupported file type. Upload PDF or image.")

    full_text = "\n\n".join(pages)
    return full_text, pages
