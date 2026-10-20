# Triagem lifecycle tests: iniciar -> salvar -> concluir -> alterar -> excluir (+ prontuário/fila integration)
import os
from datetime import datetime, timezone
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    r = sess.post(f"{API}/auth/login", json={"email": "preceptoria.vet@gmail.com", "password": "VetCare@2026"})
    if r.status_code != 200:
        pytest.skip(f"login failed {r.status_code}")
    sess.headers.update({"Authorization": f"Bearer {r.json()['token']}"})
    return sess


@pytest.fixture(scope="module")
def paciente(s):
    t = s.post(f"{API}/tutores", json={"nome": "TEST_Tutor Triagem", "telefone": "11999999999"})
    assert t.status_code == 200, t.text
    p = s.post(f"{API}/pacientes", json={"tutor_id": t.json()["id"], "nome": "TEST_Pet Triagem", "especie": "canino"})
    assert p.status_code == 200, p.text
    yield p.json()
    s.delete(f"{API}/pacientes/{p.json()['id']}")
    s.delete(f"{API}/tutores/{t.json()['id']}")


def pronts(s, pid):
    return s.get(f"{API}/prontuarios", params={"paciente_id": pid}).json()


# Create: em_andamento, no prontuário, fila -> em_triagem
def test_create_triagem_em_andamento(s, paciente):
    before = len(pronts(s, paciente["id"]))
    f = s.post(f"{API}/fila", json={"paciente_id": paciente["id"], "motivo": "TEST vomito",
                                    "status": "aguardando_triagem"}).json()
    r = s.post(f"{API}/triagem", json={"paciente_id": paciente["id"], "fila_id": f["id"]})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["status"] == "em_andamento" and d["alteracoes"] == [] and d["concluido_at"] == ""
    assert "_id" not in d
    assert len(pronts(s, paciente["id"])) == before
    fila = s.get(f"{API}/fila").json()
    assert next(x for x in fila if x["id"] == f["id"])["status"] == "em_triagem"
    pytest.tri, pytest.fila = d["id"], f["id"]


def test_create_invalid_paciente(s):
    r = s.post(f"{API}/triagem", json={"paciente_id": "nope"})
    assert r.status_code == 400


# Update in-progress: no alteracoes
def test_put_em_andamento_no_history(s):
    r = s.put(f"{API}/triagem/{pytest.tri}", json={"queixa_principal": "TEST vomito", "temperatura": "39.1",
                                                   "status": "concluida"})
    assert r.status_code == 200
    d = r.json()
    assert d["queixa_principal"] == "TEST vomito" and d["temperatura"] == "39.1"
    assert d["status"] == "em_andamento"  # status not writable via PUT
    assert d["alteracoes"] == []


# Concluir: status, prontuário created, fila aguardando_consulta, second time 400
def test_concluir(s, paciente):
    before = len(pronts(s, paciente["id"]))
    r = s.post(f"{API}/triagem/{pytest.tri}/concluir", json={"peso": "12", "prioridade": "urgente"})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["status"] == "concluida" and d["peso"] == "12" and d["prioridade"] == "urgente" and d["concluido_at"]
    pl = pronts(s, paciente["id"])
    assert len(pl) == before + 1
    p = pl[0]
    assert p["origem"] == "triagem" and p["triagem_id"] == pytest.tri and p["status"] == "rascunho"
    assert p["queixa_principal"] == "TEST vomito" and p["temperatura"] == "39.1" and p["peso"] == "12"
    pytest.pront = p["id"]
    fila = s.get(f"{API}/fila").json()
    assert next(x for x in fila if x["id"] == pytest.fila)["status"] == "aguardando_consulta"
    r2 = s.post(f"{API}/triagem/{pytest.tri}/concluir", json={})
    assert r2.status_code == 400


def test_pront_triagem_panel(s):
    r = s.get(f"{API}/prontuarios/{pytest.pront}/triagem")
    assert r.status_code == 200 and r.json()["triagem"]["id"] == pytest.tri


# Alterar concluída: history + audit
def test_put_concluida_registers_history(s):
    r = s.put(f"{API}/triagem/{pytest.tri}", json={"temperatura": "38.5", "peso": "12"})
    d = r.json()
    assert r.status_code == 200 and d["temperatura"] == "38.5"
    assert len(d["alteracoes"]) == 1
    a = d["alteracoes"][0]
    assert a["campos"] == ["temperatura"] and a["anterior"] == {"temperatura": "39.1"} and a["por"] and a["at"]
    # no-op does not add history
    r2 = s.put(f"{API}/triagem/{pytest.tri}", json={"temperatura": "38.5"})
    assert len(r2.json()["alteracoes"]) == 1
    audit = s.get(f"{API}/audit").json()
    assert any(x.get("action", x.get("acao")) == "alterou triagem concluída" or
               "alterou triagem concluída" in str(x) for x in audit[:20])


# Delete: triagem gone, prontuário kept
def test_delete(s, paciente):
    r = s.delete(f"{API}/triagem/{pytest.tri}")
    assert r.status_code == 200 and r.json()["ok"] is True
    assert all(t["id"] != pytest.tri for t in s.get(f"{API}/triagem").json())
    assert any(p["id"] == pytest.pront for p in pronts(s, paciente["id"]))
    r2 = s.get(f"{API}/prontuarios/{pytest.pront}/triagem")
    assert r2.status_code == 200 and (r2.json()["triagem"] is None or r2.json()["triagem"]["id"] != pytest.tri)
    assert s.delete(f"{API}/triagem/{pytest.tri}").status_code == 404
    assert s.put(f"{API}/triagem/{pytest.tri}", json={"fc": "1"}).status_code == 404
    assert s.post(f"{API}/triagem/{pytest.tri}/concluir", json={}).status_code == 404


# Edge: deleting an in-progress triagem leaves fila stuck in em_triagem
def test_delete_em_andamento_fila_status(s, paciente):
    f = s.post(f"{API}/fila", json={"paciente_id": paciente["id"], "status": "aguardando_triagem"}).json()
    t = s.post(f"{API}/triagem", json={"paciente_id": paciente["id"], "fila_id": f["id"]}).json()
    s.delete(f"{API}/triagem/{t['id']}")
    st = next(x for x in s.get(f"{API}/fila").json() if x["id"] == f["id"])["status"]
    s.put(f"{API}/fila/{f['id']}", json={"status": "cancelado"})
    assert st != "em_triagem", "fila stuck in em_triagem after deleting in-progress triagem"


# Agendamento-linked: concluir reuses agendamento rascunho (no new prontuário), panel works
def test_concluir_with_agendamento(s, paciente):
    now = datetime.now(timezone.utc).replace(microsecond=0)
    ag = s.post(f"{API}/agendamentos", json={"paciente_id": paciente["id"], "inicio": now.strftime("%Y-%m-%dT23:00:00"),
                                             "motivo": "TEST consulta"})
    assert ag.status_code == 200, ag.text
    ag = ag.json()
    before = len(pronts(s, paciente["id"]))
    t = s.post(f"{API}/triagem", json={"paciente_id": paciente["id"]}).json()
    assert t["agendamento_id"] == ag["id"]
    s.post(f"{API}/triagem/{t['id']}/concluir", json={"queixa_principal": "TEST tosse"})
    pl = pronts(s, paciente["id"])
    assert len(pl) == before
    pr = next(p for p in pl if p["agendamento_id"] == ag["id"])
    tri = s.get(f"{API}/prontuarios/{pr['id']}/triagem").json()["triagem"]
    assert tri and tri["id"] == t["id"]
    # regression: iniciar atendimento + concluir atendimento
    ini = s.post(f"{API}/agendamentos/{ag['id']}/iniciar")
    assert ini.status_code == 200 and ini.json()["id"] == pr["id"]
    c = s.post(f"{API}/prontuarios/{pr['id']}/concluir", json={"diagnostico": "TEST"})
    assert c.status_code == 200 and c.json()["status"] in ("finalizado", "aguardando_revisao")
    s.delete(f"{API}/triagem/{t['id']}")


# Legacy triagem with no status treated as concluded (concluir -> 400, PUT -> history)
def test_legacy_without_status(s, paciente):
    from pymongo import MongoClient
    from dotenv import load_dotenv
    load_dotenv("/app/backend/.env")
    db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    t = s.post(f"{API}/triagem", json={"paciente_id": paciente["id"]}).json()
    db.triagem.update_one({"id": t["id"]}, {"$unset": {"status": "", "alteracoes": ""}})
    assert s.post(f"{API}/triagem/{t['id']}/concluir", json={}).status_code == 400
    r = s.put(f"{API}/triagem/{t['id']}", json={"fc": "100"})
    assert r.status_code == 200 and len(r.json()["alteracoes"]) == 1
    s.delete(f"{API}/triagem/{t['id']}")
