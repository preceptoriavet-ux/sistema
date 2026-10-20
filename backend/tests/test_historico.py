# Patient timeline (linha do tempo) tests: /pacientes/{pid}/historico, filtros, PDF, /pacientes/codigo/{n}, RBAC
import os
import uuid
from datetime import datetime, timedelta, timezone
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN = {"email": "preceptoria.vet@gmail.com", "password": "VetCare@2026"}
TIPOS = {"agendamento", "triagem", "prontuario", "solicitacao", "exame", "documento", "vacina"}


def login(email, password):
    sess = requests.Session()
    r = sess.post(f"{API}/auth/login", json={"email": email, "password": password})
    if r.status_code != 200:
        pytest.skip(f"login failed {r.status_code} {r.text}")
    sess.headers.update({"Authorization": f"Bearer {r.json()['token']}"})
    return sess


@pytest.fixture(scope="module")
def s():
    return login(**ADMIN)


@pytest.fixture(scope="module")
def setup(s):
    t = s.post(f"{API}/tutores", json={"nome": "TEST_Tutor Hist", "telefone": "11988887777"}).json()
    p = s.post(f"{API}/pacientes", json={"tutor_id": t["id"], "nome": "TEST_Pet Hist", "especie": "canino",
                                         "alergias": "Dipirona", "alertas": "Agressivo"}).json()
    pid = p["id"]
    ids = {}
    ini = (datetime.now() + timedelta(days=3)).replace(hour=10, minute=0, second=0, microsecond=0).isoformat(timespec="seconds")
    ag = s.post(f"{API}/agendamentos", json={"paciente_id": pid, "inicio": ini, "motivo": "TEST consulta"})
    assert ag.status_code == 200, ag.text
    ids["agendamento"] = ag.json()
    pr = s.post(f"{API}/prontuarios", json={"paciente_id": pid, "motivo": "TEST motivo", "diagnostico": "TEST gastrite",
                                            "exames_solicitados": "Hemograma, Bioquímico"})
    assert pr.status_code == 200, pr.text
    ids["prontuario"] = pr.json()
    ex = s.post(f"{API}/exames", json={"paciente_id": pid, "tipo": "TEST Hemograma", "prontuario_id": pr.json()["id"]})
    assert ex.status_code == 200, ex.text
    ids["exame"] = ex.json()
    dc = s.post(f"{API}/documentos", json={"paciente_id": pid, "tipo": "receita", "medicamentos": "TEST amoxicilina"})
    assert dc.status_code == 200, dc.text
    ids["documento"] = dc.json()
    vc = s.post(f"{API}/vacinas", json={"paciente_id": pid, "nome": "TEST V10", "data_aplicacao": "2025-06-15"})
    assert vc.status_code == 200, vc.text
    ids["vacina"] = vc.json()
    tr = s.post(f"{API}/triagem", json={"paciente_id": pid, "queixa_principal": "TEST vomito", "temperatura": "39"})
    assert tr.status_code == 200, tr.text
    ids["triagem"] = tr.json()
    yield {"p": p, "t": t, "ids": ids}
    s.delete(f"{API}/agendamentos/{ag.json()['id']}")
    s.delete(f"{API}/triagem/{tr.json()['id']}")
    s.delete(f"{API}/pacientes/{pid}")
    s.delete(f"{API}/tutores/{t['id']}")


# New records persist paciente_codigo
def test_new_records_have_paciente_codigo(setup):
    cod = setup["p"]["codigo"]
    assert isinstance(cod, int)
    for k, d in setup["ids"].items():
        assert d.get("paciente_codigo") == cod, f"{k} sem paciente_codigo: {d.get('paciente_codigo')}"


# Historico structure + all event types + sort
def test_historico_structure(s, setup):
    r = s.get(f"{API}/pacientes/{setup['p']['id']}/historico")
    assert r.status_code == 200, r.text
    d = r.json()
    assert set(d) >= {"paciente", "tutor", "eventos", "contadores"}
    assert d["paciente"]["id"] == setup["p"]["id"] and d["tutor"]["id"] == setup["t"]["id"]
    tipos = {e["tipo"] for e in d["eventos"]}
    assert tipos == TIPOS, tipos
    for e in d["eventos"]:
        for k in ("titulo", "status_label", "campos", "paciente_codigo", "data_local", "id"):
            assert k in e, (k, e)
        assert e["paciente_codigo"] == setup["p"]["codigo"], e
        assert all(isinstance(c, list) and len(c) == 2 for c in e["campos"])
    dl = [e["data_local"] for e in d["eventos"]]
    assert dl == sorted(dl, reverse=True)
    assert sum(d["contadores"].values()) == len(d["eventos"])
    sol = [e for e in d["eventos"] if e["tipo"] == "solicitacao"][0]
    assert sol["prontuario_id"] == setup["ids"]["prontuario"]["id"]
    assert any("Hemograma" in v for _, v in sol["campos"])
    doc = [e for e in d["eventos"] if e["tipo"] == "documento"][0]
    assert doc["pdf_path"]


# data_local is Brasília time (UTC-3) for UTC timestamps
def test_data_local_brasilia(s, setup):
    d = s.get(f"{API}/pacientes/{setup['p']['id']}/historico", params={"tipos": "prontuario"}).json()
    e = d["eventos"][0]
    utc = datetime.fromisoformat(e["data"])
    loc = datetime.fromisoformat(e["data_local"])
    assert utc.tzinfo is not None
    assert (utc.replace(tzinfo=None, microsecond=0) - loc) == timedelta(hours=3)


# Tipo filter keeps contadores unfiltered
def test_filtro_tipos(s, setup):
    full = s.get(f"{API}/pacientes/{setup['p']['id']}/historico").json()
    r = s.get(f"{API}/pacientes/{setup['p']['id']}/historico", params={"tipos": "prontuario,exame"}).json()
    assert {e["tipo"] for e in r["eventos"]} == {"prontuario", "exame"}
    assert r["contadores"] == full["contadores"]


# Date filters
def test_filtro_datas(s, setup):
    pid = setup["p"]["id"]
    r = s.get(f"{API}/pacientes/{pid}/historico", params={"data_ini": "2025-06-15", "data_fim": "2025-06-15"}).json()
    assert [e["tipo"] for e in r["eventos"]] == ["vacina"]
    fut = (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d")
    r2 = s.get(f"{API}/pacientes/{pid}/historico", params={"data_ini": fut}).json()
    assert {e["tipo"] for e in r2["eventos"]} == {"agendamento"}
    r3 = s.get(f"{API}/pacientes/{pid}/historico", params={"data_fim": "2025-12-31"}).json()
    assert all(e["data_local"][:10] <= "2025-12-31" for e in r3["eventos"])


def test_historico_404(s):
    r = s.get(f"{API}/pacientes/{uuid.uuid4()}/historico")
    assert r.status_code == 404


# Lookup by codigo
def test_paciente_por_codigo(s, setup):
    r = s.get(f"{API}/pacientes/codigo/{setup['p']['codigo']}")
    assert r.status_code == 200 and r.json()["id"] == setup["p"]["id"]
    r2 = s.get(f"{API}/pacientes/codigo/999999")
    assert r2.status_code == 404 and "999999" in r2.json()["detail"]
    r3 = s.get(f"{API}/pacientes/codigo/abc")
    assert r3.status_code == 422


# PDF with filters
def test_historico_pdf(s, setup):
    pid = setup["p"]["id"]
    r = s.get(f"{API}/pacientes/{pid}/historico/pdf")
    assert r.status_code == 200 and r.headers["content-type"].startswith("application/pdf")
    assert r.content[:4] == b"%PDF"
    r2 = s.get(f"{API}/pacientes/{pid}/historico/pdf", params={"tipos": "vacina", "data_ini": "2025-01-01", "data_fim": "2025-12-31"})
    assert r2.status_code == 200 and r2.content[:4] == b"%PDF"
    assert len(r2.content) < len(r.content)
    r3 = s.get(f"{API}/pacientes/{pid}/historico/pdf", params={"tipos": "exame", "data_ini": "2000-01-01", "data_fim": "2000-01-02"})
    assert r3.status_code == 200 and r3.content[:4] == b"%PDF"


def test_requires_auth(setup):
    r = requests.get(f"{API}/pacientes/{setup['p']['id']}/historico")
    assert r.status_code in (401, 403)


# Old records backfilled (Rex Nº 1)
def test_backfill_existing(s):
    r = s.get(f"{API}/pacientes/codigo/1")
    if r.status_code != 200:
        pytest.skip("no paciente Nº1")
    d = s.get(f"{API}/pacientes/{r.json()['id']}/historico").json()
    assert d["eventos"]
    assert all(e["paciente_codigo"] == 1 for e in d["eventos"]), [e for e in d["eventos"] if e["paciente_codigo"] != 1][:2]


# RBAC: financeiro sees only agenda; recepcionista sees no documentos? (has prontuario:read -> sees)
@pytest.mark.parametrize("role,expected", [("financeiro", {"agendamento"}),
                                           ("estoque", {"vacina"})])
def test_rbac(s, setup, role, expected):
    email = f"test_{role}_{uuid.uuid4().hex[:6]}@example.com"
    r = s.post(f"{API}/users", json={"name": f"TEST {role}", "email": email, "password": "Teste@1234", "role": role})
    assert r.status_code == 200, r.text
    u = login(email, "Teste@1234")
    h = u.get(f"{API}/pacientes/{setup['p']['id']}/historico")
    assert h.status_code == 200, h.text
    tipos = {e["tipo"] for e in h.json()["eventos"]}
    assert tipos == expected, tipos
    assert set(h.json()["contadores"]) == expected
    pdf = u.get(f"{API}/pacientes/{setup['p']['id']}/historico/pdf")
    assert pdf.status_code == 200
    s.put(f"{API}/users/{r.json()['id']}", json={"active": False})
