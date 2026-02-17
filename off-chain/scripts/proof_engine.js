const { groth16 } = require("snarkjs");
const path = require("path");

// Base path for circuit builds
const BUILDS_PATH = path.join(__dirname, "../builds/L1");

/**
 * Converts snarkJS proof to the format required by the Solidity contract.
 * VerifierAdapter expects: abi.encode(pA, pB, pC, pubSignals)
 * where:
 * - pA: uint[2]
 * - pB: uint[2][2]
 * - pC: uint[2]
 * - pubSignals: uint[2] (for FuelUse: fuel_used and isValid)
 */
function formatProofForContract(proof, publicSignals) {
  // snarkJS returns coordinates as strings, convert to BigInt
  const pA = [
    BigInt(proof.pi_a[0]).toString(),
    BigInt(proof.pi_a[1]).toString()
  ];
  
  // For pB, snarkJS swaps element order inside each pair
  // Solidity expects [[b00, b01], [b10, b11]] but snarkJS provides [[b01, b00], [b11, b10]]
  const pB = [
    [BigInt(proof.pi_b[0][1]).toString(), BigInt(proof.pi_b[0][0]).toString()],
    [BigInt(proof.pi_b[1][1]).toString(), BigInt(proof.pi_b[1][0]).toString()]
  ];
  
  const pC = [
    BigInt(proof.pi_c[0]).toString(),
    BigInt(proof.pi_c[1]).toString()
  ];

  // Public signals (FuelUse has 2 outputs: fuel_used and isValid)
  const pubSignals = publicSignals.map(s => BigInt(s).toString());

  return { pA, pB, pC, pubSignals };
}

/**
 * Encodes proof as bytes for the contract using ABI encoding
 * Format: abi.encode(uint[2] pA, uint[2][2] pB, uint[2] pC, uint[2] pubSignals)
 */
function encodeProofAsBytes(pA, pB, pC, pubSignals, web3) {
  // Use web3 for ABI encoding
  const encoded = web3.eth.abi.encodeParameters(
    ['uint256[2]', 'uint256[2][2]', 'uint256[2]', 'uint256[2]'],
    [pA, pB, pC, pubSignals]
  );
  return encoded;
}

/**
 * Generates a zkSNARK proof for the FuelUse circuit
 * @param {Object} inputData - Input data (vehicle_type, distance_traveled)
 * @param {Object} web3 - Web3 instance for ABI encoding
 * @returns {Object} { proofBytes, publicSignals, isAggregate }
 */
async function generateProof(inputData, web3) {
  console.log("\n===========================================");
  console.log("FuelUse Proof Generation");
  console.log("===========================================");
  console.log("Input:", JSON.stringify(inputData, null, 2));

  // Paths to FuelUse circuit files
  const wasmPath = path.join(BUILDS_PATH, "FuelUse_js/FuelUse.wasm");
  const zkeyPath = path.join(BUILDS_PATH, "FuelUse_final.zkey");

  // Prepare circuit input
  const circuitInput = {
    vehicle_type: inputData.vehicle_type,
    distance_traveled: inputData.distance_traveled
  };

  console.log("\n[+] Generating zkSNARK proof...");
  
  // Generate proof with snarkJS
  const { proof, publicSignals } = await groth16.fullProve(
    circuitInput,
    wasmPath,
    zkeyPath
  );

  console.log("[+] Proof generated successfully!");
  console.log("Public signals:", publicSignals);
  console.log("  - fuel_used:", publicSignals[0]);
  console.log("  - isValid:", publicSignals[1] === "1" ? "true" : "false");

  // Format proof for Solidity
  const formatted = formatProofForContract(proof, publicSignals);
  console.log("\n[+] Proof formatted for Solidity");

  // Encode to bytes for contract
  const proofBytes = encodeProofAsBytes(
    formatted.pA,
    formatted.pB,
    formatted.pC,
    formatted.pubSignals,
    web3
  );
  
  console.log("[+] Proof encoded as bytes");
  console.log("Proof bytes length:", proofBytes.length);

  return {
    proofBytes,
    publicSignals: formatted.pubSignals,
    isAggregate: false
  };
}

/**
 * Verifies a proof locally (for testing)
 */
async function verifyProofLocally(proof, publicSignals) {
  const vkeyPath = path.join(BUILDS_PATH, "verification_key_FuelUse.json");
  const vkey = require(vkeyPath);
  
  const isValid = await groth16.verify(vkey, publicSignals, proof);
  return isValid;
}

module.exports = {
  generateProof,
  verifyProofLocally,
  formatProofForContract,
  encodeProofAsBytes
};
