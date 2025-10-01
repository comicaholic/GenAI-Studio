# backend/app/routers/eval.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.eval.metrics import compute_metrics
from app.services.reports.pdf import build_pdf
from fastapi.responses import Response
import csv
import io

router = APIRouter(tags=["eval"])

class MetricsRequest(BaseModel):
    prediction: str
    reference: str
    metrics: list[str]
    meta: dict = {}
    options: dict = {}

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
async def report_csv(req: MetricsRequest):
    """
    Export evaluation results as CSV.
    """
    if not req.metrics:
        raise HTTPException(400, "Metrics must be non-empty")

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Metric", "Score"])
    scores = compute_metrics(req.prediction, req.reference, req.metrics, req.options)
    for k, v in scores.items():
        writer.writerow([k, v])

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="evaluation.csv"'},
    )


@router.post("/report/pdf")
async def report_pdf(req: MetricsRequest):
    """
    Export evaluation results as PDF.
    """
    if not req.metrics:
        raise HTTPException(400, "Metrics must be non-empty")

    try:
        scores = compute_metrics(req.prediction, req.reference, req.metrics, req.options)
        pdf_bytes = build_pdf(scores, req.meta)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": 'attachment; filename="evaluation.pdf"'},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)}")
