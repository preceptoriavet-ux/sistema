# Document templates (modelos de documento) CRUD/RBAC + emission tipo=modelo + variables + timeline
import os
import uuid
import pytest
import requests
import pymupdf

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN = {"email": "preceptoria.vet@gmail.com", "password": "VetCare@2026"}


def login(email, password):
    sess = requests.Session()
    r = sess.post(f"{API}/auth/login", json={"email": email, "password": password})
    if r.status_code != 200:
        pytest.skip(f"login failed {r.status_code} {r.text}")
    sess.headers.update({"Authorization": f"Bearer {r.json()['token']}"})
    sess.token = r.json()["token"]
    return sess


def pdf_text(s, path):
    r = s.get(f"{API}/files/{path}")
    assert r.status_code == 200, r.text
    assert r.content[:4] == b"%PDF"
    d = pymupdf.open(stream=r.content, filetype="pdf")
    return " ".join(p.get_text() for p in d)


@pytest.fixture(scope="module")
def s():
    return login(**ADMIN)


@pytest.fixture(scope="module")
def ctx(s):
    t = s.post(f"{API}/tutores", json={"nome": "TEST_Tutor Modelo", "telefone": "11977776666"}).json()
    p = s.post(f"{API}/pacientes", json={"tutor_id": t["id"], "nome": "TEST_Pet Modelo", "especie": "felino",
                                         "raca": "Siamês"}).json()
    m = s.post(f"{API}/modelos-documento", json={
        "titulo": "TEST_Termo Modelo",
        "conteudo": "Paciente {paciente} Nº {nº paciente} ({espécie}/{raça}) tutor {tutor} em {data} por {veterinario}. {desconhecida}"})
    assert m.status_code == 200, m.text
    data = {"t": t, "p": p, "m": m.json(), "users": []}
    yield data
    for x in s.get(f"{API}/modelos-documento").json():
        if x["titulo"].startswith("TEST_"):
            s.delete(f"{API}/modelos-documento/{x['id']}")
    for uid in data["users"]:
        s.put(f"{API}/users/{uid}", json={"active": False})


class TestModelosCRUD:
    def test_create_and_list(self, s, ctx):
        m = ctx["m"]
        assert m["titulo"] == "TEST_Termo Modelo" and isinstance(m["id"], str) and "_id" not in m
        lst = s.get(f"{API}/modelos-documento").json()
        assert any(x["id"] == m["id"] for x in lst)

    @pytest.mark.parametrize("body", [{"titulo": "", "conteudo": "x"}, {"titulo": "TEST_x", "conteudo": "  "}, {}])
    def test_required_fields(self, s, body):
        r = s.post(f"{API}/modelos-documento", json=body)
        assert r.status_code == 400, r.text

    def test_update_persist_and_delete(self, s):
        r = s.post(f"{API}/modelos-documento", json={"titulo": "TEST_Del", "conteudo": "abc"})
        mid = r.json()["id"]
        u = s.put(f"{API}/modelos-documento/{mid}", json={"titulo": "TEST_Del2", "conteudo": "def"})
        assert u.status_code == 200 and u.json()["titulo"] == "TEST_Del2" and u.json()["conteudo"] == "def"
        assert s.put(f"{API}/modelos-documento/{mid}", json={"titulo": "", "conteudo": "x"}).status_code == 400
        got = [x for x in s.get(f"{API}/modelos-documento").json() if x["id"] == mid][0]
        assert got["titulo"] == "TEST_Del2"
        assert s.delete(f"{API}/modelos-documento/{mid}").status_code == 200
        assert not any(x["id"] == mid for x in s.get(f"{API}/modelos-documento").json())
        assert s.delete(f"{API}/modelos-documento/{mid}").status_code == 404

    def test_put_nonexistent_404(self, s):
        r = s.put(f"{API}/modelos-documento/{uuid.uuid4()}", json={"titulo": "TEST_x", "conteudo": "y"})
        assert r.status_code == 404

    @pytest.mark.parametrize("role,get_code", [("recepcionista", 200), ("financeiro", 403)])
    def test_rbac(self, s, ctx, role, get_code):
        email = f"test_{role}_{uuid.uuid4().hex[:6]}@example.com"
        r = s.post(f"{API}/users", json={"name": f"TEST {role}", "email": email, "password": "Teste@1234", "role": role})
        assert r.status_code == 200, r.text
        ctx["users"].append(r.json()["id"])
        u = login(email, "Teste@1234")
        assert u.get(f"{API}/modelos-documento").status_code == get_code
        assert u.post(f"{API}/modelos-documento", json={"titulo": "TEST_rbac", "conteudo": "x"}).status_code == 403
        assert u.put(f"{API}/modelos-documento/{ctx['m']['id']}", json={"titulo": "TEST_rbac", "conteudo": "x"}).status_code == 403
        assert u.delete(f"{API}/modelos-documento/{ctx['m']['id']}").status_code == 403


class TestEmissaoModelo:
    def test_emit_modelo_avulso_vars_and_pdf(self, s, ctx):
        p, m = ctx["p"], ctx["m"]
        r = s.post(f"{API}/documentos", json={"paciente_id": p["id"], "tipo": "modelo", "modelo_id": m["id"],
                                              "titulo": "", "corpo": m["conteudo"]})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["titulo"] == "TEST_Termo Modelo" and d["modelo_id"] == m["id"] and d["prontuario_id"] == ""
        c = d["corpo"]
        assert "TEST_Pet Modelo" in c and f"Nº {p['codigo']}" in c and "Gato/Siamês" in c
        assert "TEST_Tutor Modelo" in c and "{desconhecida}" in c and "{veterinario}" not in c and "{data}" not in c
        txt = pdf_text(s, d["pdf_path"])
        assert "TEST_Termo Modelo" in txt and "TEST_Pet Modelo" in txt
        ctx["doc_avulso"] = d

    def test_emit_modelo_custom_title_with_prontuario(self, s, ctx):
        p, m = ctx["p"], ctx["m"]
        pr = s.post(f"{API}/prontuarios", json={"paciente_id": p["id"], "motivo": "TEST motivo"})
        assert pr.status_code == 200, pr.text
        r = s.post(f"{API}/documentos", json={"paciente_id": p["id"], "tipo": "modelo", "modelo_id": m["id"],
                                              "titulo": "TEST_Titulo Custom", "corpo": "Olá {Paciente} {veterinário}",
                                              "prontuario_id": pr.json()["id"]})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["titulo"] == "TEST_Titulo Custom" and d["prontuario_id"] == pr.json()["id"]
        assert d["corpo"].startswith("Olá TEST_Pet Modelo ")
        assert "TEST_Titulo Custom" in pdf_text(s, d["pdf_path"])
        ctx["doc_pront"] = d

    def test_invalid_modelo_and_empty_body(self, s, ctx):
        p = ctx["p"]
        r = s.post(f"{API}/documentos", json={"paciente_id": p["id"], "tipo": "modelo", "modelo_id": "nope", "corpo": "x"})
        assert r.status_code == 400
        r = s.post(f"{API}/documentos", json={"paciente_id": p["id"], "tipo": "modelo", "modelo_id": ctx["m"]["id"], "corpo": "  "})
        assert r.status_code == 400
        r = s.post(f"{API}/documentos", json={"paciente_id": p["id"], "tipo": "xpto", "corpo": "x"})
        assert r.status_code == 400

    def test_special_chars_in_body_and_title(self, s, ctx):
        # reportlab Paragraph treats text as markup: '&' and '<' must not cause 500
        r = s.post(f"{API}/documentos", json={"paciente_id": ctx["p"]["id"], "tipo": "modelo", "modelo_id": ctx["m"]["id"],
                                              "titulo": "TEST_Termo A & B", "corpo": "Dose < 5mg & peso > 2kg"})
        assert r.status_code == 200, f"{r.status_code} {r.text[:200]}"

    @pytest.mark.parametrize("titulo,corpo", [("TEST_Plain", "a <br> b"), ("TEST_Termo <B>", "ok"),
                                              ("TEST_Plain", "Temp <38 graus e <peso")])
    def test_markup_like_text_not_500(self, s, ctx, titulo, corpo):
        # KNOWN BUG: text isn't XML-escaped before reportlab Paragraph -> 500 / tags interpreted
        r = s.post(f"{API}/documentos", json={"paciente_id": ctx["p"]["id"], "tipo": "atestado", "titulo": titulo, "corpo": corpo})
        assert r.status_code == 200, f"{r.status_code} {r.text[:200]}"

    def test_standard_types_with_vars(self, s, ctx):
        p = ctx["p"]
        r = s.post(f"{API}/documentos", json={"paciente_id": p["id"], "tipo": "receita",
                                              "medicamentos": "Amoxicilina para {paciente}", "corpo": ""})
        assert r.status_code == 200, r.text
        assert r.json()["medicamentos"] == "Amoxicilina para TEST_Pet Modelo"
        assert r.json()["titulo"]
        a = s.post(f"{API}/documentos", json={"paciente_id": p["id"], "tipo": "atestado", "corpo": "Atesto que {tutor} ..."})
        assert a.status_code == 200, a.text
        assert "TEST_Tutor Modelo" in a.json()["corpo"]

    def test_timeline_contains_docs(self, s, ctx):
        h = s.get(f"{API}/pacientes/{ctx['p']['id']}/historico", params={"tipos": "documento"})
        assert h.status_code == 200, h.text
        evs = {e["id"]: e for e in h.json()["eventos"] if e["tipo"] == "documento"}
        for k in ("doc_avulso", "doc_pront"):
            d = ctx.get(k)
            assert d and d["id"] in evs, k
            assert evs[d["id"]]["titulo"] == d["titulo"] and evs[d["id"]]["pdf_path"] == d["pdf_path"]
