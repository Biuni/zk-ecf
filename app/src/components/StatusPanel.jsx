// Real-time status

export default function StatusPanel({ status }) {
  // Determine color based on message content
  const getStatusStyle = () => {
    if (status.includes("✅") || status.includes("success") || status.includes("found")) {
      return { backgroundColor: "#e8f5e9", borderColor: "#4caf50", color: "#2e7d32" };
    }
    if (status.includes("❌") || status.includes("Error") || status.includes("error")) {
      return { backgroundColor: "#ffebee", borderColor: "#f44336", color: "#c62828" };
    }
    if (status.includes("⚠️") || status.includes("Waiting")) {
      return { backgroundColor: "#fff3e0", borderColor: "#ff9800", color: "#e65100" };
    }
    return { backgroundColor: "#e3f2fd", borderColor: "#2196f3", color: "#1565c0" };
  };

  const style = getStatusStyle();

  return (
    <div style={{ marginBottom: "20px" }}>
      <h3>📊 Current Status</h3>
      <div style={{ 
        padding: "15px",
        backgroundColor: style.backgroundColor,
        border: `1px solid ${style.borderColor}`,
        borderRadius: "4px",
        color: style.color,
        fontWeight: "500"
      }}>
        {status}
      </div>
    </div>
  );
}
