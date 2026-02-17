const fs = require("fs");
const path = require("path");
const { coordinator, proofManager, web3, account } = require("./blockchain");
const { generateProof } = require("./proof_engine");

console.log("\n===========================================");
console.log("ZK-Oracle Off-Chain Service");
console.log("===========================================");
console.log("Oracle started. Listening for VerificationRequested events...\n");

/**
 * Maps infoHash -> prover data
 * In a real system, this could be a database or an API
 * For now, we use a local JSON file
 */
function loadProverData() {
  const dataPath = path.join(__dirname, "../../data/proverData.json");
  try {
    const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
    return data;
  } catch (err) {
    console.error("Error loading proverData.json:", err.message);
    return null;
  }
}

/**
 * Handles a verification request
 */
async function handleVerificationRequest(event) {
  const { requestId, requester, infoHash } = event.returnValues;

  console.log("\n===========================================");
  console.log(`[EVENT] New verification request`);
  console.log(`===========================================`);
  console.log(`Request ID: ${requestId}`);
  console.log(`Requester: ${requester}`);
  console.log(`InfoHash: ${infoHash}`);

  try {
    // 1. Load prover data
    // In this prototype, we use a static JSON file
    // In production, infoHash could be used to fetch specific data
    const proverData = loadProverData();
    
    if (!proverData) {
      throw new Error("Unable to load prover data");
    }

    console.log("\n[+] Prover data loaded:", proverData);

    // 2. Generate ZK proof
    const { proofBytes, publicSignals, isAggregate } = await generateProof(proverData, web3);

    console.log("\n[+] Preparing transaction for submitProofForRequest...");

    // 3. Build transaction
    const tx = proofManager.methods.submitProofForRequest(
      requestId,
      infoHash,
      proofBytes,
      isAggregate
    );

    // 4. Estimate gas
    console.log("[+] Estimating gas...");
    console.log(`    Oracle address: ${account.address}`);
    
    // Check oracle authorization
    const registeredOracle = await proofManager.methods.oracle().call();
    console.log(`    Oracle registered in contract: ${registeredOracle}`);
    
    if (registeredOracle.toLowerCase() !== account.address.toLowerCase()) {
      throw new Error(`Unauthorized oracle! Registered: ${registeredOracle}, Current: ${account.address}`);
    }
    
    const gasEstimate = await tx.estimateGas({ from: account.address });
    const gasLimit = Math.ceil(Number(gasEstimate) * 1.2); // 20% buffer
    console.log(`Gas stimato: ${gasEstimate}, Gas limit: ${gasLimit}`);

    // 5. Get current gas price
    const gasPrice = await web3.eth.getGasPrice();
    console.log(`Gas price: ${web3.utils.fromWei(gasPrice, 'gwei')} Gwei`);

    // 6. Send transaction
    console.log("\n[+] Sending transaction...");
    const receipt = await tx.send({
      from: account.address,
      gas: gasLimit,
      gasPrice: gasPrice
    });

    console.log("\n===========================================");
    console.log("[SUCCESS] Proof sent successfully!");
    console.log("===========================================");
    console.log(`Transaction Hash: ${receipt.transactionHash}`);
    console.log(`Block Number: ${receipt.blockNumber}`);
    console.log(`Gas Used: ${receipt.gasUsed}`);
    
    // Log emitted events
    if (receipt.events) {
      if (receipt.events.ProofStored) {
        console.log("\n[EVENT] ProofStored emitted");
        console.log(`  InfoHash: ${receipt.events.ProofStored.returnValues.infoHash}`);
        console.log(`  ProofHash: ${receipt.events.ProofStored.returnValues.proofHash}`);
      }
    }

  } catch (err) {
    console.error("\n===========================================");
    console.error("[ERROR] Error handling request");
    console.error("===========================================");
    console.error(`Request ID: ${requestId}`);
    console.error(`Error: ${err.message}`);
    
    // Show additional error details
    if (err.cause) {
      console.error(`Cause: ${err.cause.message || err.cause}`);
    }
    if (err.data) {
      console.error(`Data: ${JSON.stringify(err.data)}`);
    }
    if (err.reason) {
      console.error(`Reason: ${err.reason}`);
    }
    if (err.receipt) {
      console.error(`Transaction Hash: ${err.receipt.transactionHash}`);
    }
    
    // Full debug log
    console.error("\nStack trace:", err.stack);
    
    // In case of error, the system will automatically notify the Coordinator
    // via notifyError if the transaction fails on-chain
  }
}

/**
 * Subscribes to contract events using Web3.js v4 syntax
 */
async function subscribeToEvents() {
  try {
    // Subscribe to VerificationRequested
    const verificationSubscription = await coordinator.events.VerificationRequested({
      fromBlock: 'latest'
    });

    verificationSubscription.on('data', handleVerificationRequest);
    verificationSubscription.on('error', (error) => {
      console.error("[ERROR] VerificationRequested subscription error:", error.message);
    });

    console.log("[+] Subscribed to VerificationRequested events");

    // Subscribe to ProofFound for logging
    const proofFoundSubscription = await coordinator.events.ProofFound({
      fromBlock: 'latest'
    });

    proofFoundSubscription.on('data', (event) => {
      const { requestId, proofHash } = event.returnValues;
      console.log(`\n[EVENT] ProofFound - Request #${requestId}`);
      console.log(`        ProofHash: ${proofHash}`);
    });

    console.log("[+] Subscribed to ProofFound events");

    // Subscribe to VerificationError for logging
    const errorSubscription = await coordinator.events.VerificationError({
      fromBlock: 'latest'
    });

    errorSubscription.on('data', (event) => {
      const { requestId, reason } = event.returnValues;
      console.error(`\n[EVENT] VerificationError - Request #${requestId}`);
      console.error(`        Reason: ${reason}`);
    });

    console.log("[+] Subscribed to VerificationError events");
    console.log("\n[+] Oracle waiting for events...");
    console.log("    Press Ctrl+C to stop\n");

  } catch (error) {
    console.error("[ERROR] Unable to subscribe to events:", error.message);
    console.log("[+] Reconnection attempt in 5 seconds...");
    setTimeout(subscribeToEvents, 5000);
  }
}

// Start event subscriptions
subscribeToEvents();

// Graceful shutdown handling
process.on("SIGINT", async () => {
  console.log("\n[+] Shutting down oracle...");
  try {
    if (web3.currentProvider && web3.currentProvider.disconnect) {
      await web3.currentProvider.disconnect();
    }
  } catch (e) {
    // Ignore errors during disconnection
  }
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n[+] Shutting down oracle...");
  try {
    if (web3.currentProvider && web3.currentProvider.disconnect) {
      await web3.currentProvider.disconnect();
    }
  } catch (e) {
    // Ignore errors during disconnection
  }
  process.exit(0);
});
