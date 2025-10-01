# backend/app/services/reports/pdf.py
# Windows-friendly PDF builder (no GTK/WeasyPrint needed)

from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet

def build_pdf(rows, meta) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=36, rightMargin=36, topMargin=36, bottomMargin=36)
    styles = getSampleStyleSheet()
    story = []

    story.append(Paragraph("Evaluation Report", styles["Title"]))
    if meta:
        story.append(Paragraph(f"<b>Model:</b> {meta.get('model','')}", styles["Normal"]))
        story.append(Paragraph(f"<b>Params:</b> {meta.get('params','')}", styles["Normal"]))
    story.append(Spacer(1, 12))

    if rows:
        headers = list(rows[0].keys())
        data = [headers] + [[r.get(k, "") for k in headers] for r in rows]
        table = Table(data, repeatRows=1)
        table.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#f0f0f0")),
            ("GRID", (0,0), (-1,-1), 0.5, colors.grey),
            ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
            ("ALIGN", (0,0), (-1,0), "CENTER"),
            ("VALIGN", (0,0), (-1,-1), "TOP"),
        ]))
        story.append(table)

    doc.build(story)
    return buf.getvalue()
