# Blueprint Dev Challenge — SecureLog

Quick overview

- Frontend: React + Vite (web/)
- Backend: FastAPI (server/) — encrypt/decrypt endpoints + logs stored in Postgres
- DB: PostgreSQL (db service in docker-compose)

Run locally (Docker)

1. From repo root:
   docker compose down -v
   docker compose build --no-cache
   docker compose up -d

2. Visit:
   - Frontend: http://localhost:5173
   - API docs: http://localhost:8000/docs

Dev (frontend)
cd web
npm install
$env:VITE_API_URL='http://localhost:8000'
npm run dev

Sample API requests

# Encrypt

curl -s -X POST http://localhost:8000/api/v1/encrypt \
 -H "Content-Type: application/json" \
 -d '{"key":"<FERNET_KEY>","data":"hello"}' | jq

# Decrypt

curl -s -X POST http://localhost:8000/api/v1/decrypt \
 -H "Content-Type: application/json" \
 -d '{"key":"<FERNET_KEY>","data":"<ENCRYPTED>"}' | jq

# Logs (paginated)

curl -s "http://localhost:8000/api/v1/logs?size=25&offset=0" | jq

Notes

- Backend returns {"data": "<payload>"} for both encrypt and decrypt.
- Invalid or malformed Fernet keys now return 400 with a clear error message.
- CI lint workflows included: .github/workflows/server-lint.yml and web-lint.yml
