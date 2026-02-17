import React, { useEffect, useState, useRef } from "react";
import CoordinatorABI from "../../../on-chain/abi/coordinator_abi.json";
import { useContract } from "../hooks/useContract";
import { COORDINATOR_ADDRESS } from "../config.js";

export default function ContractEvents({ setStatus, setResult }) {
  const coordinator = useContract(CoordinatorABI.abi, COORDINATOR_ADDRESS);
  const [events, setEvents] = useState([]);
  const subscriptionsRef = useRef([]);

  useEffect(() => {
    if (!coordinator) return;

    const setupSubscriptions = async () => {
      try {
        // Subscribe to VerificationRequested
        const requestedSub = await coordinator.events.VerificationRequested({
          fromBlock: 'latest'
        });

        requestedSub.on('data', (evt) => {
          const { requestId, requester, infoHash } = evt.returnValues;
          setStatus(`Request #${requestId} received by Coordinator`);
          
          setEvents(prev => [...prev, {
            type: "VerificationRequested",
            requestId,
            requester,
            infoHash,
            timestamp: new Date(),
            blockNumber: evt.blockNumber,
            transactionHash: evt.transactionHash
          }]);
        });

        requestedSub.on('error', (err) => {
          console.error("VerificationRequested subscription error:", err);
        });

        subscriptionsRef.current.push(requestedSub);

        // Subscribe to ProofFound
        const proofFoundSub = await coordinator.events.ProofFound({
          fromBlock: 'latest'
        });

        proofFoundSub.on('data', (evt) => {
          const { requestId, proofHash } = evt.returnValues;
          setStatus(`✅ Proof found for request #${requestId}!`);
          setResult({
            requestId,
            proofHash,
            blockNumber: evt.blockNumber,
            transactionHash: evt.transactionHash
          });

          setEvents(prev => [...prev, {
            type: "ProofFound",
            requestId,
            proofHash,
            timestamp: new Date(),
            blockNumber: evt.blockNumber,
            transactionHash: evt.transactionHash
          }]);
        });

        proofFoundSub.on('error', (err) => {
          console.error("ProofFound subscription error:", err);
        });

        subscriptionsRef.current.push(proofFoundSub);

        // Subscribe to VerificationError
        const errorSub = await coordinator.events.VerificationError({
          fromBlock: 'latest'
        });

        errorSub.on('data', (evt) => {
          const { requestId, reason } = evt.returnValues;
          setStatus(`❌ Error for request #${requestId}: ${reason}`);

          setEvents(prev => [...prev, {
            type: "VerificationError",
            requestId,
            reason,
            timestamp: new Date(),
            blockNumber: evt.blockNumber,
            transactionHash: evt.transactionHash
          }]);
        });

        errorSub.on('error', (err) => {
          console.error("VerificationError subscription error:", err);
        });

        subscriptionsRef.current.push(errorSub);

        console.log("Event subscriptions activated");

      } catch (error) {
        console.error("Subscription setup error:", error);
      }
    };

    setupSubscriptions();

    // Cleanup
    return () => {
      subscriptionsRef.current.forEach(sub => {
        if (sub && sub.unsubscribe) {
          try {
            sub.unsubscribe();
          } catch (e) {
            // Ignore errors during unsubscribe
          }
        }
      });
      subscriptionsRef.current = [];
    };
  }, [coordinator, setStatus, setResult]);

  if (events.length === 0) {
    return null;
  }

  return (
    <div style={{ marginTop: "20px" }}>
      <h3>📋 Contract Events</h3>
      <div style={{ 
        maxHeight: "300px", 
        overflowY: "auto",
        border: "1px solid #ddd",
        borderRadius: "4px"
      }}>
        {events.slice().reverse().map((event, index) => (
          <div 
            key={`${event.transactionHash}-${index}`}
            style={{ 
              padding: "10px 15px",
              borderBottom: "1px solid #eee",
              backgroundColor: 
                event.type === "ProofFound" ? "#e8f5e9" :
                event.type === "VerificationError" ? "#ffebee" :
                "#fff"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ 
                color: 
                  event.type === "ProofFound" ? "#2e7d32" :
                  event.type === "VerificationError" ? "#c62828" :
                  "#1565c0"
              }}>
                {event.type === "VerificationRequested" && "📨 "}
                {event.type === "ProofFound" && "✅ "}
                {event.type === "VerificationError" && "❌ "}
                {event.type}
              </strong>
              <span style={{ fontSize: "0.8em", color: "#666" }}>
                {event.timestamp.toLocaleTimeString()}
              </span>
            </div>
            
            <div style={{ fontSize: "0.9em", marginTop: "5px" }}>
              <p style={{ margin: "3px 0" }}>
                <strong>Request ID:</strong> {event.requestId}
              </p>
              
              {event.infoHash && (
                <p style={{ margin: "3px 0", wordBreak: "break-all" }}>
                  <strong>InfoHash:</strong> <code style={{ fontSize: "0.85em" }}>{event.infoHash}</code>
                </p>
              )}
              
              {event.proofHash && (
                <p style={{ margin: "3px 0", wordBreak: "break-all" }}>
                  <strong>ProofHash:</strong> <code style={{ fontSize: "0.85em" }}>{event.proofHash}</code>
                </p>
              )}
              
              {event.reason && (
                <p style={{ margin: "3px 0", color: "#c62828" }}>
                  <strong>Error:</strong> {event.reason}
                </p>
              )}

              <p style={{ margin: "3px 0", fontSize: "0.8em", color: "#888" }}>
                Block: {event.blockNumber}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
