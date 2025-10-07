import React from "react";

export default function EncryptForm() {
  const [key, setKey] = React.useState("");
  const [data, setData] = React.useState("");
  const [result, setResult] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!key || !data) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/v1/encrypt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, data }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Server error: ${res.status} - ${errBody}`);
      }

      const json = await res.json();
      setResult(json.data ?? JSON.stringify(json));
    } catch (err: any) {
      console.error("Encrypt error:", err);
      setResult(`Error: ${err?.message ?? String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2>Encrypt Data</h2>
      <form onSubmit={handleSubmit}>
        <label>
          Key:
          <input value={key} onChange={(e) => setKey(e.target.value)} />
        </label>
        <br />
        <label>
          Data:
          <input value={data} onChange={(e) => setData(e.target.value)} />
        </label>
        <br />
        <button type="submit" disabled={loading || !key || !data}>
          {loading ? "Encrypting..." : "Encrypt"}
        </button>
      </form>

      <div style={{ marginTop: 12 }}>
        <h3>Result</h3>
        <pre>{result ?? "(no result yet)"}</pre>
      </div>
    </div>
  );
}