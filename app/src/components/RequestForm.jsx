import React, { useState, useContext } from "react";
import { Web3Context } from "../context/Web3Context.jsx";
import CoordinatorABI from "../../../on-chain/abi/coordinator_abi.json";
import { useContract } from "../hooks/useContract.js";
import { COORDINATOR_ADDRESS, EXPECTED_CHAIN_ID, NETWORK_NAME, validateConfig } from "../config.js";

export default function RequestForm({ setStatus }) {
  const { accounts, networkId } = useContext(Web3Context);
  const coordinator = useContract(CoordinatorABI.abi, COORDINATOR_ADDRESS);

  const [infoHash, setInfoHash] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Check configuration
  const config = validateConfig();
  if (!config.isValid) {
    return (
      <div style={{ 
        padding: "15px", 
        backgroundColor: "#ffebee", 
        border: "1px solid #ef5350",
        borderRadius: "4px",
        marginBottom: "20px"
      }}>
        <h4 style={{ color: "#c62828", margin: "0 0 10px 0" }}>⚠️ Missing configuration</h4>
        <p>Configure the environment variables in the <code>.env</code> file:</p>
        <ul>
          {config.errors.map((error, i) => (
            <li key={i} style={{ color: "#c62828" }}>{error}</li>
          ))}
        </ul>
      </div>
    );
  }

  // Check MetaMask connection
  if (!accounts || accounts.length === 0) {
    return (
      <div style={{ 
        padding: "15px", 
        backgroundColor: "#fff3e0", 
        border: "1px solid #ff9800",
        borderRadius: "4px",
        marginBottom: "20px"
      }}>
        <p style={{ margin: 0 }}>🦊 Connect MetaMask to continue</p>
      </div>
    );
  }

  // Check correct network
  if (networkId && networkId !== EXPECTED_CHAIN_ID) {
    return (
      <div style={{ 
        padding: "15px", 
        backgroundColor: "#fff3e0", 
        border: "1px solid #ff9800",
        borderRadius: "4px",
        marginBottom: "20px"
      }}>
        <p style={{ margin: 0 }}>
          ⚠️ Wrong network. Please switch to <strong>{NETWORK_NAME}</strong> (Chain ID: {EXPECTED_CHAIN_ID})
        </p>
        <p style={{ margin: "10px 0 0 0", fontSize: "0.9em" }}>
          Current network: Chain ID {networkId}
        </p>
      </div>
    );
  }

  const sendRequest = async () => {
    if (!coordinator) return;
    if (!infoHash) {
      setStatus("Enter a valid infoHash");
      return;
    }

    // Check that infoHash is a valid bytes32
    if (!/^0x[a-fA-F0-9]{64}$/.test(infoHash)) {
      setStatus("infoHash must be a bytes32 value (0x followed by 64 hex characters)");
      return;
    }

    setIsLoading(true);
    setStatus("Sending request...");

    try {
      const receipt = await coordinator.methods
        .requestVerification(infoHash)
        .send({ from: accounts[0] });

      setStatus("Request sent. Waiting for proof...");
      
      // Extract requestId from the event
      if (receipt.events && receipt.events.VerificationRequested) {
        const requestId = receipt.events.VerificationRequested.returnValues.requestId;
        setStatus(`Request #${requestId} sent. Waiting for proof...`);
      }

    } catch (e) {
      console.error(e);
      if (e.code === 4001) {
        setStatus("Transaction rejected by user");
      } else {
        setStatus("Error sending request: " + e.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to generate a sample infoHash
  const generateSampleInfoHash = () => {
    // Generate a random hash for testing
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    const hash = "0x" + Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
    setInfoHash(hash);
  };

  return (
    <div style={{ marginBottom: "20px" }}>
      <h3>📝 Request Verification</h3>
      
      <div style={{ marginBottom: "10px" }}>
        <label style={{ display: "block", marginBottom: "5px" }}>
          InfoHash (bytes32):
        </label>
        <input
          type="text"
          placeholder="0x..."
          value={infoHash}
          onChange={(e) => setInfoHash(e.target.value)}
          style={{ 
            width: "100%", 
            padding: "10px",
            fontFamily: "monospace",
            fontSize: "14px",
            border: "1px solid #ccc",
            borderRadius: "4px"
          }}
          disabled={isLoading}
        />
      </div>

      <div style={{ display: "flex", gap: "10px" }}>
        <button 
          onClick={sendRequest} 
          disabled={isLoading || !infoHash}
          style={{
            padding: "10px 20px",
            backgroundColor: isLoading ? "#ccc" : "#2196F3",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: isLoading ? "not-allowed" : "pointer"
          }}
        >
          {isLoading ? "Sending..." : "Send Request"}
        </button>

        <button 
          onClick={generateSampleInfoHash}
          disabled={isLoading}
          style={{
            padding: "10px 20px",
            backgroundColor: "#f5f5f5",
            color: "#333",
            border: "1px solid #ccc",
            borderRadius: "4px",
            cursor: isLoading ? "not-allowed" : "pointer"
          }}
        >
          Generate Test Hash
        </button>
      </div>

      <p style={{ fontSize: "0.85em", color: "#666", marginTop: "10px" }}>
        Connected account: <code>{accounts[0]}</code>
      </p>
    </div>
  );
}
