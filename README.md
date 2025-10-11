# Blueprint Dev Challenge — SecureLog

Overview

- Frontend: React + Vite (web/)
- Backend: FastAPI (server/) — encrypt/decrypt endpoints (RSA) + logs stored in Postgres
- DB: PostgreSQL (db service in docker-compose)

Run locally (Docker)

1. From repo root:
   docker compose down -v
   docker compose build --no-cache
   docker compose up -d

2. Visit:
   - Frontend: http://localhost:5173
   - API docs: http://localhost:8000/docs

Generate RSA keypair (example)

- Linux / macOS:
  ```bash
  openssl genpkey -algorithm RSA -out private.pem -pkeyopt rsa_keygen_bits:2048
  openssl rsa -pubout -in private.pem -out public.pem
  ```
- Windows (WSL or Git Bash): use same commands
- The frontend includes a "Generate RSA keypair" button which will populate the public key and copy the private key to clipboard (save it securely).

Sample API requests

- Encrypt (use public.pem). Example using jq to embed PEM into JSON (Linux/macOS):

  ```bash
  curl -s -X POST http://localhost:8000/api/v1/encrypt \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg k "$(cat public.pem)" --arg d "hello" '{key:$k,data:$d}')" | jq
  ```

  PowerShell (Windows):

  ```powershell
  $pub = Get-Content -Raw public.pem
  $body = @{ key = $pub; data = "hello" } | ConvertTo-Json
  curl.exe -s -X POST http://localhost:8000/api/v1/encrypt -H "Content-Type: application/json" -d $body
  ```

- Decrypt (use private.pem). Example (Linux/macOS):

  ```bash
  # assume $CIPHERTEXT contains base64 ciphertext from encrypt response
  curl -s -X POST http://localhost:8000/api/v1/decrypt \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg k "$(cat private.pem)" --arg d "$CIPHERTEXT" '{key:$k,data:$d}')" | jq
  ```

- Logs (paginated)

  ```bash
  curl -s "http://localhost:8000/api/v1/logs?size=25&offset=0" | jq
  ```

- Total logs
  ```bash
  curl -s "http://localhost:8000/api/v1/logs/count" | jq
  ```

Notes / API contract

- POST /api/v1/encrypt accepts JSON { "key": "<RSA public PEM>", "data": "<plaintext>" } and responds { "data": "<base64 ciphertext>" }.
- POST /api/v1/decrypt accepts JSON { "key": "<RSA private PEM>", "data": "<base64 ciphertext>" } and responds { "data": "<plaintext>" }.
- GET /api/v1/logs?size=<n>&offset=<m> returns an array of logs with objects exactly: { id: string (UUID), timestamp: int (UNIX seconds), ip: string, data: string }.
- Logs are stored in Postgres; id is UUID and timestamp is UNIX seconds.

Rebuild & test

```powershell
cd C:\Users\Aarav\Documents\Schoolwork\BlueprintDevChallenge
docker compose down -v
docker compose build --no-cache
docker compose up -d
docker compose logs -f server web db
```
