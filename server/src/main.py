"""
FastAPI RSA Encrypt/Decrypt API

Endpoints:
- POST /api/v1/encrypt
  Accepts JSON { "key": "<RSA public PEM>", "data": "<plaintext>" }
  Returns { "data": "<base64 ciphertext>" }.

- POST /api/v1/decrypt
  Accepts JSON { "key": "<RSA private PEM>", "data": "<base64 ciphertext>" }
  Returns { "data": "<plaintext>" }.

- GET /api/v1/logs?size=<n>&offset=<m>
  Returns an array of logs (paginated) with objects exactly:
    { "id": string (UUID), "timestamp": int (UNIX seconds), "ip": string, "data": string }

Notes:
- RSA OAEP with SHA-256 is used for encryption/decryption.
- Encrypted payloads are base64-encoded when returned by /encrypt.
- Logs are persisted in PostgreSQL; id is UUID and timestamp is UNIX seconds.
"""

from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os, time, uuid, base64
import psycopg2
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.exceptions import InvalidKey
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# allow the frontend origin
app.add_middleware(
    CORSMiddleware,
    # allow all origins during development so the browser can reach the API
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class KeyData(BaseModel):
    key: str
    data: str

class LogEntry(BaseModel):
    id: str
    timestamp: int      # UNIX seconds
    ip: Optional[str]
    data: Optional[str]

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://appuser:secretpassword@db:5432/appdb")
_db = None

def wait_for_db(dsn: str, timeout: int = 60):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            conn = psycopg2.connect(dsn)
            conn.close()
            return
        except Exception:
            time.sleep(1)
    raise RuntimeError("DB did not become available")

def init_db():
    global _db
    wait_for_db(DATABASE_URL)
    _db = psycopg2.connect(DATABASE_URL)
    cur = _db.cursor()
    cur.execute("""
      CREATE TABLE IF NOT EXISTS logs (
        id UUID PRIMARY KEY,
        timestamp BIGINT NOT NULL,
        ip TEXT,
        action TEXT,
        data TEXT
      );
    """)
    _db.commit()

@app.on_event("startup")
def startup_event():
    init_db()

def _client_ip(request: Optional[Request]) -> str:
    if not request: return "-"
    try:
        return request.client.host or "-"
    except Exception:
        return "-"

def insert_log(action: str, data: str, request: Optional[Request] = None) -> str:
    global _db
    ts = int(time.time())
    ip = _client_ip(request)
    log_id = str(uuid.uuid4())
    cur = _db.cursor()
    cur.execute(
      "INSERT INTO logs (id, timestamp, ip, action, data) VALUES (%s, %s, %s, %s, %s)",
      (log_id, ts, ip, action, data)
    )
    _db.commit()
    return log_id

@app.post("/api/v1/encrypt", response_model=Dict[str, str])
def encrypt_payload(body: KeyData, request: Request):
    if not body.key or not body.data:
        raise HTTPException(status_code=400, detail="Key and data are required")
    try:
        public_key = serialization.load_pem_public_key(body.key.encode())
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid public key (PEM expected)")
    try:
        ciphertext = public_key.encrypt(
            body.data.encode(),
            padding.OAEP(mgf=padding.MGF1(hashes.SHA256()), algorithm=hashes.SHA256(), label=None)
        )
        token = base64.b64encode(ciphertext).decode()
    except Exception:
        raise HTTPException(status_code=500, detail="Encryption failed")
    try:
        insert_log("encrypt", body.data, request)
    except Exception:
        pass
    return {"data": token}

@app.post("/api/v1/decrypt", response_model=Dict[str, str])
def decrypt_payload(body: KeyData, request: Request):
    if not body.key or not body.data:
        raise HTTPException(status_code=400, detail="Key and data are required")
    try:
        private_key = serialization.load_pem_private_key(body.key.encode(), password=None)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid private key")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid private key (PEM expected)")
    try:
        ciphertext = base64.b64decode(body.data)
    except Exception:
        raise HTTPException(status_code=400, detail="Encrypted data is not valid base64")
    try:
        plaintext = private_key.decrypt(
            ciphertext,
            padding.OAEP(mgf=padding.MGF1(hashes.SHA256()), algorithm=hashes.SHA256(), label=None)
        ).decode()
    except Exception:
        raise HTTPException(status_code=400, detail="Decryption failed: invalid token or key")
    try:
        insert_log("decrypt", plaintext, request)
    except Exception:
        pass
    return {"data": plaintext}

@app.get("/api/v1/logs", response_model=List[LogEntry])
def get_logs(size: int = 25, offset: int = 0):
    global _db
    cur = _db.cursor()
    # ORDER BY timestamp ASC so offset counts from beginning (oldest-first). Change if needed.
    cur.execute("SELECT id::text, timestamp, ip, data FROM logs ORDER BY timestamp ASC LIMIT %s OFFSET %s", (size, offset))
    rows = cur.fetchall()
    return [{"id": r[0], "timestamp": int(r[1]), "ip": r[2], "data": r[3]} for r in rows]

@app.get("/api/v1/logs/count")
def logs_count():
    global _db
    cur = _db.cursor()
    cur.execute("SELECT COUNT(*) FROM logs")
    total = cur.fetchone()[0]
    return {"total": int(total)}