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
  const [error, setError] = useState<string | null>(null);
  const sample =
    "Hk3v1v0gZ0w4kYhR2pQ6v9u8jN3sXy1Zt5cB8rU0a1I=";

  function generateFernetKey(): string {
    const arr = new Uint8Array(32);
    crypto.getRandomValues(arr);
    // convert to base64 then to URL-safe base64
    let b64 = btoa(String.fromCharCode(...arr));
    b64 = b64.replace(/\+/g, "-").replace(/\//g, "_");
    // keep padding (Fernet keys returned by libraries include padding)
    return b64;
  }

  function handleGenerateKey() {
    const k = generateFernetKey();
    setKey(k);
    setError(null);
  }

  async function doEncrypt() {
    setCipher(null);
    setError(null);
    setLoading(true);
    try {
      const resp = await axios.post(`${API}/api/v1/encrypt`, {
        key: key || sample,
        data: plaintext || "hello-from-ui",
      });
      // accept either { data } | { encrypted_data }
      setCipher(resp.data?.data ?? resp.data?.encrypted_data ?? null);
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ??
        err?.response?.data?.error ??
        (typeof err?.response?.data === "string" ? err.response.data : null) ??
        err?.message ??
        "Unknown error";
      console.error("Encrypt error", err);
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="form">
      <label>Fernet key (or leave blank to use sample)</label>
      <input
        value={key}
        onChange={(e) => {
          setKey(e.target.value);
          setError(null);
        }}
        placeholder={sample}
      />
      <label>Plaintext</label>
      <textarea
        value={plaintext}
        onChange={(e) => {
          setPlaintext(e.target.value);
          setError(null);
        }}
        rows={4}
      />
      <div className="row controls">
        <button onClick={doEncrypt} disabled={loading}>
          {loading ? "Encrypting…" : "Encrypt"}
        </button>
        <button
          className="secondary"
          onClick={() => {
            setKey("");
            setPlaintext("");
            setCipher(null);
            setError(null);
          }}
        >
          Clear
        </button>
        <button
          className="secondary"
          onClick={handleGenerateKey}
          title="Generate a new Fernet key"
          style={{ marginLeft: 6 }}
        >
          Generate key
        </button>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            marginTop: 10,
            padding: 10,
            borderRadius: 6,
            background: "#fff1f2",
            color: "#7f1d1d",
            border: "1px solid #fecaca",
          }}
        >
          {error}
        </div>
      )}

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
  const [error, setError] = useState<string | null>(null);

  async function doDecrypt() {
    setPlain(null);
    setError(null);
    setLoading(true);
    try {
      const resp = await axios.post(`${API}/api/v1/decrypt`, {
        key,
        data: cipher,
      });
      // accept either { data } | { decrypted_data }
      setPlain(resp.data?.data ?? resp.data?.decrypted_data ?? null);
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ??
        err?.response?.data?.error ??
        (typeof err?.response?.data === "string" ? err.response.data : null) ??
        err?.message ??
        "Unknown error";
      console.error("Decrypt error", err);
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="form">
      <label>Fernet key</label>
      <input
        value={key}
        onChange={(e) => {
          setKey(e.target.value);
          setError(null);
        }}
        placeholder="Paste your Fernet key"
      />
      <label>Encrypted data (base64)</label>
      <textarea
        value={cipher}
        onChange={(e) => {
          setCipher(e.target.value);
          setError(null);
        }}
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
            setError(null);
          }}
        >
          Clear
        </button>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            marginTop: 10,
            padding: 10,
            borderRadius: 6,
            background: "#fff1f2",
            color: "#7f1d1d",
            border: "1px solid #fecaca",
          }}
        >
          {error}
        </div>
      )}

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

  const [totalLogs, setTotalLogs] = useState<number | null>(null);
  const [computingTotal, setComputingTotal] = useState(false);

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

  // compute total by paging until a page returns less than pageSize (capped)
  async function computeTotalLogs(signal?: AbortSignal) {
    setComputingTotal(true);
    setTotalLogs(null);
    try {
      let total = 0;
      let pageIndex = 0;
      const maxTotal = 200000; // safety cap
      while (true) {
        const offset = pageIndex * pageSize;
        const resp = await axios.get(`${API}/api/v1/logs?size=${pageSize}&offset=${offset}`, { signal });
        const pageData = resp.data as LogEntry[];
        const n = Array.isArray(pageData) ? pageData.length : 0;
        total += n;
        if (n < pageSize) break;
        pageIndex += 1;
        if (total >= maxTotal) break;
      }
      setTotalLogs(total);
    } catch (err: any) {
      if (err?.name === "CanceledError" || err?.message === "canceled") {
        // aborted by user/unmount
      } else {
        console.error("Failed to compute total logs", err);
        setTotalLogs(null);
      }
    } finally {
      setComputingTotal(false);
    }
  }

  useEffect(() => {
    fetchLogs(page);
    const id = setInterval(() => fetchLogs(page), 5000);
    // compute total on mount
    const ac = new AbortController();
    computeTotalLogs(ac.signal);
     return () => clearInterval(id);
   }, [page]);

  return (
    <div>
      <div className="row">
        <button onClick={() => { fetchLogs(page); /* also refresh total */ const ac = new AbortController(); computeTotalLogs(ac.signal); }} disabled={loading}>Refresh</button>
        <div className="muted">
          {loading ? "Loading..." : `${logs.length} entries (page size ${pageSize})`}
          &nbsp;•&nbsp;Total:&nbsp;
          {computingTotal ? "computing…" : (totalLogs === null ? "unknown" : totalLogs)}
        </div>
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