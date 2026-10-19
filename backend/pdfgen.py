from io import BytesIO
from datetime import datetime

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_RIGHT
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable, Table, TableStyle, Image

TIPO_TITULO = {
    "receita": "Receituário Veterinário",
    "atestado": "Atestado Médico-Veterinário",
    "declaracao": "Declaração de Comparecimento",
    "orientacao": "Orientações ao Tutor",
    "encaminhamento": "Encaminhamento",
    "relatorio": "Relatório Clínico",
    "alta": "Recomendações de Alta",
}

PRIMARY = colors.HexColor("#165b4c")
MUTED = colors.HexColor("#64748b")


def _br(text: str) -> str:
    return (text or "").replace("\n", "<br/>").strip()


def build_documento_pdf(doc: dict, clinic: dict, logo_bytes: bytes = None) -> bytes:
    buf = BytesIO()
    pdf = SimpleDocTemplate(buf, pagesize=A4, topMargin=16 * mm, bottomMargin=16 * mm,
                            leftMargin=20 * mm, rightMargin=20 * mm, title=TIPO_TITULO.get(doc["tipo"], "Documento"))
    ss = getSampleStyleSheet()
    clinic_name = ParagraphStyle("cn", parent=ss["Title"], fontSize=17, textColor=PRIMARY, spaceAfter=2, alignment=TA_CENTER)
    clinic_sub = ParagraphStyle("cs", parent=ss["Normal"], fontSize=9, textColor=MUTED, alignment=TA_CENTER, spaceAfter=1)
    title = ParagraphStyle("ti", parent=ss["Heading1"], fontSize=14, textColor=colors.HexColor("#0f172a"), alignment=TA_CENTER, spaceBefore=10, spaceAfter=10)
    label = ParagraphStyle("lb", parent=ss["Normal"], fontSize=8.5, textColor=MUTED)
    val = ParagraphStyle("vl", parent=ss["Normal"], fontSize=10.5, textColor=colors.HexColor("#0f172a"))
    body = ParagraphStyle("bd", parent=ss["Normal"], fontSize=11, leading=17, alignment=TA_JUSTIFY, spaceBefore=4)
    sign = ParagraphStyle("sg", parent=ss["Normal"], fontSize=10, alignment=TA_CENTER)
    foot = ParagraphStyle("ft", parent=ss["Normal"], fontSize=8, textColor=MUTED, alignment=TA_CENTER)

    el = []
    if logo_bytes:
        try:
            img = Image(BytesIO(logo_bytes))
            iw, ih = img.imageWidth, img.imageHeight
            if ih > 0:
                img.drawHeight = 22 * mm
                img.drawWidth = 22 * mm * iw / ih
            img.hAlign = "CENTER"
            el.append(img)
            el.append(Spacer(1, 6))
        except Exception:
            pass
    el.append(Paragraph(clinic.get("nome", "Clínica Veterinária"), clinic_name))
    linha2 = " · ".join([x for x in [clinic.get("endereco", ""), clinic.get("telefone", "")] if x])
    if linha2:
        el.append(Paragraph(linha2, clinic_sub))
    if clinic.get("cnpj"):
        el.append(Paragraph(f"CNPJ: {clinic['cnpj']}", clinic_sub))
    el.append(Spacer(1, 6))
    el.append(HRFlowable(width="100%", thickness=1.2, color=PRIMARY))
    el.append(Paragraph(TIPO_TITULO.get(doc["tipo"], "Documento"), title))

    info = [
        [Paragraph("PACIENTE", label), Paragraph(doc.get("paciente_nome", "—"), val),
         Paragraph("TUTOR(A)", label), Paragraph(doc.get("tutor_nome", "—"), val)],
        [Paragraph("ESPÉCIE / RAÇA", label), Paragraph(doc.get("paciente_info", "—"), val),
         Paragraph("DATA", label), Paragraph(doc.get("data_fmt", "—"), val)],
    ]
    t = Table(info, colWidths=[32 * mm, 54 * mm, 28 * mm, 54 * mm])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f1f5f4")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#e2e8f0")),
        ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]))
    el.append(t)
    el.append(Spacer(1, 14))

    if doc["tipo"] == "receita" and doc.get("medicamentos"):
        el.append(Paragraph("<b>Prescrição</b>", val))
        el.append(Spacer(1, 4))
        el.append(Paragraph(_br(doc["medicamentos"]), body))
        el.append(Spacer(1, 8))

    if doc.get("corpo"):
        el.append(Paragraph(_br(doc["corpo"]), body))

    el.append(Spacer(1, 40))
    el.append(HRFlowable(width="55%", thickness=0.8, color=colors.HexColor("#334155")))
    el.append(Spacer(1, 3))
    el.append(Paragraph(f"<b>{doc.get('profissional_nome', '')}</b>", sign))
    if doc.get("conselho"):
        el.append(Paragraph(f"Médico(a)-Veterinário(a) · {doc['conselho']}", foot))
    el.append(Spacer(1, 18))
    el.append(Paragraph(f"Documento emitido em {doc.get('data_fmt', '')} — {clinic.get('nome', '')}", foot))

    pdf.build(el)
    return buf.getvalue()
