from io import BytesIO
from datetime import datetime
from zoneinfo import ZoneInfo

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


TZ_BR = ZoneInfo("America/Sao_Paulo")


def _fmt_data(iso: str) -> str:
    try:
        dt = datetime.fromisoformat(iso)
    except (ValueError, TypeError):
        return iso or "—"
    if len(iso) <= 10:
        return dt.strftime("%d/%m/%Y")
    if dt.tzinfo:
        dt = dt.astimezone(TZ_BR)
    return dt.strftime("%d/%m/%Y %H:%M")


def _cabecalho(el: list, clinic: dict, logo_bytes: bytes, ss) -> None:
    if logo_bytes:
        try:
            img = Image(BytesIO(logo_bytes))
            iw, ih = img.imageWidth, img.imageHeight
            if ih > 0:
                img.drawHeight = 18 * mm
                img.drawWidth = 18 * mm * iw / ih
            img.hAlign = "CENTER"
            el.append(img)
            el.append(Spacer(1, 4))
        except Exception:
            pass
    el.append(Paragraph(clinic.get("nome", "Clínica Veterinária"),
                        ParagraphStyle("hcn", parent=ss["Title"], fontSize=15, textColor=PRIMARY, spaceAfter=2, alignment=TA_CENTER)))
    linha2 = " · ".join([x for x in [clinic.get("endereco", ""), clinic.get("telefone", "")] if x])
    if linha2:
        el.append(Paragraph(linha2, ParagraphStyle("hcs", parent=ss["Normal"], fontSize=8.5, textColor=MUTED, alignment=TA_CENTER)))
    el.append(Spacer(1, 5))
    el.append(HRFlowable(width="100%", thickness=1.2, color=PRIMARY))


def build_historico_pdf(paciente: dict, tutor: dict, eventos: list, clinic: dict, logo_bytes: bytes = None,
                        periodo: str = "", emitido_por: str = "") -> bytes:
    from historico import TIPO_LABEL
    buf = BytesIO()
    titulo_doc = f"Histórico Clínico — {paciente.get('nome', '')} (Nº {paciente.get('codigo', '—')})"
    pdf = SimpleDocTemplate(buf, pagesize=A4, topMargin=14 * mm, bottomMargin=14 * mm,
                            leftMargin=16 * mm, rightMargin=16 * mm, title=titulo_doc)
    ss = getSampleStyleSheet()
    title = ParagraphStyle("hti", parent=ss["Heading1"], fontSize=13, alignment=TA_CENTER, spaceBefore=8, spaceAfter=8)
    label = ParagraphStyle("hlb", parent=ss["Normal"], fontSize=8, textColor=MUTED)
    val = ParagraphStyle("hvl", parent=ss["Normal"], fontSize=9.5, leading=12)
    ev_t = ParagraphStyle("het", parent=ss["Normal"], fontSize=10, leading=13, textColor=colors.HexColor("#0f172a"))
    ev_m = ParagraphStyle("hem", parent=ss["Normal"], fontSize=8, textColor=MUTED)
    small = ParagraphStyle("hsm", parent=ss["Normal"], fontSize=8.5, leading=11)
    foot = ParagraphStyle("hft", parent=ss["Normal"], fontSize=7.5, textColor=MUTED, alignment=TA_CENTER)

    el = []
    _cabecalho(el, clinic, logo_bytes, ss)
    el.append(Paragraph("Histórico Clínico do Paciente", title))
    pinfo = " / ".join([x for x in [paciente.get("especie", ""), paciente.get("raca", ""), paciente.get("sexo", "")] if x]) or "—"
    info = [
        [Paragraph("PACIENTE", label), Paragraph(f"<b>{paciente.get('nome', '')}</b> (Nº {paciente.get('codigo', '—')})", val),
         Paragraph("TUTOR(A)", label), Paragraph(f"{tutor.get('nome', '—')} (Nº {tutor.get('codigo', '—')})", val)],
        [Paragraph("ESPÉCIE / RAÇA / SEXO", label), Paragraph(pinfo, val),
         Paragraph("CONTATO", label), Paragraph(tutor.get("telefone", "") or "—", val)],
        [Paragraph("ALERGIAS / ALERTAS", label),
         Paragraph(_br(" · ".join([x for x in [paciente.get("alergias", ""), paciente.get("alertas", "")] if x])) or "—", val),
         Paragraph("PERÍODO", label), Paragraph(periodo or "Todo o histórico", val)],
    ]
    t = Table(info, colWidths=[30 * mm, 60 * mm, 22 * mm, 66 * mm])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"), ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f1f5f4")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")), ("INNERGRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#e2e8f0")),
        ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    el.append(t)
    el.append(Spacer(1, 10))
    el.append(Paragraph(f"<b>{len(eventos)}</b> registro(s) em ordem cronológica (mais recente primeiro)", ev_m))
    el.append(Spacer(1, 6))

    for e in eventos:
        cab = f"<b>{e['titulo']}</b>"
        meta = f"{_fmt_data(e['data'])} · {TIPO_LABEL.get(e['tipo'], e['tipo'])} · {e.get('status_label', '')}"
        if e.get("critico"):
            meta += " · <font color='#be123c'><b>CRÍTICO</b></font>"
        rows = [[Paragraph(cab, ev_t)], [Paragraph(meta, ev_m)]]
        for k, v in e.get("campos", []):
            rows.append([Paragraph(f"<b>{k}:</b> {_br(v)}", small)])
        bloco = Table(rows, colWidths=[178 * mm])
        bloco.setStyle(TableStyle([
            ("LINEBEFORE", (0, 0), (0, -1), 2.2, PRIMARY), ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 1.5), ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5),
        ]))
        el.append(bloco)
        el.append(Spacer(1, 7))

    if not eventos:
        el.append(Paragraph("Nenhum registro no período selecionado.", small))
    el.append(Spacer(1, 12))
    el.append(Paragraph(f"Emitido em {datetime.now(TZ_BR).strftime('%d/%m/%Y %H:%M')} por {emitido_por} — {clinic.get('nome', '')}", foot))
    pdf.build(el)
    return buf.getvalue()


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
