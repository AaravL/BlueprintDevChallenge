from fastapi import FastAPI, Request
from pydantic import BaseModel
from cryptography.fernet import Fernet
import time
import uuid
from typing import Any

app = FastAPI()

class KeyData(BaseModel):
    key: str
    data: str

def insertLog(entry: str):
    return

@app.post("/api/v1/encrypt")
def encrypt_data(key_data: KeyData, request: Request):
    if(not key_data.key or not key_data.data):
        return {"error": "Key and data must be provided"}
    try:
        fernet = Fernet(key_data.key)
    except Exception as e:
        return {"error": "Invalid key format"}
    encrypted_data = fernet.encrypt(key_data.data.encode())
    return {"encrypted_data": encrypted_data.decode()}

@app.post("/api/v1/decrypt")
def decrypt_data(key_data: KeyData, request: Request):
    if(not key_data.key or not key_data.data):
        return {"error": "Key and data must be provided"}
    try:
        fernet = Fernet(key_data.key)
    except Exception as e:
        return {"error": "Invalid key format"}
    decrypted_data = fernet.decrypt(key_data.data.encode())
    return {"decrypted_data": decrypted_data.decode()}

@app.get("/api/v1/logs")
def read_logs():
    return {"message": "Hello, World!"}