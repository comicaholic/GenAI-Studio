# backend/app/services/reports/pdf.py
# Windows-friendly PDF builder (no GTK/WeasyPrint needed)

from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import inch
from typing import List, Dict, Any

def build_pdf(rows: List[Dict[str, Any]], meta: Dict[str, Any] = None) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=36, rightMargin=36, topMargin=36, bottomMargin=36)
    styles = getSampleStyleSheet()
    story = []

    # Title
    story.append(Paragraph("GenAI Studio - Evaluation Report", styles["Title"]))
    story.append(Spacer(1, 12))

    # Meta information if provided
    if meta:
        story.append(Paragraph("<b>Report Information</b>", styles["Heading2"]))
        for key, value in meta.items():
            if value:
                story.append(Paragraph(f"<b>{key.replace('_', ' ').title()}:</b> {value}", styles["Normal"]))
        story.append(Spacer(1, 12))

    if rows:
        # Process each row
        for i, row in enumerate(rows):
            if i > 0:
                story.append(PageBreak())
            
            # Row title
            title = row.get('title', f'Evaluation {i+1}')
            story.append(Paragraph(f"<b>{title}</b>", styles["Heading2"]))
            story.append(Spacer(1, 12))

            # Model and Parameters section
            if any(key in row for key in ['model_id', 'model_provider', 'temperature', 'max_tokens']):
                story.append(Paragraph("<b>Model Configuration</b>", styles["Heading3"]))
                
                model_info = []
                if 'model_id' in row and row['model_id']:
                    model_info.append(f"<b>Model ID:</b> {row['model_id']}")
                if 'model_provider' in row and row['model_provider']:
                    model_info.append(f"<b>Provider:</b> {row['model_provider']}")
                if 'temperature' in row and row['temperature'] is not None:
                    model_info.append(f"<b>Temperature:</b> {row['temperature']}")
                if 'max_tokens' in row and row['max_tokens'] is not None:
                    model_info.append(f"<b>Max Tokens:</b> {row['max_tokens']}")
                if 'top_p' in row and row['top_p'] is not None:
                    model_info.append(f"<b>Top P:</b> {row['top_p']}")
                if 'top_k' in row and row['top_k'] is not None:
                    model_info.append(f"<b>Top K:</b> {row['top_k']}")
                
                if model_info:
                    story.append(Paragraph("<br/>".join(model_info), styles["Normal"]))
                story.append(Spacer(1, 12))

            # Files used section
            if any(key in row for key in ['prompt_file', 'reference_file', 'source_file']):
                story.append(Paragraph("<b>Files Used</b>", styles["Heading3"]))
                
                files_info = []
                if 'prompt_file' in row and row['prompt_file']:
                    files_info.append(f"<b>Prompt File:</b> {row['prompt_file']}")
                if 'reference_file' in row and row['reference_file']:
                    files_info.append(f"<b>Reference File:</b> {row['reference_file']}")
                if 'source_file' in row and row['source_file']:
                    files_info.append(f"<b>Source File:</b> {row['source_file']}")
                
                if files_info:
                    story.append(Paragraph("<br/>".join(files_info), styles["Normal"]))
                story.append(Spacer(1, 12))

            # Metrics/Results section
            metrics_keys = ['rouge', 'bleu', 'f1', 'em', 'bertscore']
            metrics_data = {k: v for k, v in row.items() if k in metrics_keys and v is not None}
            
            if metrics_data:
                story.append(Paragraph("<b>Evaluation Results</b>", styles["Heading3"]))
                
                # Create metrics table
                metrics_table_data = [["Metric", "Score"]]
                for metric, score in metrics_data.items():
                    metrics_table_data.append([metric.upper(), f"{score:.4f}" if isinstance(score, (int, float)) else str(score)])
                
                metrics_table = Table(metrics_table_data, colWidths=[2*inch, 1.5*inch])
                metrics_table.setStyle(TableStyle([
                    ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#f0f0f0")),
                    ("GRID", (0,0), (-1,-1), 0.5, colors.grey),
                    ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
                    ("ALIGN", (0,0), (-1,-1), "CENTER"),
                    ("VALIGN", (0,0), (-1,-1), "TOP"),
                ]))
                story.append(metrics_table)
                story.append(Spacer(1, 12))

            # Text content sections
            text_sections = [
                ('prompt_text', 'Prompt Text'),
                ('reference_text', 'Reference Text'),
                ('llm_output', 'LLM Output'),
                ('ocr_text', 'OCR Text')
            ]
            
            for key, title in text_sections:
                if key in row and row[key]:
                    story.append(Paragraph(f"<b>{title}</b>", styles["Heading3"]))
                    # Truncate very long text for PDF
                    text = str(row[key])
                    if len(text) > 2000:
                        text = text[:2000] + "... [truncated]"
                    story.append(Paragraph(text.replace('\n', '<br/>'), styles["Normal"]))
                    story.append(Spacer(1, 12))

            # Timestamp
            if 'evaluation_timestamp' in row and row['evaluation_timestamp']:
                story.append(Paragraph(f"<b>Generated:</b> {row['evaluation_timestamp']}", styles["Normal"]))

    doc.build(story)
    return buf.getvalue()
