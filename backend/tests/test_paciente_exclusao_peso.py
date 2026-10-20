# Patient deletion protection, inactivation (ativo), inactive-block on creates, weight series (pesos) in historico
import os
from datetime import datetime, timedelta
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN = {"email": "preceptoria.vet@gmail.com", "password": "VetCare@2026"}
REX_ID = "f84779f0-68bd-44af-9c1e-fe25625df913"
MSG_INATIVO = "Paciente inativo"


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    r = sess.post(f"{API}/auth/login", json=ADMIN)
    if r.status_code != 200:
        pytest.skip(f"login failed {r.status_code}")
    sess.headers.update({"Authorization": f"Bearer {r.json()['token']}"})
    return sess


@pytest.fixture(scope="module")
def tutor(s):
    t = s.post(f"{API}/tutores", json={"nome": "TEST_Tutor Excl", "telefone": "11977776666"}).json()
    yield t
    # patients w/ records can't be deleted; inactivate leftovers
    for p in s.get(f"{API}/pacientes", params={"q": "TEST_Excl", "incluir_inativos": True}).json():
        if s.delete(f"{API}/pacientes/{p['id']}").status_code == 409:
            s.put(f"{API}/pacientes/{p['id']}/ativo", json={"ativo": False})
    s.delete(f"{API}/tutores/{t['id']}")


def novo(s, tutor, nome, **kw):
    r = s.post(f"{API}/pacientes", json={"tutor_id": tutor["id"], "nome": nome, "especie": "canino", **kw})
    assert r.status_code == 200, r.text
    return r.json()


# --- Deletion protection
def test_delete_rex_blocked_409(s):
    r = s.delete(f"{API}/pacientes/{REX_ID}")
    assert r.status_code == 409
    d = r.json()["detail"]
    assert "prontuário(s)" in d and "Inative" in d
    assert s.get(f"{API}/pacientes/{REX_ID}").status_code == 200


def test_delete_clean_patient_ok(s, tutor):
    p = novo(s, tutor, "TEST_Excl Limpo")
    r = s.delete(f"{API}/pacientes/{p['id']}")
    assert r.status_code == 200 and r.json()["ok"] is True
    assert s.get(f"{API}/pacientes/{p['id']}").status_code == 404


def test_delete_404(s):
    assert s.delete(f"{API}/pacientes/nao-existe").status_code == 404


@pytest.mark.parametrize("coll,payload,label", [
    ("exames", {"tipo": "TEST Hemo"}, "exame(s)"),
    ("documentos", {"tipo": "receita", "medicamentos": "TEST x"}, "documento(s)"),
    ("vacinas", {"nome": "TEST V10", "data_aplicacao": "2025-06-15"}, "vacina(s)"),
    ("triagem", {"queixa_principal": "TEST", "peso": "10"}, "triagem(ns)"),
    ("prontuarios", {"motivo": "TEST"}, "prontuário(s)"),
])
def test_delete_blocked_each_record_type(s, tutor, coll, payload, label):
    p = novo(s, tutor, f"TEST_Excl {coll}")
    r = s.post(f"{API}/{coll}", json={"paciente_id": p["id"], **payload})
    assert r.status_code == 200, r.text
    d = s.delete(f"{API}/pacientes/{p['id']}")
    assert d.status_code == 409, d.text
    assert f"1 {label}" in d.json()["detail"]


def test_delete_patient_with_only_agendamento(s, tutor):
    """Spec: patient without records is deleted and its agendamentos/fila removed."""
    p = novo(s, tutor, "TEST_Excl Agenda")
    ini = (datetime.now() + timedelta(days=5)).replace(hour=9, minute=0, second=0, microsecond=0).isoformat(timespec="seconds")
    ag = s.post(f"{API}/agendamentos", json={"paciente_id": p["id"], "inicio": ini, "motivo": "TEST"})
    assert ag.status_code == 200, ag.text
    d = s.delete(f"{API}/pacientes/{p['id']}")
    assert d.status_code == 200, f"agendamento-only patient blocked: {d.status_code} {d.text}"


def test_delete_patient_with_only_fila(s, tutor):
    p = novo(s, tutor, "TEST_Excl Fila")
    f = s.post(f"{API}/fila", json={"paciente_id": p["id"], "motivo": "TEST"})
    assert f.status_code == 200, f.text
    d = s.delete(f"{API}/pacientes/{p['id']}")
    assert d.status_code == 200, d.text
    fila = s.get(f"{API}/fila").json()
    assert not any(x.get("paciente_id") == p["id"] for x in fila)


# --- Inactivation
def test_inactivate_hide_block_reactivate(s, tutor):
    p = novo(s, tutor, "TEST_Excl Inativo", peso="8")
    pid = p["id"]
    r = s.put(f"{API}/pacientes/{pid}/ativo", json={"ativo": False})
    assert r.status_code == 200
    d = r.json()
    assert d["ativo"] is False and d["inativado_at"] and d["inativado_por"]
    assert not any(x["id"] == pid for x in s.get(f"{API}/pacientes").json())
    assert any(x["id"] == pid for x in s.get(f"{API}/pacientes", params={"incluir_inativos": "true"}).json())
    assert any(x["id"] == pid for x in s.get(f"{API}/pacientes", params={"q": "TEST_Excl Inativo", "incluir_inativos": "true"}).json())
    assert not any(x["id"] == pid for x in s.get(f"{API}/pacientes", params={"q": "TEST_Excl Inativo"}).json())
    ini = (datetime.now() + timedelta(days=6)).isoformat(timespec="seconds")
    creates = {
        "agendamentos": {"inicio": ini, "motivo": "TEST"}, "fila": {"motivo": "TEST"},
        "triagem": {"queixa_principal": "TEST"}, "prontuarios": {"motivo": "TEST"},
        "exames": {"tipo": "TEST"}, "vacinas": {"nome": "TEST V"}, "documentos": {"tipo": "receita"},
    }
    for coll, payload in creates.items():
        c = s.post(f"{API}/{coll}", json={"paciente_id": pid, **payload})
        assert c.status_code == 400, f"{coll}: {c.status_code} {c.text}"
        assert MSG_INATIVO in c.json()["detail"], coll
    h = s.get(f"{API}/pacientes/{pid}/historico")
    assert h.status_code == 200 and h.json()["paciente"]["ativo"] is False
    r = s.put(f"{API}/pacientes/{pid}/ativo", json={"ativo": True})
    assert r.json()["ativo"] is True and r.json()["inativado_at"] == ""
    assert any(x["id"] == pid for x in s.get(f"{API}/pacientes").json())
    assert s.delete(f"{API}/pacientes/{pid}").status_code == 200


def test_ativo_404(s):
    assert s.put(f"{API}/pacientes/nao-existe/ativo", json={"ativo": False}).status_code == 404


def test_inactive_existing_agendamento_chegada_iniciar(s, tutor):
    """Pre-existing agendamento of an inactive patient should not allow check-in / iniciar (new records)."""
    p = novo(s, tutor, "TEST_Excl AgInativo")
    ini = (datetime.now() + timedelta(days=7)).replace(hour=11, minute=0, second=0, microsecond=0).isoformat(timespec="seconds")
    ag = s.post(f"{API}/agendamentos", json={"paciente_id": p["id"], "inicio": ini, "motivo": "TEST"}).json()
    s.put(f"{API}/pacientes/{p['id']}/ativo", json={"ativo": False})
    ch = s.post(f"{API}/agendamentos/{ag['id']}/chegada")
    it = s.post(f"{API}/agendamentos/{ag['id']}/iniciar")
    assert ch.status_code == 400 and it.status_code == 400, f"chegada={ch.status_code} iniciar={it.status_code}"


def test_audit_inativou(s, tutor):
    from pymongo import MongoClient
    db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    acoes = {a["action"] for a in db.audit_log.find({"action": {"$in": ["inativou", "reativou"]}}, {"action": 1})}
    assert {"inativou", "reativou"} <= acoes


# --- Weight series
def test_rex_pesos(s):
    h = s.get(f"{API}/pacientes/{REX_ID}/historico").json()
    pesos = h["pesos"]
    assert isinstance(pesos, list) and len(pesos) >= 1
    for x in pesos:
        assert isinstance(x["peso"], float) and x["fonte"] in ("Prontuário", "Triagem", "Cadastro") and x["data_local"]
    assert [x["data_local"] for x in pesos] == sorted(x["data_local"] for x in pesos)


def test_pesos_comma_invalid_sources(s, tutor):
    p = novo(s, tutor, "TEST_Excl Peso", peso="12,5")
    pid = p["id"]
    assert s.post(f"{API}/triagem", json={"paciente_id": pid, "queixa_principal": "T", "peso": "13,2"}).status_code == 200
    assert s.post(f"{API}/triagem", json={"paciente_id": pid, "queixa_principal": "T", "peso": "abc"}).status_code == 200
    assert s.post(f"{API}/prontuarios", json={"paciente_id": pid, "motivo": "T", "peso": "14.75"}).status_code == 200
    assert s.post(f"{API}/prontuarios", json={"paciente_id": pid, "motivo": "T", "peso": ""}).status_code == 200
    pesos = s.get(f"{API}/pacientes/{pid}/historico").json()["pesos"]
    vals = sorted((x["fonte"], x["peso"]) for x in pesos)
    assert vals == sorted([("Cadastro", 12.5), ("Triagem", 13.2), ("Prontuário", 14.75)]), pesos
    hoje = datetime.now().date()
    fut = (hoje + timedelta(days=10)).isoformat()
    assert s.get(f"{API}/pacientes/{pid}/historico", params={"data_ini": fut}).json()["pesos"] == []
    past = (hoje - timedelta(days=10)).isoformat()
    assert len(s.get(f"{API}/pacientes/{pid}/historico", params={"data_fim": past}).json()["pesos"]) == 0
    assert len(s.get(f"{API}/pacientes/{pid}/historico", params={"data_ini": past, "data_fim": fut}).json()["pesos"]) == 3


def test_pesos_empty(s, tutor):
    p = novo(s, tutor, "TEST_Excl SemPeso")
    assert s.get(f"{API}/pacientes/{p['id']}/historico").json()["pesos"] == []
    s.delete(f"{API}/pacientes/{p['id']}")
