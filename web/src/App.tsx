import React from 'react'
import EncryptForm from './AppFuncs'

export default function App() {
  return (
    <div style={{ padding: 20 }}>
      <h1>Blueprint dev challenge</h1>
      <p>Enter Logs</p>
      <p>Encrypt Data</p>
      <EncryptForm />
      
      <p>Decrypt Data</p>
      <p>View Logs</p>

    </div>
  )
}
