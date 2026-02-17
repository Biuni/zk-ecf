// Proof display

export default function ResultPanel({ result }) {
  if (!result) return null;

  return (
    <div style={{ marginTop: "20px" }}>
      <h3>🏆 Verification Result</h3>
      <div style={{ 
        padding: "20px",
        backgroundColor: "#e8f5e9",
        border: "1px solid #4caf50",
        borderRadius: "4px"
      }}>
        <div style={{ marginBottom: "15px" }}>
          <span style={{ 
            display: "inline-block",
            padding: "5px 10px",
            backgroundColor: "#4caf50",
            color: "white",
            borderRadius: "4px",
            fontSize: "0.9em",
            fontWeight: "bold"
          }}>
            ✓ PROOF VERIFIED
          </span>
        </div>

        <div style={{ marginBottom: "10px" }}>
          <strong>Request ID:</strong>
          <span style={{ marginLeft: "10px" }}>{result.requestId}</span>
        </div>

        <div style={{ marginBottom: "10px" }}>
          <strong>Proof Hash:</strong>
          <div style={{ 
            marginTop: "5px",
            padding: "10px",
            backgroundColor: "#fff",
            border: "1px solid #ddd",
            borderRadius: "4px",
            fontFamily: "monospace",
            fontSize: "0.85em",
            wordBreak: "break-all"
          }}>
            {result.proofHash}
          </div>
        </div>

        {result.blockNumber && (
          <div style={{ marginBottom: "10px" }}>
            <strong>Block Number:</strong>
            <span style={{ marginLeft: "10px" }}>{result.blockNumber}</span>
          </div>
        )}

        {result.transactionHash && (
          <div>
            <strong>Transaction:</strong>
            <div style={{ 
              marginTop: "5px",
              padding: "10px",
              backgroundColor: "#fff",
              border: "1px solid #ddd",
              borderRadius: "4px",
              fontFamily: "monospace",
              fontSize: "0.85em",
              wordBreak: "break-all"
            }}>
              <a 
                href={`https://sepolia.etherscan.io/tx/${result.transactionHash}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#1565c0" }}
              >
                {result.transactionHash}
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
