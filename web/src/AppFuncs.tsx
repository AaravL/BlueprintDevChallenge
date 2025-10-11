import React, { JSX, useEffect, useState } from "react";
import axios from "axios";

const API = (import.meta as any).env.VITE_API_URL || "http://localhost:8000";

type LogEntry = {
  id: string;
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

  async function generateRSAKeypair(): Promise<{ publicPem: string; privatePem: string }> {
    const kp = await crypto.subtle.generateKey(
      {
        name: "RSA-OAEP",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["encrypt", "decrypt"]
    );

    const spki = await crypto.subtle.exportKey("spki", kp.publicKey);
    const pkcs8 = await crypto.subtle.exportKey("pkcs8", kp.privateKey);

    const toPEM = (buf: ArrayBuffer, label: string) => {
      const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      const chunked = b64.match(/.{1,64}/g)?.join("\n") ?? b64;
      return `-----BEGIN ${label}-----\n${chunked}\n-----END ${label}-----\n`;
    };

    return {
      publicPem: toPEM(spki, "PUBLIC KEY"),
      privatePem: toPEM(pkcs8, "PRIVATE KEY"),
    };
  }

  async function handleGenerateKeypair() {
    try {
      setError(null);
      const { publicPem, privatePem } = await generateRSAKeypair();
      setKey(publicPem);
      // try to copy private key to clipboard
      try {
        await navigator.clipboard.writeText(privatePem);
        setError("Private key copied to clipboard — save it securely.");
      } catch {
        // if clipboard failed, show the private key in the error box (user can copy it)
        setError("Generated private key (copy it now):\n\n" + privatePem);
      }
    } catch (e: any) {
      console.error("Keygen failed", e);
      setError("Failed to generate RSA keypair");
    }
  }

  async function doEncrypt() {
    setCipher(null);
    setError(null);
    setLoading(true);
    try {
      const resp = await axios.post(`${API}/api/v1/encrypt`, {
        key,
        data: plaintext || "hello-from-ui",
      });
      setCipher(resp.data?.data ?? null);
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
      <label>Public key (PEM)</label>
      <textarea
        value={key}
        onChange={(e) => {
          setKey(e.target.value);
          setError(null);
        }}
        rows={6}
        placeholder="Paste RSA public key (PEM format) here, or generate one"
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
        <button className="secondary" onClick={handleGenerateKeypair} style={{ marginLeft: 6 }}>
          Generate RSA keypair
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
            whiteSpace: "pre-wrap",
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
      setPlain(resp.data?.data ?? null);
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
      <label>Private key (PEM)</label>
      <textarea
        value={key}
        onChange={(e) => {
          setKey(e.target.value);
          setError(null);
        }}
        rows={8}
        placeholder="Paste RSA private key (PEM format) here"
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
            whiteSpace: "pre-wrap",
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

  // helper to fetch a specific page and return the entries
  async function fetchPage(p = 0): Promise<LogEntry[]> {
    const offset = p * pageSize;
    const resp = await axios.get(`${API}/api/v1/logs?size=${pageSize}&offset=${offset}`);
    return (resp.data as LogEntry[]) ?? [];
  }

  async function fetchLogs(p = 0) {
    setLoading(true);
    try {
      const pageData = await fetchPage(p);
      setLogs(pageData);
    } catch (err) {
      console.error("Failed to load logs", err);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }

  async function fetchTotal() {
    setComputingTotal(true);
    try {
      // Try the fast server-provided count endpoint first
      const resp = await axios.get(`${API}/api/v1/logs/count`);
      if (resp.status === 200 && typeof resp.data?.total === "number") {
        setTotalLogs(resp.data.total);
        return;
      }
    } catch {
      // fall through to fallback counting
    }

    // Fallback: page through logs until a short page is returned (safe cap)
    try {
      let total = 0;
      let pageIndex = 0;
      const maxPages = 200; // safety cap to avoid huge workloads
      while (pageIndex < maxPages) {
        const offset = pageIndex * pageSize;
        const resp = await axios.get(`${API}/api/v1/logs?size=${pageSize}&offset=${offset}`);
        const pageData = resp.data as LogEntry[] | null;
        const n = Array.isArray(pageData) ? pageData.length : 0;
        total += n;
        if (n < pageSize) break;
        pageIndex += 1;
      }
      setTotalLogs(total);
    } catch (err) {
      console.error("Failed to compute total logs", err);
      setTotalLogs(null);
    } finally {
      setComputingTotal(false);
    }
  }

  useEffect(() => {
    fetchLogs(page);
    const id = setInterval(() => fetchLogs(page), 5000);
    fetchTotal();
    return () => clearInterval(id);
  }, [page]);

  return (
    <div>
      <div className="row">
        <button onClick={() => { fetchLogs(page); fetchTotal(); }} disabled={loading}>Refresh</button>
        <div className="muted">
          {loading ? "Loading..." : `${logs.length} entries (page size ${pageSize})`}
          &nbsp;•&nbsp;Total:&nbsp;
          {computingTotal ? "computing…" : (totalLogs === null ? "unknown" : totalLogs)}
        </div>
      </div>

      <div className="row" style={{ marginTop: 8, gap: 6 }}>
        <button
          onClick={async () => {
            if (page === 0) return;
            const prevPage = page - 1;
            setPage(prevPage);
          }}
          disabled={page === 0}
        >
          Prev
        </button>
        <button
          onClick={async () => {
            // attempt to fetch the next page first; only advance if it has entries
            try {
              const nextData = await fetchPage(page + 1);
              if (nextData.length > 0) {
                setPage((p) => p + 1);
                setLogs(nextData);
              } // otherwise do nothing (no more pages)
            } catch (err) {
              console.error("Failed to fetch next page", err);
            }
          }}
          disabled={loading}
        >
          Next
        </button>
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
                <td colSpan={5} className="muted">No logs</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}