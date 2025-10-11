import React, { JSX, useEffect, useState } from "react";
import axios from "axios";

const API = (import.meta as any).env.VITE_API_URL || "http://localhost:8000";

type LogEntry = {
  id: number;
  timestamp: number;
  ip?: string;
  action?: string;
  data?: string;
};

export function EncryptForm(): JSX.Element {
  const [key, setKey] = useState("");
  const [plaintext, setPlaintext] = useState("");
  const [cipher, setCipher] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const sample =
    "Hk3v1v0gZ0w4kYhR2pQ6v9u8jN3sXy1Zt5cB8rU0a1I=";

  async function doEncrypt() {
    setCipher(null);
    setLoading(true);
    try {
      const resp = await axios.post(`${API}/api/v1/encrypt`, {
        key: key || sample,
        data: plaintext || "hello-from-ui",
      });
      // accept either { encrypted_data } | { data }
      setCipher(resp.data?.data ?? resp.data?.encrypted_data ?? null);
    } catch (err: any) {
      alert(`Encrypt error: ${err?.response?.data ?? err?.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="form">
      <label>Fernet key (or leave blank to use sample)</label>
      <input
        value={key}
        onChange={(e) => setKey(e.target.value)}
        placeholder={sample}
      />
      <label>Plaintext</label>
      <textarea
        value={plaintext}
        onChange={(e) => setPlaintext(e.target.value)}
        rows={4}
      />
      <div className="row">
        <button onClick={doEncrypt} disabled={loading}>
          {loading ? "Encrypting…" : "Encrypt"}
        </button>
        <button
          className="secondary"
          onClick={() => {
            setKey("");
            setPlaintext("");
            setCipher(null);
          }}
        >
          Clear
        </button>
      </div>

      {cipher && (
        <>
          <label>Encrypted (base64)</label>
          <pre className="mono">{cipher}</pre>
        </>
      )}
    </div>
  );
}

export function DecryptForm(): JSX.Element {
  const [key, setKey] = useState("");
  const [cipher, setCipher] = useState("");
  const [plain, setPlain] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function doDecrypt() {
    setPlain(null);
    setLoading(true);
    try {
      const resp = await axios.post(`${API}/api/v1/decrypt`, {
        key,
        data: cipher,
      });
      // accept either { decrypted_data } | { data }
      setPlain(resp.data?.data ?? resp.data?.decrypted_data ?? null);
    } catch (err: any) {
      alert(`Decrypt error: ${err?.response?.data ?? err?.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="form">
      <label>Fernet key</label>
      <input
        value={key}
        onChange={(e) => setKey(e.target.value)}
        placeholder="Paste your Fernet key"
      />
      <label>Encrypted data (base64)</label>
      <textarea
        value={cipher}
        onChange={(e) => setCipher(e.target.value)}
        rows={4}
      />
      <div className="row">
        <button onClick={doDecrypt} disabled={loading}>
          {loading ? "Decrypting…" : "Decrypt"}
        </button>
        <button
          className="secondary"
          onClick={() => {
            setKey("");
            setCipher("");
            setPlain(null);
          }}
        >
          Clear
        </button>
      </div>

      {plain !== null && (
        <>
          <label>Decrypted plaintext</label>
          <pre className="mono">{plain}</pre>
        </>
      )}
    </div>
  );
}

export function LogsViewer(): JSX.Element {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const pageSize = 25;

  async function fetchLogs(p = 0) {
    setLoading(true);
    try {
      const offset = p * pageSize;
      const resp = await axios.get(`${API}/api/v1/logs?size=${pageSize}&offset=${offset}`);
      setLogs(resp.data as LogEntry[]);
    } catch (err) {
      console.error("Failed to load logs", err);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLogs(page);
    const id = setInterval(() => fetchLogs(page), 5000);
    return () => clearInterval(id);
  }, [page]);

  return (
    <div>
      <div className="row">
        <button onClick={() => fetchLogs(page)} disabled={loading}>Refresh</button>
        <div className="muted">{loading ? "Loading..." : `${logs.length} entries`}</div>
      </div>

      <div className="row" style={{marginTop:8,gap:6}}>
        <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>Prev</button>
        <button onClick={() => setPage((p) => p + 1)}>Next</button>
        <div className="muted">Page {page + 1}</div>
      </div>

      <div className="table-wrap">
        <table className="logs">
          <thead>
            <tr>
              <th>ID</th>
              <th>Timestamp</th>
              <th>IP</th>
              <th>Action</th>
              <th>Data</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td>{l.id}</td>
                <td>{new Date((l.timestamp || 0) * 1000).toLocaleString()}</td>
                <td>{l.ip ?? "-"}</td>
                <td>{l.action ?? "-"}</td>
                <td className="mono small">{l.data ?? ""}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  No logs
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}