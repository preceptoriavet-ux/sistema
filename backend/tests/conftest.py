import os
from pymongo import MongoClient


def pytest_sessionfinish(session):
    if hasattr(session.config, "workerinput"):
        return
    db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    ids = [p["id"] for p in db.pacientes.find({"nome": {"$regex": "^TEST_"}}, {"id": 1})]
    for c in ["prontuarios", "exames", "documentos", "triagem", "vacinas", "agendamentos", "fila"]:
        db[c].delete_many({"paciente_id": {"$in": ids}})
    db.pacientes.delete_many({"id": {"$in": ids}})
    db.tutores.delete_many({"nome": {"$regex": "^TEST_"}})
