STATUS_LABEL = {
    "agendado": "Agendado", "confirmado": "Confirmado", "em_atendimento": "Em atendimento", "concluido": "Concluído",
    "falta": "Falta", "cancelado": "Cancelado", "em_andamento": "Em andamento", "concluida": "Concluída",
    "rascunho": "Rascunho", "aguardando_revisao": "Aguardando revisão", "finalizado": "Finalizado",
    "validado": "Validado", "solicitado": "Solicitado", "coletado": "Coletado",
    "em_processamento": "Em processamento", "emitido": "Emitido", "aplicada": "Aplicada",
}

TIPO_LABEL = {
    "agendamento": "Agenda", "triagem": "Triagem", "prontuario": "Prontuário", "solicitacao": "Solicitação de exames",
    "exame": "Exame", "documento": "Documento", "vacina": "Vacina",
}


from datetime import datetime
from zoneinfo import ZoneInfo

TZ_BR = ZoneInfo("America/Sao_Paulo")


def data_local(iso: str) -> str:
    try:
        dt = datetime.fromisoformat(iso)
    except (ValueError, TypeError):
        return iso or ""
    if dt.tzinfo:
        dt = dt.astimezone(TZ_BR).replace(tzinfo=None)
    return dt.isoformat(timespec="seconds") if len(iso) > 10 else iso


def fmt_br(iso: str) -> str:
    loc = data_local(iso)
    return f"{loc[8:10]}/{loc[5:7]}/{loc[:4]} {loc[11:16]}".strip() if len(loc) >= 10 else ""


def _vitais(r: dict) -> str:
    itens = [("temperatura", "T", " °C"), ("fc", "FC", " bpm"), ("fr", "FR", " mpm"), ("peso", "Peso", " kg")]
    return " · ".join(f"{lb} {r[k]}{u}" for k, lb, u in itens if r.get(k))


def _campos(pares: list) -> list:
    return [[k, str(v)] for k, v in pares if v not in (None, "", False)]


def _ev(tipo: str, r: dict, data: str, titulo: str, status: str, campos: list, **extra) -> dict:
    data = data or r.get("created_at", "")
    return {"tipo": tipo, "id": r["id"], "data": data, "data_local": data_local(data), "titulo": titulo,
            "status": status, "status_label": STATUS_LABEL.get(status, status), "campos": _campos(campos),
            "paciente_codigo": r.get("paciente_codigo"), **extra}


def build_eventos(fontes: dict) -> list:
    ev = []
    for a in fontes.get("agendamentos", []):
        ev.append(_ev("agendamento", a, a.get("inicio"), f"Atendimento agendado — {a.get('tipo') or 'consulta'}",
                      a.get("status", ""), [("Motivo", a.get("motivo")), ("Profissional", a.get("profissional_nome")),
                                            ("Sala", a.get("sala")), ("Chegada", fmt_br(a.get("chegada_at")))]))
    for t in fontes.get("triagem", []):
        ev.append(_ev("triagem", t, t.get("created_at"), f"Triagem — prioridade {t.get('prioridade') or 'normal'}",
                      t.get("status") or "concluida",
                      [("Queixa", t.get("queixa_principal")), ("Início dos sinais", t.get("inicio_sinais")),
                       ("Sinais vitais", _vitais(t)), ("Dor", t.get("dor")), ("Hidratação", t.get("hidratacao")),
                       ("Histórico", t.get("historico")), ("Sinais de alerta", t.get("sinais_alerta")),
                       ("Observações", t.get("observacoes")), ("Responsável", t.get("responsavel"))],
                      prioridade=t.get("prioridade") or "normal"))
    for p in fontes.get("prontuarios", []):
        ev.append(_ev("prontuario", p, p.get("created_at"),
                      f"Prontuário — {p.get('diagnostico') or p.get('queixa_principal') or p.get('motivo') or 'Consulta'}",
                      p.get("status", ""),
                      [("Motivo", p.get("motivo")), ("Queixa principal", p.get("queixa_principal")),
                       ("Anamnese", p.get("anamnese")), ("Sinais vitais", _vitais(p)), ("Exame físico", p.get("exame_fisico")),
                       ("Hipóteses", p.get("hipoteses")), ("Diagnóstico", p.get("diagnostico")),
                       ("Plano terapêutico", p.get("plano_terapeutico")), ("Prescrições", p.get("prescricoes")),
                       ("Orientações", p.get("orientacoes")), ("Retorno", p.get("retorno")),
                       ("Profissional", p.get("profissional_nome")), ("Revisado por", p.get("revisado_por"))],
                      prontuario_id=p["id"]))
        if p.get("exames_solicitados"):
            ev.append(_ev("solicitacao", {**p, "id": f"{p['id']}-sol"}, p.get("created_at"), "Solicitação de exames (prontuário)",
                          "solicitado", [("Exames solicitados", p.get("exames_solicitados")),
                                         ("Solicitante", p.get("profissional_nome"))], prontuario_id=p["id"]))
    for x in fontes.get("exames", []):
        ev.append(_ev("exame", x, x.get("created_at"), f"Exame — {x.get('tipo', '')}", x.get("status", ""),
                      [("Categoria", x.get("categoria")), ("Laboratório", x.get("laboratorio")),
                       ("Data da coleta", x.get("data_coleta")), ("Resultado", x.get("resultado")),
                       ("Observações", x.get("observacoes")), ("Solicitante", x.get("solicitante"))],
                      critico=bool(x.get("critico")), laudo_path=x.get("laudo_path", ""),
                      prontuario_id=x.get("prontuario_id", "")))
    for d in fontes.get("documentos", []):
        ev.append(_ev("documento", d, d.get("created_at"), d.get("titulo") or "Documento", "emitido",
                      [("Prescrição", d.get("medicamentos")), ("Conteúdo", d.get("corpo")),
                       ("Profissional", d.get("profissional_nome"))],
                      pdf_path=d.get("pdf_path", ""), prontuario_id=d.get("prontuario_id", "")))
    for v in fontes.get("vacinas", []):
        rotulo = "Vacina" if (v.get("tipo") or "vacina") == "vacina" else str(v.get("tipo")).capitalize()
        ev.append(_ev("vacina", v, v.get("data_aplicacao") or v.get("created_at"), f"{rotulo} — {v.get('nome', '')}",
                      "aplicada", [("Dose", v.get("dose")), ("Fabricante", v.get("fabricante")), ("Lote", v.get("lote")),
                                   ("Via", v.get("via")), ("Próxima dose", v.get("proxima_dose")),
                                   ("Reações", v.get("reacoes")), ("Observações", v.get("observacoes")),
                                   ("Responsável", v.get("responsavel") or v.get("aplicador"))]))
    ev.sort(key=lambda e: e["data_local"], reverse=True)
    return ev
