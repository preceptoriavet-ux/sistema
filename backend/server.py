from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, List

import bcrypt
import jwt
from bson import ObjectId
from fastapi import FastAPI, APIRouter, Request, Response, HTTPException, Depends, UploadFile, File, Query, Header
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

from storage import put_object, get_object, build_path, init_storage, MIME_TYPES
from pdfgen import build_documento_pdf, TIPO_TITULO

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI()
api_router = APIRouter(prefix="/api")

# ---------------- RBAC ----------------
ROLES = ["admin", "gestor", "recepcionista", "veterinario", "estagiario", "auxiliar", "estoque", "financeiro"]
ROLE_LABELS = {
    "admin": "Administrador", "gestor": "Gestor", "recepcionista": "Recepcionista",
    "veterinario": "Médico-Veterinário", "estagiario": "Estagiário", "auxiliar": "Auxiliar",
    "estoque": "Estoque", "financeiro": "Financeiro",
}
ALL_PERMS = {
    "users:manage", "tutores:read", "tutores:write", "pacientes:read", "pacientes:write",
    "agenda:read", "agenda:write", "fila:read", "fila:write", "prontuario:read", "prontuario:write",
    "triagem:read", "triagem:write", "vacina:read", "vacina:write",
    "exame:read", "exame:write",
    "financeiro:read", "financeiro:write",
}
PERMISSIONS = {
    "admin": set(ALL_PERMS),
    "gestor": set(ALL_PERMS),
    "recepcionista": {"tutores:read", "tutores:write", "pacientes:read", "pacientes:write",
                      "agenda:read", "agenda:write", "fila:read", "fila:write", "prontuario:read",
                      "triagem:read", "vacina:read", "exame:read"},
    "veterinario": {"tutores:read", "pacientes:read", "pacientes:write", "agenda:read", "agenda:write",
                    "fila:read", "fila:write", "prontuario:read", "prontuario:write",
                    "triagem:read", "triagem:write", "vacina:read", "vacina:write",
                    "exame:read", "exame:write"},
    "estagiario": {"tutores:read", "pacientes:read", "agenda:read", "fila:read",
                   "prontuario:read", "prontuario:write", "triagem:read", "triagem:write", "vacina:read",
                   "exame:read", "exame:write"},
    "auxiliar": {"tutores:read", "pacientes:read", "agenda:read", "fila:read", "fila:write",
                 "prontuario:read", "triagem:read", "triagem:write", "vacina:read", "vacina:write",
                 "exame:read", "exame:write"},
    "estoque": {"pacientes:read", "vacina:read"},
    "financeiro": {"tutores:read", "pacientes:read", "agenda:read", "financeiro:read", "financeiro:write"},
}


def perms_for(role: str) -> set:
    return PERMISSIONS.get(role, set())


# ---------------- Auth helpers ----------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email, "exp": datetime.now(timezone.utc) + timedelta(hours=12), "type": "access"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "refresh"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def set_auth_cookies(response: Response, access: str, refresh: str):
    response.set_cookie("access_token", access, httponly=True, secure=True, samesite="none", max_age=43200, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=True, samesite="none", max_age=604800, path="/")


def public_user(user: dict) -> dict:
    return {
        "id": str(user["_id"]), "email": user["email"], "name": user.get("name", ""),
        "role": user.get("role", ""), "role_label": ROLE_LABELS.get(user.get("role", ""), ""),
        "active": user.get("active", True), "conselho": user.get("conselho", ""),
        "permissions": sorted(perms_for(user.get("role", ""))),
        "created_at": user.get("created_at"),
    }


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Não autenticado")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Tipo de token inválido")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="Usuário não encontrado")
        if not user.get("active", True):
            raise HTTPException(status_code=403, detail="Usuário inativo")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sessão expirada")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")


def require(*needed: str):
    async def dep(user: dict = Depends(get_current_user)) -> dict:
        perms = perms_for(user.get("role", ""))
        if not any(p in perms for p in needed):
            raise HTTPException(status_code=403, detail="Permissão negada para esta ação")
        return user
    return dep


async def audit(user: dict, action: str, entity: str, entity_id: str, details: str = ""):
    await db.audit_log.insert_one({
        "id": str(uuid.uuid4()), "user_id": str(user["_id"]), "user_name": user.get("name", ""),
        "user_role": user.get("role", ""), "action": action, "entity": entity, "entity_id": entity_id,
        "details": details, "at": datetime.now(timezone.utc).isoformat(),
    })


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


VACINA_PROTOCOLOS = {
    "canino": {"v8": 21, "v10": 21, "v12": 21, "polivalente": 21, "multipla": 21, "giardia": 21,
               "gripe": 365, "tosse dos canis": 365, "traqueobronquite": 365,
               "antirrabica": 365, "raiva": 365, "leishmaniose": 365},
    "felino": {"v3": 21, "v4": 21, "v5": 21, "triplice": 21, "quadrupla": 21, "quintupla": 21,
               "leucemia": 21, "felv": 21, "antirrabica": 365, "raiva": 365},
}


def suggest_proxima_dose(especie: str, nome: str, data_aplicacao: str) -> str:
    if not data_aplicacao:
        return ""
    nome_l = (nome or "").strip().lower()
    dias = None
    protos = VACINA_PROTOCOLOS.get(especie, {})
    for k, v in protos.items():
        if k in nome_l:
            dias = v
            break
    if dias is None:
        dias = 365 if any(x in nome_l for x in ["raiva", "antirrab"]) else 21
    try:
        base = datetime.fromisoformat(data_aplicacao)
    except ValueError:
        return ""
    return (base + timedelta(days=dias)).strftime("%Y-%m-%d")


# ---------------- Models ----------------
class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserIn(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str
    conselho: Optional[str] = ""


class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    active: Optional[bool] = None
    conselho: Optional[str] = None
    password: Optional[str] = None


# ---------------- Auth endpoints ----------------
@api_router.post("/auth/login")
async def login(body: LoginIn, response: Response):
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="E-mail ou senha inválidos")
    if not user.get("active", True):
        raise HTTPException(status_code=403, detail="Usuário inativo. Contate o administrador.")
    access = create_access_token(str(user["_id"]), user["email"])
    refresh = create_refresh_token(str(user["_id"]))
    set_auth_cookies(response, access, refresh)
    return {"user": public_user(user), "token": access}


@api_router.post("/auth/logout")
async def logout(response: Response, user: dict = Depends(get_current_user)):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"ok": True}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return public_user(user)


@api_router.post("/auth/refresh")
async def refresh_token(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="Sem refresh token")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Token inválido")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")
    user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
    if not user:
        raise HTTPException(status_code=401, detail="Usuário não encontrado")
    access = create_access_token(str(user["_id"]), user["email"])
    response.set_cookie("access_token", access, httponly=True, secure=True, samesite="none", max_age=43200, path="/")
    return {"ok": True}


# ---------------- Users management ----------------
@api_router.get("/users")
async def list_users(user: dict = Depends(require("users:manage"))):
    users = await db.users.find().sort("created_at", -1).to_list(500)
    return [public_user(u) for u in users]


@api_router.get("/users/roles")
async def list_roles(user: dict = Depends(get_current_user)):
    return [{"value": r, "label": ROLE_LABELS[r], "permissions": sorted(perms_for(r))} for r in ROLES]


@api_router.post("/users")
async def create_user(body: UserIn, user: dict = Depends(require("users:manage"))):
    if body.role not in ROLES:
        raise HTTPException(status_code=400, detail="Função inválida")
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="E-mail já cadastrado")
    doc = {
        "name": body.name, "email": email, "password_hash": hash_password(body.password),
        "role": body.role, "conselho": body.conselho or "", "active": True, "created_at": now_iso(),
    }
    res = await db.users.insert_one(doc)
    doc["_id"] = res.inserted_id
    await audit(user, "criou", "usuario", str(res.inserted_id), f"{body.name} ({body.role})")
    return public_user(doc)


@api_router.put("/users/{user_id}")
async def update_user(user_id: str, body: UserUpdate, user: dict = Depends(require("users:manage"))):
    target = await db.users.find_one({"_id": ObjectId(user_id)})
    if not target:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    updates = {}
    if body.name is not None:
        updates["name"] = body.name
    if body.role is not None:
        if body.role not in ROLES:
            raise HTTPException(status_code=400, detail="Função inválida")
        updates["role"] = body.role
    if body.active is not None:
        updates["active"] = body.active
    if body.conselho is not None:
        updates["conselho"] = body.conselho
    if body.password:
        updates["password_hash"] = hash_password(body.password)
    if updates:
        await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": updates})
        await audit(user, "editou", "usuario", user_id, ", ".join(updates.keys()))
    updated = await db.users.find_one({"_id": ObjectId(user_id)})
    return public_user(updated)


# ---------------- Generic file upload ----------------
@api_router.post("/upload")
async def upload_file(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    ext = file.filename.split(".")[-1].lower() if "." in file.filename else "bin"
    if ext not in MIME_TYPES:
        raise HTTPException(status_code=400, detail="Tipo de arquivo não suportado")
    data = await file.read()
    if len(data) > 15 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Arquivo muito grande (máx 15MB)")
    path = build_path(ext)
    result = put_object(path, data, MIME_TYPES.get(ext, file.content_type or "application/octet-stream"))
    rec = {
        "id": str(uuid.uuid4()), "storage_path": result["path"], "original_filename": file.filename,
        "content_type": MIME_TYPES.get(ext), "size": result.get("size", len(data)),
        "is_deleted": False, "created_at": now_iso(), "uploaded_by": str(user["_id"]),
    }
    await db.files.insert_one(rec)
    return {"storage_path": result["path"], "filename": file.filename, "content_type": rec["content_type"]}


@api_router.get("/files/{path:path}")
async def download_file(path: str, authorization: str = Header(None), auth: str = Query(None)):
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
    elif auth:
        token = auth
    if not token:
        raise HTTPException(status_code=401, detail="Não autenticado")
    try:
        jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")
    rec = await db.files.find_one({"storage_path": path, "is_deleted": False})
    if not rec:
        raise HTTPException(status_code=404, detail="Arquivo não encontrado")
    data, ct = get_object(path)
    return Response(content=data, media_type=rec.get("content_type", ct))


# ---------------- Tutores ----------------
@api_router.get("/tutores")
async def list_tutores(q: Optional[str] = None, user: dict = Depends(require("tutores:read"))):
    query = {}
    if q:
        rx = {"$regex": q, "$options": "i"}
        query = {"$or": [{"nome": rx}, {"cpf": rx}, {"telefone": rx}, {"whatsapp": rx}, {"email": rx}]}
    rows = await db.tutores.find(query, {"_id": 0}).sort("nome", 1).to_list(1000)
    for r in rows:
        r["num_pacientes"] = await db.pacientes.count_documents({"tutor_id": r["id"]})
    return rows


@api_router.get("/tutores/{tutor_id}")
async def get_tutor(tutor_id: str, user: dict = Depends(require("tutores:read"))):
    t = await db.tutores.find_one({"id": tutor_id}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Tutor não encontrado")
    t["pacientes"] = await db.pacientes.find({"tutor_id": tutor_id}, {"_id": 0}).to_list(200)
    return t


@api_router.post("/tutores")
async def create_tutor(body: dict, user: dict = Depends(require("tutores:write"))):
    cpf = (body.get("cpf") or "").strip()
    if cpf and await db.tutores.find_one({"cpf": cpf}):
        raise HTTPException(status_code=409, detail="Já existe tutor com este CPF")
    doc = {
        "id": str(uuid.uuid4()),
        "nome": body.get("nome", "").strip(),
        "cpf": cpf, "telefone": body.get("telefone", ""), "telefone2": body.get("telefone2", ""),
        "whatsapp": body.get("whatsapp", ""), "email": body.get("email", ""),
        "endereco": body.get("endereco", ""), "cidade": body.get("cidade", ""),
        "contato_emergencia": body.get("contato_emergencia", ""),
        "observacoes": body.get("observacoes", ""), "situacao": body.get("situacao", "ativo"),
        "created_at": now_iso(), "created_by": user.get("name", ""),
    }
    if not doc["nome"]:
        raise HTTPException(status_code=400, detail="Nome é obrigatório")
    await db.tutores.insert_one(doc)
    await audit(user, "cadastrou", "tutor", doc["id"], doc["nome"])
    doc.pop("_id", None)
    return doc


@api_router.put("/tutores/{tutor_id}")
async def update_tutor(tutor_id: str, body: dict, user: dict = Depends(require("tutores:write"))):
    existing = await db.tutores.find_one({"id": tutor_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Tutor não encontrado")
    fields = ["nome", "cpf", "telefone", "telefone2", "whatsapp", "email", "endereco", "cidade",
              "contato_emergencia", "observacoes", "situacao"]
    updates = {k: body[k] for k in fields if k in body}
    updates["updated_at"] = now_iso()
    await db.tutores.update_one({"id": tutor_id}, {"$set": updates})
    await audit(user, "editou", "tutor", tutor_id, existing.get("nome", ""))
    return await db.tutores.find_one({"id": tutor_id}, {"_id": 0})


@api_router.delete("/tutores/{tutor_id}")
async def delete_tutor(tutor_id: str, user: dict = Depends(require("tutores:write"))):
    if await db.pacientes.count_documents({"tutor_id": tutor_id}) > 0:
        raise HTTPException(status_code=400, detail="Tutor possui pacientes vinculados")
    await db.tutores.delete_one({"id": tutor_id})
    await audit(user, "excluiu", "tutor", tutor_id, "")
    return {"ok": True}


# ---------------- Pacientes ----------------
@api_router.get("/pacientes")
async def list_pacientes(q: Optional[str] = None, user: dict = Depends(require("pacientes:read"))):
    query = {}
    if q:
        rx = {"$regex": q, "$options": "i"}
        tutores = await db.tutores.find({"$or": [{"nome": rx}, {"cpf": rx}, {"telefone": rx}]}, {"id": 1}).to_list(500)
        tids = [t["id"] for t in tutores]
        query = {"$or": [{"nome": rx}, {"microchip": rx}, {"tutor_id": {"$in": tids}}]}
    rows = await db.pacientes.find(query, {"_id": 0}).sort("nome", 1).to_list(1000)
    tmap = {}
    for r in rows:
        if r["tutor_id"] not in tmap:
            t = await db.tutores.find_one({"id": r["tutor_id"]}, {"_id": 0, "nome": 1, "telefone": 1})
            tmap[r["tutor_id"]] = t or {}
        r["tutor_nome"] = tmap[r["tutor_id"]].get("nome", "")
        r["tutor_telefone"] = tmap[r["tutor_id"]].get("telefone", "")
    return rows


@api_router.get("/pacientes/{pid}")
async def get_paciente(pid: str, user: dict = Depends(require("pacientes:read"))):
    p = await db.pacientes.find_one({"id": pid}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Paciente não encontrado")
    p["tutor"] = await db.tutores.find_one({"id": p["tutor_id"]}, {"_id": 0})
    p["prontuarios"] = await db.prontuarios.find({"paciente_id": pid}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return p


@api_router.post("/pacientes")
async def create_paciente(body: dict, user: dict = Depends(require("pacientes:write"))):
    if not await db.tutores.find_one({"id": body.get("tutor_id")}):
        raise HTTPException(status_code=400, detail="Tutor inválido")
    doc = {
        "id": str(uuid.uuid4()), "tutor_id": body["tutor_id"],
        "nome": body.get("nome", "").strip(), "especie": body.get("especie", ""),
        "raca": body.get("raca", ""), "sexo": body.get("sexo", ""),
        "data_nascimento": body.get("data_nascimento", ""), "idade_estimada": body.get("idade_estimada", ""),
        "cor": body.get("cor", ""), "peso": body.get("peso", ""), "microchip": body.get("microchip", ""),
        "estado_reprodutivo": body.get("estado_reprodutivo", ""), "alergias": body.get("alergias", ""),
        "doencas_preexistentes": body.get("doencas_preexistentes", ""),
        "medicamentos_continuos": body.get("medicamentos_continuos", ""),
        "alertas": body.get("alertas", ""), "foto": body.get("foto", ""),
        "situacao": body.get("situacao", "ativo"),
        "created_at": now_iso(), "created_by": user.get("name", ""),
    }
    if not doc["nome"]:
        raise HTTPException(status_code=400, detail="Nome do animal é obrigatório")
    await db.pacientes.insert_one(doc)
    await audit(user, "cadastrou", "paciente", doc["id"], doc["nome"])
    doc.pop("_id", None)
    return doc


@api_router.put("/pacientes/{pid}")
async def update_paciente(pid: str, body: dict, user: dict = Depends(require("pacientes:write"))):
    existing = await db.pacientes.find_one({"id": pid})
    if not existing:
        raise HTTPException(status_code=404, detail="Paciente não encontrado")
    fields = ["nome", "especie", "raca", "sexo", "data_nascimento", "idade_estimada", "cor", "peso",
              "microchip", "estado_reprodutivo", "alergias", "doencas_preexistentes",
              "medicamentos_continuos", "alertas", "foto", "situacao", "tutor_id"]
    updates = {k: body[k] for k in fields if k in body}
    updates["updated_at"] = now_iso()
    await db.pacientes.update_one({"id": pid}, {"$set": updates})
    await audit(user, "editou", "paciente", pid, existing.get("nome", ""))
    return await db.pacientes.find_one({"id": pid}, {"_id": 0})


@api_router.delete("/pacientes/{pid}")
async def delete_paciente(pid: str, user: dict = Depends(require("pacientes:write"))):
    await db.pacientes.delete_one({"id": pid})
    await audit(user, "excluiu", "paciente", pid, "")
    return {"ok": True}


# ---------------- Agendamentos ----------------
@api_router.get("/agendamentos")
async def list_agendamentos(data_ini: Optional[str] = None, data_fim: Optional[str] = None,
                            profissional_id: Optional[str] = None, user: dict = Depends(require("agenda:read"))):
    query = {}
    if data_ini and data_fim:
        query["inicio"] = {"$gte": data_ini, "$lte": data_fim + "T23:59:59"}
    if profissional_id:
        query["profissional_id"] = profissional_id
    rows = await db.agendamentos.find(query, {"_id": 0}).sort("inicio", 1).to_list(2000)
    return rows


@api_router.post("/agendamentos")
async def create_agendamento(body: dict, user: dict = Depends(require("agenda:write"))):
    paciente = await db.pacientes.find_one({"id": body.get("paciente_id")}, {"_id": 0})
    if not paciente:
        raise HTTPException(status_code=400, detail="Paciente inválido")
    inicio = body["inicio"]
    fim = body.get("fim", "")
    prof = body.get("profissional_id", "")
    if not fim and inicio:
        try:
            fim = (datetime.fromisoformat(inicio) + timedelta(minutes=30)).isoformat(timespec="seconds")
        except ValueError:
            fim = inicio
    if prof and fim:
        conflito = await db.agendamentos.find_one({
            "profissional_id": prof, "status": {"$nin": ["cancelado", "falta"]},
            "inicio": {"$lt": fim}, "fim": {"$gt": inicio},
        })
        if conflito:
            raise HTTPException(status_code=409, detail="Conflito de horário para este profissional")
    tutor = await db.tutores.find_one({"id": paciente["tutor_id"]}, {"_id": 0})
    doc = {
        "id": str(uuid.uuid4()), "paciente_id": paciente["id"], "paciente_nome": paciente["nome"],
        "tutor_id": paciente["tutor_id"], "tutor_nome": tutor.get("nome", "") if tutor else "",
        "profissional_id": prof, "profissional_nome": body.get("profissional_nome", ""),
        "tipo": body.get("tipo", "consulta"), "sala": body.get("sala", ""),
        "motivo": body.get("motivo", ""), "inicio": inicio, "fim": fim,
        "status": body.get("status", "agendado"), "observacoes": body.get("observacoes", ""),
        "created_at": now_iso(), "created_by": user.get("name", ""),
    }
    await db.agendamentos.insert_one(doc)
    doc.pop("_id", None)
    await novo_prontuario_agendamento(doc, "agendamento")
    await audit(user, "agendou", "agendamento", doc["id"], f"{paciente['nome']} - {inicio}")
    return doc


PRONT_FIELDS = ["motivo", "queixa_principal", "anamnese", "exame_fisico", "temperatura", "fc", "fr",
                "peso", "lista_problemas", "hipoteses", "diagnostico", "exames_solicitados",
                "plano_terapeutico", "prescricoes", "orientacoes", "retorno"]


async def novo_prontuario_agendamento(ag: dict, origem: str) -> dict:
    pront = {
        "id": str(uuid.uuid4()), "paciente_id": ag["paciente_id"], "paciente_nome": ag["paciente_nome"],
        "tutor_id": ag["tutor_id"], "origem": origem, "agendamento_id": ag["id"],
        **{k: "" for k in PRONT_FIELDS}, "motivo": ag.get("motivo") or ag.get("tipo", "consulta"),
        "profissional_id": ag.get("profissional_id", ""), "profissional_nome": ag.get("profissional_nome", ""),
        "status": "rascunho", "revisado_por": "", "correcoes": [], "created_at": now_iso(),
    }
    await db.prontuarios.insert_one(pront)
    pront.pop("_id", None)
    return pront


@api_router.post("/agendamentos/{aid}/iniciar")
async def iniciar_atendimento(aid: str, user: dict = Depends(require("prontuario:write"))):
    ag = await db.agendamentos.find_one({"id": aid}, {"_id": 0})
    if not ag:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado")
    if ag.get("status") in ("concluido", "cancelado", "falta"):
        raise HTTPException(status_code=400, detail="Agendamento já encerrado")
    # Reaproveita o prontuário em branco criado no agendamento; senão cria um novo
    pront = await db.prontuarios.find_one(
        {"agendamento_id": aid, "status": "rascunho", "iniciado_at": {"$exists": False}}, {"_id": 0})
    if not pront:
        pront = await novo_prontuario_agendamento(ag, "agenda")
    upd = {"iniciado_at": now_iso(), "profissional_id": str(user["_id"]), "profissional_nome": user.get("name", "")}
    await db.prontuarios.update_one({"id": pront["id"]}, {"$set": upd})
    await db.agendamentos.update_one({"id": aid}, {"$set": {"status": "em_atendimento", "updated_at": now_iso()}})
    await fila_do_agendamento(aid, "em_consulta")
    await audit(user, "iniciou atendimento", "agendamento", aid, ag["paciente_nome"])
    return await db.prontuarios.find_one({"id": pront["id"]}, {"_id": 0})


FILA_ATIVA = {"$nin": ["concluido", "falta", "cancelado"]}


async def fila_do_agendamento(aid: str, status: str):
    await db.fila.update_many({"agendamento_id": aid, "status": FILA_ATIVA},
                              {"$set": {"status": status, "updated_at": now_iso()}})


@api_router.post("/agendamentos/{aid}/chegada")
async def registrar_chegada(aid: str, user: dict = Depends(require("fila:write"))):
    ag = await db.agendamentos.find_one({"id": aid}, {"_id": 0})
    if not ag:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado")
    if ag.get("status") in ("concluido", "cancelado", "falta"):
        raise HTTPException(status_code=400, detail="Agendamento já encerrado")
    fila = await db.fila.find_one({"paciente_id": ag["paciente_id"], "status": FILA_ATIVA}, {"_id": 0})
    if fila:
        await db.fila.update_one({"id": fila["id"]}, {"$set": {"agendamento_id": aid, "updated_at": now_iso()}})
    else:
        paciente = await db.pacientes.find_one({"id": ag["paciente_id"]}, {"_id": 0}) or {}
        fila = {
            "id": str(uuid.uuid4()), "paciente_id": ag["paciente_id"], "paciente_nome": ag["paciente_nome"],
            "especie": paciente.get("especie", ""), "tutor_id": ag["tutor_id"], "tutor_nome": ag.get("tutor_nome", ""),
            "motivo": ag.get("motivo", ""), "tipo": "agendado", "prioridade": "normal",
            "status": "aguardando_recepcao", "profissional_id": ag.get("profissional_id", ""),
            "agendamento_id": aid, "chegada": now_iso(), "created_by": user.get("name", ""),
        }
        await db.fila.insert_one(fila)
        fila.pop("_id", None)
    await db.agendamentos.update_one({"id": aid}, {"$set": {"chegada_at": now_iso(), "fila_id": fila["id"]}})
    await audit(user, "registrou chegada", "agendamento", aid, ag["paciente_nome"])
    return await db.agendamentos.find_one({"id": aid}, {"_id": 0})


@api_router.put("/agendamentos/{aid}")
async def update_agendamento(aid: str, body: dict, user: dict = Depends(require("agenda:write"))):
    existing = await db.agendamentos.find_one({"id": aid})
    if not existing:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado")
    fields = ["profissional_id", "profissional_nome", "tipo", "sala", "motivo", "inicio", "fim",
              "status", "observacoes"]
    updates = {k: body[k] for k in fields if k in body}
    updates["updated_at"] = now_iso()
    await db.agendamentos.update_one({"id": aid}, {"$set": updates})
    await audit(user, "editou", "agendamento", aid, updates.get("status", ""))
    return await db.agendamentos.find_one({"id": aid}, {"_id": 0})


@api_router.delete("/agendamentos/{aid}")
async def delete_agendamento(aid: str, user: dict = Depends(require("agenda:write"))):
    await db.agendamentos.delete_one({"id": aid})
    await audit(user, "excluiu", "agendamento", aid, "")
    return {"ok": True}


# ---------------- Fila / Recepção ----------------
FILA_STATUS = ["aguardando_recepcao", "aguardando_triagem", "em_triagem", "aguardando_consulta",
               "em_consulta", "aguardando_procedimento", "aguardando_finalizacao", "concluido",
               "falta", "cancelado"]


@api_router.get("/fila")
async def list_fila(incluir_finalizados: bool = False, user: dict = Depends(require("fila:read"))):
    query = {} if incluir_finalizados else {"status": {"$nin": ["concluido", "falta", "cancelado"]}}
    rows = await db.fila.find(query, {"_id": 0}).sort("chegada", 1).to_list(500)
    return rows


@api_router.post("/fila")
async def add_fila(body: dict, user: dict = Depends(require("fila:write"))):
    paciente = await db.pacientes.find_one({"id": body.get("paciente_id")}, {"_id": 0})
    if not paciente:
        raise HTTPException(status_code=400, detail="Paciente inválido")
    tutor = await db.tutores.find_one({"id": paciente["tutor_id"]}, {"_id": 0})
    doc = {
        "id": str(uuid.uuid4()), "paciente_id": paciente["id"], "paciente_nome": paciente["nome"],
        "especie": paciente.get("especie", ""), "tutor_id": paciente["tutor_id"],
        "tutor_nome": tutor.get("nome", "") if tutor else "",
        "motivo": body.get("motivo", ""), "tipo": body.get("tipo", "espontaneo"),
        "prioridade": body.get("prioridade", "normal"),
        "status": body.get("status", "aguardando_recepcao"),
        "profissional_id": body.get("profissional_id", ""),
        "chegada": now_iso(), "created_by": user.get("name", ""),
    }
    await db.fila.insert_one(doc)
    await audit(user, "registrou chegada", "fila", doc["id"], paciente["nome"])
    doc.pop("_id", None)
    return doc


@api_router.put("/fila/{fid}")
async def update_fila(fid: str, body: dict, user: dict = Depends(require("fila:write"))):
    existing = await db.fila.find_one({"id": fid})
    if not existing:
        raise HTTPException(status_code=404, detail="Registro não encontrado")
    updates = {}
    for k in ["status", "prioridade", "motivo", "profissional_id"]:
        if k in body:
            updates[k] = body[k]
    updates["updated_at"] = now_iso()
    await db.fila.update_one({"id": fid}, {"$set": updates})
    await audit(user, "atualizou fila", "fila", fid, updates.get("status", ""))
    return await db.fila.find_one({"id": fid}, {"_id": 0})


# ---------------- Prontuários ----------------
@api_router.get("/prontuarios")
async def list_prontuarios(paciente_id: Optional[str] = None, user: dict = Depends(require("prontuario:read"))):
    query = {"paciente_id": paciente_id} if paciente_id else {}
    rows = await db.prontuarios.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return rows


@api_router.post("/prontuarios")
async def create_prontuario(body: dict, user: dict = Depends(require("prontuario:write"))):
    paciente = await db.pacientes.find_one({"id": body.get("paciente_id")}, {"_id": 0})
    if not paciente:
        raise HTTPException(status_code=400, detail="Paciente inválido")
    is_estagiario = user.get("role") == "estagiario"
    doc = {
        "id": str(uuid.uuid4()), "paciente_id": paciente["id"], "paciente_nome": paciente["nome"],
        "tutor_id": paciente["tutor_id"], "agendamento_id": body.get("agendamento_id", ""),
        "motivo": body.get("motivo", ""), "queixa_principal": body.get("queixa_principal", ""),
        "anamnese": body.get("anamnese", ""), "exame_fisico": body.get("exame_fisico", ""),
        "temperatura": body.get("temperatura", ""), "fc": body.get("fc", ""), "fr": body.get("fr", ""),
        "peso": body.get("peso", ""), "lista_problemas": body.get("lista_problemas", ""),
        "hipoteses": body.get("hipoteses", ""), "diagnostico": body.get("diagnostico", ""),
        "exames_solicitados": body.get("exames_solicitados", ""),
        "plano_terapeutico": body.get("plano_terapeutico", ""),
        "prescricoes": body.get("prescricoes", ""), "orientacoes": body.get("orientacoes", ""),
        "retorno": body.get("retorno", ""),
        "profissional_id": str(user["_id"]), "profissional_nome": user.get("name", ""),
        "status": "aguardando_revisao" if is_estagiario else ("finalizado" if body.get("finalizar") else "rascunho"),
        "revisado_por": "", "correcoes": [],
        "created_at": now_iso(),
    }
    await db.prontuarios.insert_one(doc)
    await audit(user, "criou prontuário", "prontuario", doc["id"], paciente["nome"])
    doc.pop("_id", None)
    return doc


@api_router.put("/prontuarios/{rid}")
async def update_prontuario(rid: str, body: dict, user: dict = Depends(require("prontuario:write"))):
    existing = await db.prontuarios.find_one({"id": rid})
    if not existing:
        raise HTTPException(status_code=404, detail="Prontuário não encontrado")
    fields = ["motivo", "queixa_principal", "anamnese", "exame_fisico", "temperatura", "fc", "fr",
              "peso", "lista_problemas", "hipoteses", "diagnostico", "exames_solicitados",
              "plano_terapeutico", "prescricoes", "orientacoes", "retorno"]
    updates = {k: body[k] for k in fields if k in body}
    # Finalized records require traceable correction, not silent overwrite
    if existing.get("status") in ("finalizado", "aguardando_revisao", "validado"):
        correcao = {
            "at": now_iso(), "por": user.get("name", ""), "campos": list(updates.keys()),
            "motivo": body.get("motivo_correcao", "Correção"),
        }
        await db.prontuarios.update_one({"id": rid}, {"$set": updates, "$push": {"correcoes": correcao}})
        await audit(user, "corrigiu prontuário", "prontuario", rid, correcao["motivo"])
    else:
        if body.get("finalizar"):
            updates["status"] = "finalizado"
        await db.prontuarios.update_one({"id": rid}, {"$set": updates})
        await audit(user, "editou prontuário", "prontuario", rid, "")
    return await db.prontuarios.find_one({"id": rid}, {"_id": 0})


@api_router.post("/prontuarios/{rid}/validar")
async def validar_prontuario(rid: str, user: dict = Depends(require("prontuario:write"))):
    if user.get("role") not in ("veterinario", "admin", "gestor"):
        raise HTTPException(status_code=403, detail="Apenas veterinário supervisor pode validar")
    existing = await db.prontuarios.find_one({"id": rid})
    if not existing:
        raise HTTPException(status_code=404, detail="Prontuário não encontrado")
    await db.prontuarios.update_one({"id": rid}, {"$set": {
        "status": "validado", "revisado_por": user.get("name", ""), "validado_at": now_iso()}})
    await audit(user, "validou prontuário", "prontuario", rid, existing.get("paciente_nome", ""))
    return await db.prontuarios.find_one({"id": rid}, {"_id": 0})


@api_router.get("/prontuarios/{rid}/triagem")
async def triagem_do_prontuario(rid: str, user: dict = Depends(require("prontuario:read"))):
    pront = await db.prontuarios.find_one({"id": rid}, {"_id": 0})
    if not pront:
        raise HTTPException(status_code=404, detail="Prontuário não encontrado")
    tri = None
    if pront.get("triagem_id"):
        tri = await db.triagem.find_one({"id": pront["triagem_id"]}, {"_id": 0})
    ag = None
    if not tri and pront.get("agendamento_id"):
        tri = await db.triagem.find_one({"agendamento_id": pront["agendamento_id"], "status": {"$ne": "em_andamento"}},
                                        {"_id": 0}, sort=[("created_at", -1)])
        ag = await db.agendamentos.find_one({"id": pront["agendamento_id"]}, {"_id": 0})
    if not tri:
        dia = (ag or {}).get("inicio", "")[:10] or pront.get("created_at", "")[:10]
        tri = await db.triagem.find_one(
            {"paciente_id": pront["paciente_id"], "status": {"$ne": "em_andamento"}, "created_at": {"$gte": dia, "$lte": dia + "T23:59:59.999999+99:99"}},
            {"_id": 0}, sort=[("created_at", -1)])
    return {"triagem": tri}


@api_router.post("/prontuarios/{rid}/concluir")
async def concluir_atendimento(rid: str, body: dict, user: dict = Depends(require("prontuario:write"))):
    existing = await db.prontuarios.find_one({"id": rid}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Prontuário não encontrado")
    updates = {k: body[k] for k in PRONT_FIELDS if k in body}
    if existing.get("status") == "rascunho":
        updates["status"] = "aguardando_revisao" if user.get("role") == "estagiario" else "finalizado"
    updates["concluido_at"] = now_iso()
    await db.prontuarios.update_one({"id": rid}, {"$set": updates})
    if existing.get("agendamento_id"):
        await db.agendamentos.update_one({"id": existing["agendamento_id"]},
                                         {"$set": {"status": "concluido", "updated_at": now_iso()}})
        await fila_do_agendamento(existing["agendamento_id"], "concluido")
    await audit(user, "concluiu atendimento", "prontuario", rid, existing.get("paciente_nome", ""))
    return await db.prontuarios.find_one({"id": rid}, {"_id": 0})


# ---------------- Dashboard ----------------
@api_router.get("/dashboard")
async def dashboard(user: dict = Depends(get_current_user)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    fila_ativa = await db.fila.count_documents({"status": {"$nin": ["concluido", "falta", "cancelado"]}})
    emergencias = await db.triagem.find(
        {"prioridade": "emergencia", "created_at": {"$gte": today}}, {"_id": 0}
    ).sort("created_at", -1).to_list(20)
    exames_criticos = await db.exames.count_documents({"critico": True, "status": {"$ne": "cancelado"}})
    atend_hoje = await db.fila.count_documents({"chegada": {"$gte": today}})
    ag_hoje = await db.agendamentos.count_documents({
        "inicio": {"$gte": today, "$lte": today + "T23:59:59"}, "status": {"$nin": ["cancelado"]}})
    return {
        "total_tutores": await db.tutores.count_documents({}),
        "total_pacientes": await db.pacientes.count_documents({}),
        "fila_ativa": fila_ativa,
        "atendimentos_hoje": atend_hoje,
        "agendamentos_hoje": ag_hoje,
        "prontuarios_revisao": await db.prontuarios.count_documents({"status": "aguardando_revisao"}),
        "vacinas_pendentes": await db.vacinas.count_documents(
            {"proxima_dose": {"$ne": "", "$lte": (datetime.now(timezone.utc) + timedelta(days=30)).strftime("%Y-%m-%d")}}),
        "emergencias": emergencias,
        "exames_criticos": exames_criticos,
        "fila": await db.fila.find({"status": {"$nin": ["concluido", "falta", "cancelado"]}},
                                   {"_id": 0}).sort("chegada", 1).to_list(50),
        "agenda_hoje": await db.agendamentos.find(
            {"inicio": {"$gte": today, "$lte": today + "T23:59:59"}},
            {"_id": 0}).sort("inicio", 1).to_list(50),
    }


@api_router.get("/audit")
async def list_audit(user: dict = Depends(require("users:manage"))):
    return await db.audit_log.find({}, {"_id": 0}).sort("at", -1).to_list(200)


@api_router.get("/profissionais")
async def list_profissionais(user: dict = Depends(get_current_user)):
    rows = await db.users.find({"role": {"$in": ["veterinario", "estagiario"]}, "active": True}).to_list(200)
    return [{"id": str(u["_id"]), "nome": u.get("name", ""), "role": u.get("role", ""),
             "conselho": u.get("conselho", "")} for u in rows]


# ---------------- Triagem ----------------
@api_router.get("/triagem")
async def list_triagem(paciente_id: Optional[str] = None, user: dict = Depends(require("triagem:read"))):
    query = {"paciente_id": paciente_id} if paciente_id else {}
    return await db.triagem.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)


TRIAGEM_FIELDS = ["queixa_principal", "inicio_sinais", "historico", "temperatura", "fc", "fr", "peso",
                  "dor", "hidratacao", "info_tutor", "sinais_alerta", "prioridade", "observacoes"]


@api_router.post("/triagem")
async def create_triagem(body: dict, user: dict = Depends(require("triagem:write"))):
    paciente = await db.pacientes.find_one({"id": body.get("paciente_id")}, {"_id": 0})
    if not paciente:
        raise HTTPException(status_code=400, detail="Paciente inválido")
    doc = {
        "id": str(uuid.uuid4()), "paciente_id": paciente["id"], "paciente_nome": paciente["nome"],
        "especie": paciente.get("especie", ""), "tutor_id": paciente["tutor_id"],
        "fila_id": body.get("fila_id", ""),
        **{k: body.get(k, "") for k in TRIAGEM_FIELDS}, "prioridade": body.get("prioridade") or "normal",
        "responsavel": user.get("name", ""), "profissional_id": str(user["_id"]),
        "status": "em_andamento", "iniciado_at": now_iso(), "concluido_at": "", "alteracoes": [],
        "created_at": now_iso(),
    }
    # Vincula ao agendamento do dia (se houver); o prontuário do agendamento exibirá a triagem
    hoje = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    ag = await db.agendamentos.find_one(
        {"paciente_id": paciente["id"], "inicio": {"$gte": hoje, "$lte": hoje + "T23:59:59"},
         "status": {"$nin": ["concluido", "cancelado", "falta"]}}, {"_id": 0})
    doc["agendamento_id"] = body.get("agendamento_id") or (ag["id"] if ag else "")
    await db.triagem.insert_one(doc)
    if doc["fila_id"]:
        await db.fila.update_one({"id": doc["fila_id"]}, {"$set": {"status": "em_triagem", "updated_at": now_iso()}})
    await audit(user, "iniciou triagem", "triagem", doc["id"], paciente["nome"])
    doc.pop("_id", None)
    if body.get("concluir"):
        return await concluir_triagem(doc["id"], {}, user)
    return doc


@api_router.put("/triagem/{tid}")
async def update_triagem(tid: str, body: dict, user: dict = Depends(require("triagem:write"))):
    existing = await db.triagem.find_one({"id": tid}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Triagem não encontrada")
    updates = {k: body[k] for k in TRIAGEM_FIELDS if k in body and body[k] != existing.get(k)}
    if not updates:
        return existing
    op = {"$set": {**updates, "updated_at": now_iso()}}
    if existing.get("status", "concluida") == "concluida":
        op["$push"] = {"alteracoes": {"at": now_iso(), "por": user.get("name", ""), "campos": list(updates.keys()),
                                      "anterior": {k: existing.get(k, "") for k in updates}}}
        await audit(user, "alterou triagem concluída", "triagem", tid, ", ".join(updates.keys()))
    else:
        await audit(user, "editou triagem", "triagem", tid, "")
    await db.triagem.update_one({"id": tid}, op)
    return await db.triagem.find_one({"id": tid}, {"_id": 0})


@api_router.post("/triagem/{tid}/concluir")
async def concluir_triagem(tid: str, body: dict, user: dict = Depends(require("triagem:write"))):
    existing = await db.triagem.find_one({"id": tid}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Triagem não encontrada")
    if existing.get("status", "concluida") == "concluida":
        raise HTTPException(status_code=400, detail="Triagem já concluída")
    updates = {k: body[k] for k in TRIAGEM_FIELDS if k in body}
    await db.triagem.update_one({"id": tid}, {"$set": {**updates, "status": "concluida", "concluido_at": now_iso()}})
    doc = await db.triagem.find_one({"id": tid}, {"_id": 0})
    pront_ag = doc["agendamento_id"] and await db.prontuarios.find_one(
        {"agendamento_id": doc["agendamento_id"], "status": "rascunho"})
    # Encaminha ao prontuário: cria registro inicial vinculado (se não houver um do agendamento)
    if not pront_ag:
        await db.prontuarios.insert_one({
            "id": str(uuid.uuid4()), "paciente_id": doc["paciente_id"], "paciente_nome": doc["paciente_nome"],
            "tutor_id": doc["tutor_id"], "origem": "triagem", "triagem_id": tid,
            "agendamento_id": doc["agendamento_id"], **{k: "" for k in PRONT_FIELDS},
            "motivo": "Atendimento após triagem", "queixa_principal": doc["queixa_principal"],
            "anamnese": doc["historico"], "temperatura": doc["temperatura"], "fc": doc["fc"], "fr": doc["fr"],
            "peso": doc["peso"], "profissional_id": "", "profissional_nome": "",
            "status": "rascunho", "revisado_por": "", "correcoes": [], "created_at": now_iso(),
        })
    if doc["fila_id"]:
        await db.fila.update_one({"id": doc["fila_id"]}, {"$set": {"status": "aguardando_consulta", "updated_at": now_iso()}})
    await audit(user, "concluiu triagem", "triagem", tid, f"{doc['paciente_nome']} ({doc['prioridade']})")
    return doc


@api_router.delete("/triagem/{tid}")
async def delete_triagem(tid: str, user: dict = Depends(require("triagem:write"))):
    existing = await db.triagem.find_one({"id": tid}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Triagem não encontrada")
    await db.triagem.delete_one({"id": tid})
    if existing.get("status") == "em_andamento" and existing.get("fila_id"):
        await db.fila.update_one({"id": existing["fila_id"], "status": "em_triagem"},
                                 {"$set": {"status": "aguardando_triagem", "updated_at": now_iso()}})
    await audit(user, "excluiu triagem", "triagem", tid, existing.get("paciente_nome", ""))
    return {"ok": True}


# ---------------- Vacinas / Medicina Preventiva ----------------
@api_router.get("/vacinas")
async def list_vacinas(paciente_id: Optional[str] = None, user: dict = Depends(require("vacina:read"))):
    query = {"paciente_id": paciente_id} if paciente_id else {}
    return await db.vacinas.find(query, {"_id": 0}).sort("data_aplicacao", -1).to_list(1000)


@api_router.get("/vacinas/pendentes")
async def vacinas_pendentes(user: dict = Depends(require("vacina:read"))):
    limite = (datetime.now(timezone.utc) + timedelta(days=30)).strftime("%Y-%m-%d")
    rows = await db.vacinas.find({"proxima_dose": {"$ne": "", "$lte": limite}}, {"_id": 0}).sort("proxima_dose", 1).to_list(500)
    return rows


@api_router.post("/vacinas")
async def create_vacina(body: dict, user: dict = Depends(require("vacina:write"))):
    paciente = await db.pacientes.find_one({"id": body.get("paciente_id")}, {"_id": 0})
    if not paciente:
        raise HTTPException(status_code=400, detail="Paciente inválido")
    proxima = body.get("proxima_dose", "")
    if not proxima:
        proxima = suggest_proxima_dose(paciente.get("especie", ""), body.get("nome", ""), body.get("data_aplicacao", ""))
    doc = {
        "id": str(uuid.uuid4()), "paciente_id": paciente["id"], "paciente_nome": paciente["nome"],
        "especie": paciente.get("especie", ""), "tutor_id": paciente["tutor_id"],
        "tipo": body.get("tipo", "vacina"), "nome": body.get("nome", ""),
        "fabricante": body.get("fabricante", ""), "lote": body.get("lote", ""),
        "validade": body.get("validade", ""), "data_aplicacao": body.get("data_aplicacao", ""),
        "dose": body.get("dose", ""), "via": body.get("via", ""),
        "proxima_dose": proxima, "reacoes": body.get("reacoes", ""),
        "observacoes": body.get("observacoes", ""),
        "responsavel": user.get("name", ""), "profissional_id": str(user["_id"]),
        "created_at": now_iso(),
    }
    if not doc["nome"]:
        raise HTTPException(status_code=400, detail="Informe o nome da vacina/produto")
    await db.vacinas.insert_one(doc)
    await audit(user, "registrou vacina", "vacina", doc["id"], f"{doc['nome']} - {paciente['nome']}")
    doc.pop("_id", None)
    return doc


# ---------------- Exames ----------------
EXAME_STATUS = ["solicitado", "coletado", "em_processamento", "concluido", "cancelado"]


@api_router.get("/exames")
async def list_exames(paciente_id: Optional[str] = None, status: Optional[str] = None,
                      prontuario_id: Optional[str] = None, user: dict = Depends(require("exame:read"))):
    query = {}
    if paciente_id:
        query["paciente_id"] = paciente_id
    if status:
        query["status"] = status
    if prontuario_id:
        query["prontuario_id"] = prontuario_id
    return await db.exames.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)


@api_router.post("/exames")
async def create_exame(body: dict, user: dict = Depends(require("exame:write"))):
    paciente = await db.pacientes.find_one({"id": body.get("paciente_id")}, {"_id": 0})
    if not paciente:
        raise HTTPException(status_code=400, detail="Paciente inválido")
    doc = {
        "id": str(uuid.uuid4()), "paciente_id": paciente["id"], "paciente_nome": paciente["nome"],
        "especie": paciente.get("especie", ""), "tutor_id": paciente["tutor_id"],
        "prontuario_id": body.get("prontuario_id", ""),
        "tipo": body.get("tipo", ""), "categoria": body.get("categoria", "laboratorial"),
        "laboratorio": body.get("laboratorio", ""), "data_coleta": body.get("data_coleta", ""),
        "status": body.get("status", "solicitado"), "resultado": body.get("resultado", ""),
        "critico": bool(body.get("critico", False)), "laudo_path": body.get("laudo_path", ""),
        "laudo_nome": body.get("laudo_nome", ""), "observacoes": body.get("observacoes", ""),
        "solicitante": user.get("name", ""), "profissional_id": str(user["_id"]),
        "created_at": now_iso(),
    }
    if not doc["tipo"]:
        raise HTTPException(status_code=400, detail="Informe o tipo de exame")
    await db.exames.insert_one(doc)
    await audit(user, "solicitou exame", "exame", doc["id"], f"{doc['tipo']} - {paciente['nome']}")
    doc.pop("_id", None)
    return doc


@api_router.put("/exames/{eid}")
async def update_exame(eid: str, body: dict, user: dict = Depends(require("exame:write"))):
    existing = await db.exames.find_one({"id": eid})
    if not existing:
        raise HTTPException(status_code=404, detail="Exame não encontrado")
    fields = ["tipo", "categoria", "laboratorio", "data_coleta", "status", "resultado", "critico",
              "laudo_path", "laudo_nome", "observacoes"]
    updates = {k: body[k] for k in fields if k in body}
    if "critico" in updates:
        updates["critico"] = bool(updates["critico"])
    updates["updated_at"] = now_iso()
    await db.exames.update_one({"id": eid}, {"$set": updates})
    await audit(user, "atualizou exame", "exame", eid, updates.get("status", ""))
    return await db.exames.find_one({"id": eid}, {"_id": 0})


# ---------------- Config da Clínica ----------------
DEFAULT_CLINIC = {
    "id": "clinica", "nome": "VetCare Pro — Clínica Veterinária",
    "endereco": "Rua das Acácias, 123 — Centro", "telefone": "(11) 4000-0000",
    "cnpj": "", "email": "contato@vetcare.com", "logo_path": "",
}


@api_router.get("/config/clinica")
async def get_clinica(user: dict = Depends(get_current_user)):
    c = await db.config.find_one({"id": "clinica"}, {"_id": 0})
    return c or DEFAULT_CLINIC


@api_router.put("/config/clinica")
async def update_clinica(body: dict, user: dict = Depends(require("users:manage"))):
    fields = ["nome", "endereco", "telefone", "cnpj", "email", "logo_path"]
    updates = {k: body[k] for k in fields if k in body}
    await db.config.update_one({"id": "clinica"}, {"$set": updates}, upsert=True)
    await audit(user, "atualizou config", "clinica", "clinica", "")
    return await db.config.find_one({"id": "clinica"}, {"_id": 0})


# ---------------- Documentos Clínicos (PDF) ----------------
@api_router.get("/documentos")
async def list_documentos(paciente_id: Optional[str] = None, user: dict = Depends(require("prontuario:read"))):
    query = {"paciente_id": paciente_id} if paciente_id else {}
    return await db.documentos.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)


@api_router.post("/documentos")
async def create_documento(body: dict, user: dict = Depends(require("prontuario:write"))):
    paciente = await db.pacientes.find_one({"id": body.get("paciente_id")}, {"_id": 0})
    if not paciente:
        raise HTTPException(status_code=400, detail="Paciente inválido")
    tipo = body.get("tipo", "")
    if tipo not in TIPO_TITULO:
        raise HTTPException(status_code=400, detail="Tipo de documento inválido")
    tutor = await db.tutores.find_one({"id": paciente["tutor_id"]}, {"_id": 0})
    clinic = await db.config.find_one({"id": "clinica"}, {"_id": 0}) or DEFAULT_CLINIC
    agora = datetime.now(timezone.utc)
    pinfo = " / ".join([x for x in [paciente.get("especie", ""), paciente.get("raca", "")] if x]) or "—"
    render = {
        "tipo": tipo, "paciente_nome": paciente["nome"], "tutor_nome": tutor.get("nome", "") if tutor else "",
        "paciente_info": pinfo, "data_fmt": agora.strftime("%d/%m/%Y %H:%M"),
        "corpo": body.get("corpo", ""), "medicamentos": body.get("medicamentos", ""),
        "profissional_nome": user.get("name", ""), "conselho": user.get("conselho", ""),
    }
    logo_bytes = None
    if clinic.get("logo_path"):
        try:
            logo_bytes, _ = get_object(clinic["logo_path"])
        except Exception:
            logo_bytes = None
    pdf_bytes = build_documento_pdf(render, clinic, logo_bytes)
    path = build_path("pdf")
    result = put_object(path, pdf_bytes, "application/pdf")
    doc = {
        "id": str(uuid.uuid4()), "paciente_id": paciente["id"], "paciente_nome": paciente["nome"],
        "tutor_id": paciente["tutor_id"], "tutor_nome": render["tutor_nome"],
        "tipo": tipo, "titulo": TIPO_TITULO[tipo], "corpo": body.get("corpo", ""),
        "medicamentos": body.get("medicamentos", ""), "prontuario_id": body.get("prontuario_id", ""),
        "pdf_path": result["path"], "pdf_nome": f"{tipo}_{paciente['nome']}.pdf",
        "profissional_nome": user.get("name", ""), "profissional_id": str(user["_id"]),
        "created_at": now_iso(),
    }
    await db.files.insert_one({
        "id": str(uuid.uuid4()), "storage_path": result["path"], "original_filename": doc["pdf_nome"],
        "content_type": "application/pdf", "size": result.get("size", len(pdf_bytes)),
        "is_deleted": False, "created_at": now_iso(), "uploaded_by": str(user["_id"]),
    })
    await db.documentos.insert_one(doc)
    await audit(user, "emitiu documento", "documento", doc["id"], f"{TIPO_TITULO[tipo]} - {paciente['nome']}")
    doc.pop("_id", None)
    return doc


# ---------------- Relatórios ----------------
@api_router.get("/relatorios")
async def relatorios(data_ini: Optional[str] = None, data_fim: Optional[str] = None,
                     user: dict = Depends(require("prontuario:read", "users:manage"))):
    from collections import Counter
    rng = {}
    if data_ini:
        rng["$gte"] = data_ini
    if data_fim:
        rng["$lte"] = data_fim + "T23:59:59"
    dq = {"created_at": rng} if rng else {}

    prontuarios = await db.prontuarios.find(dq, {"_id": 0}).to_list(5000)
    exames = await db.exames.find(dq, {"_id": 0}).to_list(5000)
    vacinas = await db.vacinas.find(dq, {"_id": 0}).to_list(5000)
    fila = await db.fila.find({"chegada": rng} if rng else {}, {"_id": 0}).to_list(5000)
    agend = await db.agendamentos.find({"inicio": rng} if rng else {}, {"_id": 0}).to_list(5000)

    diag = Counter((p.get("diagnostico") or "").strip() for p in prontuarios if (p.get("diagnostico") or "").strip())
    especie = Counter((f.get("especie") or "outro") for f in fila)
    exame_status = Counter(e.get("status", "") for e in exames)
    vac_tipo = Counter(v.get("tipo", "") for v in vacinas)
    ag_status = Counter(a.get("status", "") for a in agend)

    return {
        "periodo": {"data_ini": data_ini or "", "data_fim": data_fim or ""},
        "resumo": {
            "atendimentos": len(prontuarios), "exames": len(exames),
            "exames_criticos": sum(1 for e in exames if e.get("critico")),
            "vacinas": len(vacinas), "agendamentos": len(agend),
            "faltas": ag_status.get("falta", 0), "cancelamentos": ag_status.get("cancelado", 0),
            "fila_total": len(fila),
        },
        "por_especie": [{"especie": k, "total": v} for k, v in especie.most_common()],
        "diagnosticos": [{"diagnostico": k, "total": v} for k, v in diag.most_common(20)],
        "exames_por_status": [{"status": k, "total": v} for k, v in exame_status.most_common()],
        "vacinas_por_tipo": [{"tipo": k, "total": v} for k, v in vac_tipo.most_common()],
    }


# ---------------- Financeiro ----------------
def _num(v):
    try:
        return round(float(v), 2)
    except (TypeError, ValueError):
        return 0.0


@api_router.get("/servicos")
async def list_servicos(user: dict = Depends(require("financeiro:read"))):
    return await db.servicos.find({}, {"_id": 0}).sort("nome", 1).to_list(1000)


@api_router.post("/servicos")
async def create_servico(body: dict, user: dict = Depends(require("financeiro:write"))):
    doc = {
        "id": str(uuid.uuid4()), "nome": (body.get("nome") or "").strip(),
        "categoria": body.get("categoria", ""), "preco": _num(body.get("preco")),
        "descricao": body.get("descricao", ""), "ativo": bool(body.get("ativo", True)),
        "created_at": now_iso(),
    }
    if not doc["nome"]:
        raise HTTPException(status_code=400, detail="Informe o nome do serviço")
    await db.servicos.insert_one(doc)
    await audit(user, "cadastrou serviço", "servico", doc["id"], doc["nome"])
    doc.pop("_id", None)
    return doc


@api_router.put("/servicos/{sid}")
async def update_servico(sid: str, body: dict, user: dict = Depends(require("financeiro:write"))):
    if not await db.servicos.find_one({"id": sid}):
        raise HTTPException(status_code=404, detail="Serviço não encontrado")
    updates = {}
    for k in ["nome", "categoria", "descricao", "ativo"]:
        if k in body:
            updates[k] = body[k]
    if "preco" in body:
        updates["preco"] = _num(body["preco"])
    await db.servicos.update_one({"id": sid}, {"$set": updates})
    await audit(user, "editou serviço", "servico", sid, "")
    return await db.servicos.find_one({"id": sid}, {"_id": 0})


@api_router.get("/financeiro")
async def list_financeiro(tipo: Optional[str] = None, status: Optional[str] = None,
                          data_ini: Optional[str] = None, data_fim: Optional[str] = None,
                          user: dict = Depends(require("financeiro:read"))):
    query = {}
    if tipo:
        query["tipo"] = tipo
    if status:
        query["status"] = status
    if data_ini and data_fim:
        query["data"] = {"$gte": data_ini, "$lte": data_fim}
    return await db.financeiro.find(query, {"_id": 0}).sort("data", -1).to_list(3000)


@api_router.post("/financeiro")
async def create_financeiro(body: dict, user: dict = Depends(require("financeiro:write"))):
    tipo = body.get("tipo", "receita")
    if tipo not in ("receita", "despesa"):
        raise HTTPException(status_code=400, detail="Tipo inválido")
    doc = {
        "id": str(uuid.uuid4()), "tipo": tipo, "categoria": body.get("categoria", ""),
        "descricao": (body.get("descricao") or "").strip(), "valor": _num(body.get("valor")),
        "desconto": _num(body.get("desconto")), "status": body.get("status", "pendente"),
        "forma_pagamento": body.get("forma_pagamento", ""),
        "data": body.get("data") or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "vencimento": body.get("vencimento", ""), "pago_em": body.get("pago_em", ""),
        "paciente_id": body.get("paciente_id", ""), "paciente_nome": body.get("paciente_nome", ""),
        "tutor_nome": body.get("tutor_nome", ""), "servico_id": body.get("servico_id", ""),
        "observacoes": body.get("observacoes", ""),
        "created_at": now_iso(), "created_by": user.get("name", ""),
    }
    if not doc["descricao"]:
        raise HTTPException(status_code=400, detail="Informe a descrição")
    if doc["status"] == "pago" and not doc["pago_em"]:
        doc["pago_em"] = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    await db.financeiro.insert_one(doc)
    await audit(user, "lançou financeiro", "financeiro", doc["id"], f"{tipo} R${doc['valor']}")
    doc.pop("_id", None)
    return doc


@api_router.put("/financeiro/{fid}")
async def update_financeiro(fid: str, body: dict, user: dict = Depends(require("financeiro:write"))):
    existing = await db.financeiro.find_one({"id": fid})
    if not existing:
        raise HTTPException(status_code=404, detail="Lançamento não encontrado")
    updates = {}
    for k in ["categoria", "descricao", "status", "forma_pagamento", "data", "vencimento",
              "pago_em", "observacoes", "paciente_nome"]:
        if k in body:
            updates[k] = body[k]
    for k in ["valor", "desconto"]:
        if k in body:
            updates[k] = _num(body[k])
    if updates.get("status") == "pago" and not existing.get("pago_em") and not updates.get("pago_em"):
        updates["pago_em"] = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    await db.financeiro.update_one({"id": fid}, {"$set": updates})
    await audit(user, "atualizou financeiro", "financeiro", fid, updates.get("status", ""))
    return await db.financeiro.find_one({"id": fid}, {"_id": 0})


@api_router.get("/financeiro/resumo")
async def resumo_financeiro(data_ini: Optional[str] = None, data_fim: Optional[str] = None,
                            user: dict = Depends(require("financeiro:read"))):
    query = {}
    if data_ini and data_fim:
        query["data"] = {"$gte": data_ini, "$lte": data_fim}
    rows = await db.financeiro.find(query, {"_id": 0}).to_list(5000)
    ativos = [r for r in rows if r.get("status") != "cancelado"]
    liq = lambda r: _num(r.get("valor")) - _num(r.get("desconto"))
    recebido = sum(liq(r) for r in ativos if r["tipo"] == "receita" and r["status"] == "pago")
    a_receber = sum(liq(r) for r in ativos if r["tipo"] == "receita" and r["status"] == "pendente")
    pago_desp = sum(liq(r) for r in ativos if r["tipo"] == "despesa" and r["status"] == "pago")
    a_pagar = sum(liq(r) for r in ativos if r["tipo"] == "despesa" and r["status"] == "pendente")
    return {
        "recebido": round(recebido, 2), "a_receber": round(a_receber, 2),
        "despesas": round(pago_desp, 2), "a_pagar": round(a_pagar, 2),
        "saldo": round(recebido - pago_desp, 2),
        "total_lancamentos": len(ativos),
    }


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("FRONTEND_URL", "http://localhost:3000"), "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.tutores.create_index("cpf")
    await db.pacientes.create_index("tutor_id")
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({
            "name": "Administrador", "email": admin_email, "password_hash": hash_password(admin_password),
            "role": "admin", "conselho": "", "active": True, "created_at": now_iso(),
        })
        logger.info("Admin criado")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})
    try:
        init_storage()
        logger.info("Storage inicializado")
    except Exception as e:
        logger.error(f"Storage init falhou: {e}")
    if await db.config.find_one({"id": "clinica"}) is None:
        await db.config.insert_one(dict(DEFAULT_CLINIC))


@app.on_event("shutdown")
async def shutdown():
    client.close()
