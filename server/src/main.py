from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from cryptography.fernet import Fernet, InvalidToken
import os
import time
import uuid
from typing import Any, Dict, List, Optional

import psycopg2

app = FastAPI()

# allow the frontend origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class KeyData(BaseModel):
    key: str
    data: str


# Database handling: prefer PostgreSQL when DATABASE_URL is provided and psycopg2 is available.
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable must be set to a Postgres DSN (postgresql://user:pass@host:port/db)")

DB_CONN = None


def wait_for_db(dsn: str, timeout: int = 30, interval: float = 1.0):
    """Wait until Postgres accepts connections or raise after timeout."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            conn = psycopg2.connect(dsn)
            conn.close()
            return
        except Exception:
            time.sleep(interval)
    raise RuntimeError("Timed out waiting for database")


def init_db():
    global DB_CONN
    wait_for_db(DATABASE_URL, timeout=60)
    DB_CONN = psycopg2.connect(DATABASE_URL)
    cur = DB_CONN.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS logs (
            id UUID PRIMARY KEY,
            timestamp BIGINT NOT NULL,
            ip TEXT,
            action TEXT,
            data TEXT
        );
        """
    )
    DB_CONN.commit()


@app.on_event("startup")
def startup():
    init_db()


def _get_client_ip(request: Optional[Request]) -> str:
    if not request:
        return "-"
    try:
        client = request.client
        if client and client.host:
            return client.host
        xff = request.headers.get("x-forwarded-for")
        return xff.split(",")[0].strip() if xff else "-"
    except Exception:
        return "-"


def insert_log(action: str, data: str, request: Optional[Request] = None) -> str:
    global DB_CONN
    ts = int(time.time())
    ip = _get_client_ip(request)
    log_id = str(uuid.uuid4())
    cur = DB_CONN.cursor()
    cur.execute(
        "INSERT INTO logs (id, timestamp, ip, action, data) VALUES (%s, %s, %s, %s, %s)",
        (log_id, ts, ip, action, data),
    )
    DB_CONN.commit()
    return log_id


@app.post("/api/v1/encrypt")
def encrypt_payload(payload: KeyData, request: Request):
    if not payload.key or not payload.data:
        raise HTTPException(status_code=400, detail="Key and data are required")
    try:
        f = Fernet(payload.key)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid Fernet key")
    try:
        token = f.encrypt(payload.data.encode())
    except Exception:
        raise HTTPException(status_code=500, detail="Encryption failed")
    # log (consider masking sensitive data in production)
    try:
        insert_log("encrypt", payload.data, request)
    except Exception:
        pass
    return {"data": token.decode()}


@app.post("/api/v1/decrypt")
def decrypt_payload(payload: KeyData, request: Request):
    if not payload.key or not payload.data:
        raise HTTPException(status_code=400, detail="Key and data are required")
    try:
        f = Fernet(payload.key)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid Fernet key")
    try:
        plain = f.decrypt(payload.data.encode())
        text = plain.decode()
    except InvalidToken:
        raise HTTPException(status_code=400, detail="Decryption failed: invalid token or key")
    except Exception:
        raise HTTPException(status_code=500, detail="Decryption failed")
    try:
        insert_log("decrypt", text, request)
    except Exception:
        pass
    return {"data": text}


@app.get("/api/v1/logs")
def get_logs(size: int = 25, offset: int = 0) -> List[Dict[str, Any]]:
    global DB_CONN
    cur = DB_CONN.cursor()
    cur.execute(
        "SELECT id::text, timestamp, ip, action, data FROM logs ORDER BY timestamp DESC LIMIT %s OFFSET %s",
        (size, offset),
    )
    rows = cur.fetchall()
    return [
        {"id": r[0], "timestamp": r[1], "ip": r[2], "action": r[3], "data": r[4]}
        for r in rows
    ]