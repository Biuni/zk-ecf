require('dotenv').config();
const { Web3 } = require("web3");
const coordinatorABI = require("../../on-chain/abi/coordinator_abi.json").abi;
const proofManagerABI = require("../../on-chain/abi/proof_manager_abi.json").abi;

// Use WebSocket to listen to events
// IMPORTANT: URL must be wss:// (WebSocket), not https:// (HTTP)
// In Web3.js v4, pass the URL directly to the constructor
const web3 = new Web3(process.env.JSON_RPC_PROVIDER);

// Configure oracle account from private key
const account = web3.eth.accounts.privateKeyToAccount(process.env.ORACLE_PRIVATE_KEY);
web3.eth.accounts.wallet.add(account);

// Instantiate contracts
const coordinator = new web3.eth.Contract(
  coordinatorABI,
  process.env.COORDINATOR_ADDRESS
);

const proofManager = new web3.eth.Contract(
  proofManagerABI,
  process.env.PROOF_MANAGER_ADDRESS
);

// Configuration log (without exposing sensitive data)
console.log("===========================================");
console.log("Oracle Configuration:");
console.log("===========================================");
console.log(`Oracle Address: ${account.address}`);
console.log(`Coordinator: ${process.env.COORDINATOR_ADDRESS}`);
console.log(`ProofManager: ${process.env.PROOF_MANAGER_ADDRESS}`);
console.log(`RPC Provider: ${process.env.JSON_RPC_PROVIDER?.replace(/\/[^/]+$/, '/***')}`);
console.log("===========================================");

module.exports = {
  web3,
  account,
  coordinator,
  proofManager,
};
