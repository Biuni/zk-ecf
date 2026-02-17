import React, { useState } from "react";
import RequestForm from "./components/RequestForm.jsx";
import StatusPanel from "./components/StatusPanel.jsx";
import ResultPanel from "./components/ResultPanel.jsx";
import ContractEvents from "./components/ContractEvents.jsx";
import { NETWORK_NAME, EXPECTED_CHAIN_ID } from "./config.js";

export default function App() {
  const [status, setStatus] = useState("Waiting for a request...");
  const [result, setResult] = useState(null);

  return (
    <div style={{ 
      maxWidth: "800px", 
      margin: "0 auto", 
      padding: "20px",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif"
    }}>
      {/* Header */}
      <div style={{ 
        marginBottom: "30px",
        paddingBottom: "20px",
        borderBottom: "2px solid #e0e0e0"
      }}>
        <h1 style={{ 
          margin: "0 0 10px 0",
          color: "#1a237e"
        }}>
          🔐 ZK-Oracle Demo
        </h1>
        <p style={{ 
          margin: 0,
          color: "#666",
          fontSize: "1.1em"
        }}>
          On-chain Zero-Knowledge Proof verification system
        </p>
        <div style={{ 
          marginTop: "10px",
          display: "flex",
          gap: "15px",
          fontSize: "0.9em"
        }}>
          <span style={{ 
            padding: "3px 8px",
            backgroundColor: "#e8eaf6",
            borderRadius: "4px",
            color: "#3f51b5"
          }}>
            📡 Network: {NETWORK_NAME}
          </span>
          <span style={{ 
            padding: "3px 8px",
            backgroundColor: "#e8eaf6",
            borderRadius: "4px",
            color: "#3f51b5"
          }}>
            🔗 Chain ID: {EXPECTED_CHAIN_ID}
          </span>
        </div>
      </div>

      {/* How it works */}
      <div style={{ 
        marginBottom: "25px",
        padding: "15px",
        backgroundColor: "#f5f5f5",
        borderRadius: "8px",
        fontSize: "0.9em"
      }}>
        <h4 style={{ margin: "0 0 10px 0", color: "#424242" }}>📖 How it works:</h4>
        <ol style={{ margin: 0, paddingLeft: "20px", color: "#616161" }}>
          <li>Enter an <strong>infoHash</strong> (verification identifier)</li>
          <li>The <strong>Coordinator</strong> records the request on-chain</li>
          <li>The <strong>off-chain Oracle</strong> generates the zero-knowledge proof</li>
          <li>The proof is verified on-chain by the <strong>Verifier</strong></li>
          <li>The result is stored in the <strong>ProofManager</strong></li>
        </ol>
      </div>

      {/* Main content */}
      <RequestForm setStatus={setStatus} />
      <StatusPanel status={status} />
      <ResultPanel result={result} />
      <ContractEvents setStatus={setStatus} setResult={setResult} />

      {/* Footer */}
      <div style={{ 
        marginTop: "40px",
        paddingTop: "20px",
        borderTop: "1px solid #e0e0e0",
        textAlign: "center",
        color: "#9e9e9e",
        fontSize: "0.85em"
      }}>
        <p>ZK-Oracle Prototype • FuelUse Verification Circuit</p>
      </div>
    </div>
  );
}
