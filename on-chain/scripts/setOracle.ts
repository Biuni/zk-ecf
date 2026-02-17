import "dotenv/config";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

// Configuration
const PROOF_MANAGER_ADDRESS = "0x5d55bcce1C87d70F2D0675094a6d90c4e77331cf"; // ProofManager on Sepolia
const NEW_ORACLE_ADDRESS = "0x56cF298617fdaE9c1751E8c0faAC65296DA43BE1"; // New oracle to register

// Minimal ABI for setOracle
const PROOF_MANAGER_ABI = [
  {
    inputs: [{ name: "_oracle", type: "address" }],
    name: "setOracle",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "oracle",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "admin",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

async function main() {
  console.log("===========================================");
  console.log("Script: Update Oracle Address");
  console.log("===========================================\n");

  // Read private key from environment
  const privateKey = process.env.SEPOLIA_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("SEPOLIA_PRIVATE_KEY not found in .env");
  }

  const rpcUrl = process.env.SEPOLIA_RPC_URL;
  if (!rpcUrl) {
    throw new Error("SEPOLIA_RPC_URL not found in .env");
  }

  // Create clients
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(rpcUrl),
  });

  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(rpcUrl),
  });

  console.log(`Account admin: ${account.address}`);
  console.log(`ProofManager: ${PROOF_MANAGER_ADDRESS}`);
  console.log(`New Oracle: ${NEW_ORACLE_ADDRESS}\n`);

  // Verify we are admin
  const currentAdmin = await publicClient.readContract({
    address: PROOF_MANAGER_ADDRESS as `0x${string}`,
    abi: PROOF_MANAGER_ABI,
    functionName: "admin",
  });

  console.log(`Contract admin: ${currentAdmin}`);

  if (currentAdmin.toLowerCase() !== account.address.toLowerCase()) {
    throw new Error(`You are not admin! Admin: ${currentAdmin}, You: ${account.address}`);
  }

  // Read current oracle
  const currentOracle = await publicClient.readContract({
    address: PROOF_MANAGER_ADDRESS as `0x${string}`,
    abi: PROOF_MANAGER_ABI,
    functionName: "oracle",
  });

  console.log(`Current oracle: ${currentOracle}`);

  if (currentOracle.toLowerCase() === NEW_ORACLE_ADDRESS.toLowerCase()) {
    console.log("\n✅ Oracle is already set correctly!");
    return;
  }

  // Send transaction
  console.log("\n[+] Sending setOracle transaction...");

  const hash = await walletClient.writeContract({
    address: PROOF_MANAGER_ADDRESS as `0x${string}`,
    abi: PROOF_MANAGER_ABI,
    functionName: "setOracle",
    args: [NEW_ORACLE_ADDRESS as `0x${string}`],
  });

  console.log(`Transaction hash: ${hash}`);
  console.log("[+] Waiting for confirmation...");

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  console.log(`\n✅ Transaction confirmed!`);
  console.log(`Block: ${receipt.blockNumber}`);
  console.log(`Gas used: ${receipt.gasUsed}`);

  // Verify
  const newOracle = await publicClient.readContract({
    address: PROOF_MANAGER_ADDRESS as `0x${string}`,
    abi: PROOF_MANAGER_ABI,
    functionName: "oracle",
  });

  console.log(`\nNew registered oracle: ${newOracle}`);
  console.log("\n===========================================");
  console.log("Oracle updated successfully!");
  console.log("===========================================");
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
