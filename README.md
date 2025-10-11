# Blueprint Dev Challenge — SecureLog

Overview
This setup was tested and worked on Windows 11.

- Frontend: React + Vite (web/)
- Backend: FastAPI (server/) — RSA encrypt/decrypt endpoints + logs stored in Postgres
- DB: PostgreSQL (db service in docker-compose)

Run locally (Docker)

1. From repo root:

   ```powershell
   docker compose down -v
   docker compose build --no-cache
   docker compose up -d
   ```

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

- Encrypt (use public.pem).

  Option A — create a JSON payload file (recommended to preserve PEM formatting):

  1. Create payload.json with contents (make sure newlines in the PEM are preserved or escaped):
     ```json
     {
       "key": "-----BEGIN PUBLIC KEY-----\n...your public key...\n-----END PUBLIC KEY-----\n",
       "data": "hello"
     }
     ```
  2. Send with curl:
     ```bash
     curl -s -X POST http://localhost:8000/api/v1/encrypt \
       -H "Content-Type: application/json" \
       --data-binary @payload.json
     ```

  Option B — PowerShell (Windows):

  ```powershell
  $pub = Get-Content -Raw public.pem
  $body = @{ key = $pub; data = "hello" } | ConvertTo-Json
  curl.exe -s -X POST http://localhost:8000/api/v1/encrypt -H "Content-Type: application/json" -d $body
  ```

- Decrypt (use private.pem).

  Option A — payload file:

  ```json
  {
    "key": "-----BEGIN PRIVATE KEY-----\n...your private key...\n-----END PRIVATE KEY-----\n",
    "data": "<base64 ciphertext>"
  }
  ```

  ```bash
  curl -s -X POST http://localhost:8000/api/v1/decrypt \
    -H "Content-Type: application/json" \
    --data-binary @payload_decrypt.json
  ```

  Option B — PowerShell (Windows):

  ```powershell
  $cipher = "<base64-from-encrypt>"
  $priv = Get-Content -Raw private.pem
  $body = @{ key = $priv; data = $cipher } | ConvertTo-Json
  curl.exe -s -X POST http://localhost:8000/api/v1/decrypt -H "Content-Type: application/json" -d $body
  ```

- Logs (paginated)

  ```bash
  curl -s "http://localhost:8000/api/v1/logs?size=25&offset=0"
  ```

- Total logs
  ```bash
  curl -s "http://localhost:8000/api/v1/logs/count"
  ```

Notes / API contract

- POST /api/v1/encrypt accepts JSON { "key": "<RSA public PEM>", "data": "<plaintext>" } and responds { "data": "<base64 ciphertext>" }.
- POST /api/v1/decrypt accepts JSON { "key": "<RSA private PEM>", "data": "<base64 ciphertext>" } and responds { "data": "<plaintext>" }.
- GET /api/v1/logs?size=<n>&offset=<m> returns an array of logs with objects exactly: { id: string (UUID), timestamp: int (UNIX seconds), ip: string, data: string }.
- Logs are stored in Postgres; id is UUID and timestamp is UNIX seconds.

Rebuild & test

```powershell
docker compose down -v
docker compose build --no-cache
docker compose up -d
docker compose logs -f server web db
```

Linting / CI

- Server dev requirements: server/dev-requirements.txt (ruff, pytest, black)
- Workflows:
  - .github/workflows/server-lint.yml runs ruff (ruff check server)
  - .github/workflows/web-lint.yml runs TypeScript check (npx tsc --noEmit)
- To run linters locally (PowerShell):

  ```powershell
  python -m venv .venv
  .\.venv\Scripts\Activate
  pip install --upgrade pip
  pip install -r server/dev-requirements.txt
  ruff check server

  cd web
  npm ci
  npx tsc --noEmit
  ```

Notes / important

- CORS is set to allow all origins for local development. Restrict this before production.
- Ensure server Dockerfile runs Uvicorn with `--host 0.0.0.0` and docker-compose maps port 8000:8000.
