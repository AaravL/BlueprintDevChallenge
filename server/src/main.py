from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from cryptography.fernet import Fernet
import os
import time
import psycopg2
from psycopg2 import OperationalError
from typing import Any, List, Dict, Optional
import uuid

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


def wait_for_db(dsn: str, timeout: int = 60, interval: float = 1.0) -> None:
    """Wait until Postgres accepts connections or raise after timeout."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            conn = psycopg2.connect(dsn)
            conn.close()
            return
        except OperationalError:
            time.sleep(interval)
    raise RuntimeError(f"Could not connect to the database within {timeout} seconds")


def init_db():
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        raise RuntimeError("DATABASE_URL is required")
    # wait for postgres to be ready
    wait_for_db(dsn, timeout=60, interval=1.0)
    global DB_CONN
    DB_CONN = psycopg2.connect(dsn)
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


def insert_log(action: str, data: str, request: Optional[Request] = None):
    global DB_CONN
    ts = int(time.time())
    ip = "-"
    try:
        if request is not None:
            client = request.client
            if client:
                ip = client.host
            else:
                ip = request.headers.get("x-forwarded-for", "-")
    except Exception:
        pass

    # generate a UUID for the log id (match requirement)
    log_id = str(uuid.uuid4())
    cur = DB_CONN.cursor()
    cur.execute(
        "INSERT INTO logs (id, timestamp, ip, action, data) VALUES (%s, %s, %s, %s, %s)",
        (log_id, ts, ip, action, data),
    )
    DB_CONN.commit()
    return log_id


def read_logs(size: int = 10, offset: int = 0) -> List[Dict[str, Any]]:
    global DB_CONN
    cur = DB_CONN.cursor()
    cur.execute("SELECT id::text, timestamp, ip, action, data FROM logs ORDER BY timestamp DESC LIMIT %s OFFSET %s", (size, offset))
    rows = cur.fetchall()
    result = []
    for r in rows:
        result.append({
            "id": r[0],
            "timestamp": r[1],
            "ip": r[2],
            "action": r[3],
            "data": r[4],
        })
    return result


# initialize DB on import
init_db()


@app.post("/api/v1/encrypt")
def encrypt_data(key_data: KeyData, request: Request):
    if not key_data.key or not key_data.data:
        return {"error": "Key and data must be provided"}
    try:
        fernet = Fernet(key_data.key)
    except Exception:
        return {"error": "Invalid key format"}
    encrypted_data = fernet.encrypt(key_data.data.encode())
    # log the plaintext action (consider redaction for production)
    try:
        insert_log("encrypt", key_data.data, request)
    except Exception:
        pass
    # return shape per spec: { data: str }
    return {"data": encrypted_data.decode()}


@app.post("/api/v1/decrypt")
def decrypt_data(key_data: KeyData, request: Request):
    if not key_data.key or not key_data.data:
        return {"error": "Key and data must be provided"}
    try:
        fernet = Fernet(key_data.key)
    except Exception:
        return {"error": "Invalid key format"}
    try:
        decrypted_data = fernet.decrypt(key_data.data.encode())
        decrypted_text = decrypted_data.decode()
    except Exception:
        return {"error": "Decryption failed"}
    # log the decrypted plaintext (consider redaction for production)
    try:
        insert_log("decrypt", decrypted_text, request)
    except Exception:
        pass
    # return shape per spec: { data: str }
    return {"data": decrypted_text}


@app.get("/api/v1/logs")
def api_read_logs(size: int = 10, offset: int = 0):
    try:
        rows = read_logs(size=size, offset=offset)
        return rows
    except Exception as e:
        return {"error": str(e)}