# backend/app/routers/eval.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.eval.metrics import compute_metrics
from ..services.reports.pdf import build_pdf
from fastapi.responses import Response
import csv
import io
from typing import List, Dict, Any

router = APIRouter(tags=["eval"])

class MetricsRequest(BaseModel):
    prediction: str
    reference: str
    metrics: list[str]
    meta: dict = {}
    options: dict = {}

class ExportRequest(BaseModel):
    rows: List[Dict[str, Any]]
    meta: Dict[str, Any] = {}

@router.post("/metrics")
async def metrics(req: MetricsRequest):
    """
    Compute selected metrics between prediction and reference text.
    """
    try:
        print(f"Evaluation request: prediction='{req.prediction[:50]}...', reference='{req.reference[:50]}...', metrics={req.metrics}")
        scores = compute_metrics(
            prediction=req.prediction,
            reference=req.reference,
            metrics=req.metrics,
            options=req.options,
        )
        print(f"Evaluation result: {scores}")
        return {"scores": scores}
    except Exception as e:
        print(f"Evaluation error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Metric computation failed: {str(e)}")


@router.post("/report/csv")
async def report_csv(req: ExportRequest):
    """
    Export evaluation results as CSV.
    """
    if not req.rows:
        raise HTTPException(400, "Rows must be non-empty")

    output = io.StringIO()
    writer = csv.writer(output)
    
    # Get all unique keys from all rows to create comprehensive headers
    all_keys = set()
    for row in req.rows:
        all_keys.update(row.keys())
    
    # Sort keys for consistent ordering
    headers = sorted(list(all_keys))
    writer.writerow(headers)
    
    # Write data rows
    for row in req.rows:
        writer.writerow([row.get(key, "") for key in headers])

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="evaluation-results.csv"'},
    )


@router.post("/report/pdf")
async def report_pdf(req: ExportRequest):
    """
    Export evaluation results as PDF.
    """
    if not req.rows:
        raise HTTPException(400, "Rows must be non-empty")

    try:
        pdf_bytes = build_pdf(req.rows, req.meta)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": 'attachment; filename="evaluation-results.pdf"'},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)}")