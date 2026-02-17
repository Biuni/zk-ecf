import React, { createContext, useState, useEffect, useCallback } from "react";
import Web3 from "web3";
import { EXPECTED_CHAIN_ID, NETWORK_NAME } from "../config.js";

export const Web3Context = createContext(null);

export const Web3Provider = ({ children }) => {
  const [web3, setWeb3] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [networkId, setNetworkId] = useState(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  // Function to switch network
  const switchToSepolia = useCallback(async () => {
    if (!window.ethereum) return;
    
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${EXPECTED_CHAIN_ID.toString(16)}` }],
      });
    } catch (switchError) {
      // If the chain does not exist, add it
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: `0x${EXPECTED_CHAIN_ID.toString(16)}`,
              chainName: NETWORK_NAME,
              nativeCurrency: {
                name: 'Sepolia ETH',
                symbol: 'ETH',
                decimals: 18
              },
              rpcUrls: ['https://sepolia.infura.io/v3/'],
              blockExplorerUrls: ['https://sepolia.etherscan.io']
            }],
          });
        } catch (addError) {
          console.error('Add chain error:', addError);
        }
      }
      console.error('Switch chain error:', switchError);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      if (!window.ethereum) {
        setError("MetaMask not detected. Install MetaMask to use this application.");
        setReady(true);
        return;
      }

      try {
        const w3 = new Web3(window.ethereum);
        
        // Request account access
        await window.ethereum.request({ method: "eth_requestAccounts" });

        const acc = await w3.eth.getAccounts();
        const net = await w3.eth.net.getId();

        setWeb3(w3);
        setAccounts(acc);
        setNetworkId(Number(net));

        // Listener for account changes
        window.ethereum.on('accountsChanged', (newAccounts) => {
          setAccounts(newAccounts);
          if (newAccounts.length === 0) {
            setError("Account disconnected");
          } else {
            setError(null);
          }
        });

        // Listener for network changes
        window.ethereum.on('chainChanged', (chainId) => {
          const newNetworkId = parseInt(chainId, 16);
          setNetworkId(newNetworkId);
        });

      } catch (e) {
        console.error("Web3 initialization error:", e);
        if (e.code === 4001) {
          setError("Account access rejected. Authorize MetaMask to continue.");
        } else {
          setError("Error connecting to MetaMask: " + e.message);
        }
      }

      setReady(true);
    };

    init();

    // Cleanup listeners
    return () => {
      if (window.ethereum) {
        window.ethereum.removeAllListeners('accountsChanged');
        window.ethereum.removeAllListeners('chainChanged');
      }
    };
  }, []);

  if (!ready) {
    return (
      <div style={{ 
        display: "flex", 
        justifyContent: "center", 
        alignItems: "center", 
        height: "100vh",
        flexDirection: "column",
        gap: "10px"
      }}>
        <div style={{ fontSize: "2em" }}>🔄</div>
        <div>Initializing Web3...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        display: "flex", 
        justifyContent: "center", 
        alignItems: "center", 
        height: "100vh",
        flexDirection: "column",
        gap: "15px",
        padding: "20px",
        textAlign: "center"
      }}>
        <div style={{ fontSize: "3em" }}>🦊</div>
        <div style={{ 
          padding: "20px",
          backgroundColor: "#ffebee",
          border: "1px solid #ef5350",
          borderRadius: "8px",
          maxWidth: "400px"
        }}>
          <h3 style={{ margin: "0 0 10px 0", color: "#c62828" }}>Connection Error</h3>
          <p style={{ margin: 0, color: "#c62828" }}>{error}</p>
        </div>
        <button 
          onClick={() => window.location.reload()}
          style={{
            padding: "10px 20px",
            backgroundColor: "#2196F3",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer"
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <Web3Context.Provider value={{ 
      web3, 
      accounts, 
      networkId, 
      switchToSepolia,
      isCorrectNetwork: networkId === EXPECTED_CHAIN_ID 
    }}>
      {children}
    </Web3Context.Provider>
  );
};
