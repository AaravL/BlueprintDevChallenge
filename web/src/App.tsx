import React from "react";
import * as AF from "./AppFuncs";
import "./styles.css";

export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <div className="logo">🔒</div>
          <div>
            <h1>Blueprint SecureLog</h1>
            <div className="subtitle">Encrypt · Decrypt · Audit Logs</div>
          </div>
        </div>
      </header>

      <main className="app-main">
        <div className="grid">
          <section className="card">
            <h2>Encrypt</h2>
            <AF.EncryptForm />
          </section>

          <section className="card">
            <h2>Decrypt</h2>
            <AF.DecryptForm />
          </section>

          <section className="card full">
            <h2>Logs</h2>
            <AF.LogsViewer />
          </section>
        </div>
      </main>

      <footer className="app-footer">
        <div className="muted">Blueprint Dev Challenge</div>
      </footer>
    </div>
  );
}
