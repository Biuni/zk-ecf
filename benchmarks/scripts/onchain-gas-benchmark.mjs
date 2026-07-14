#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");
const OFFCHAIN = path.join(ROOT, "off-chain");
const ONCHAIN = path.join(ROOT, "on-chain");
const BUILDS = path.join(OFFCHAIN, "builds/L1");
const RESULTS_ROOT = path.join(ROOT, "benchmarks/results");
const offchainRequire = createRequire(path.join(OFFCHAIN, "package.json"));
const onchainRequire = createRequire(path.join(ONCHAIN, "package.json"));
const { groth16 } = offchainRequire("snarkjs");
let encodeAbiParameters;
let keccak256;
let toBytes;

function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function hardhatNetworkName() {
  const index = process.argv.indexOf("--network");
  if (index >= 0 && process.argv[index + 1]) {
    return process.argv[index + 1];
  }
  return "hardhatMainnet";
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function formatProofForContract(proof, publicSignals) {
  const pA = [
    BigInt(proof.pi_a[0]),
    BigInt(proof.pi_a[1])
  ];

  const pB = [
    [BigInt(proof.pi_b[0][1]), BigInt(proof.pi_b[0][0])],
    [BigInt(proof.pi_b[1][1]), BigInt(proof.pi_b[1][0])]
  ];

  const pC = [
    BigInt(proof.pi_c[0]),
    BigInt(proof.pi_c[1])
  ];

  const pubSignals = publicSignals.map((s) => BigInt(s));
  return { pA, pB, pC, pubSignals };
}

function formatProofForContractUnswapped(proof, publicSignals) {
  const pA = [
    BigInt(proof.pi_a[0]),
    BigInt(proof.pi_a[1])
  ];

  const pB = [
    [BigInt(proof.pi_b[0][0]), BigInt(proof.pi_b[0][1])],
    [BigInt(proof.pi_b[1][0]), BigInt(proof.pi_b[1][1])]
  ];

  const pC = [
    BigInt(proof.pi_c[0]),
    BigInt(proof.pi_c[1])
  ];

  const pubSignals = publicSignals.map((s) => BigInt(s));
  return { pA, pB, pC, pubSignals };
}

function encodeProofAsBytes(formatted) {
  return encodeAbiParameters(
    [
      { type: "uint256[2]" },
      { type: "uint256[2][2]" },
      { type: "uint256[2]" },
      { type: "uint256[2]" }
    ],
    [formatted.pA, formatted.pB, formatted.pC, formatted.pubSignals]
  );
}

async function generateFuelUseProofBytes() {
  const input = { vehicle_type: 1, distance_traveled: 100 };
  const wasmPath = path.join(BUILDS, "FuelUse_js/FuelUse.wasm");
  const zkeyPath = path.join(BUILDS, "FuelUse_final.zkey");
  const vkey = readJson(path.join(BUILDS, "verification_key_FuelUse.json"));
  const { proof, publicSignals } = await groth16.fullProve(input, wasmPath, zkeyPath);
  const verified = await groth16.verify(vkey, publicSignals, proof);
  if (!verified) {
    throw new Error("Generated FuelUse proof failed local verification");
  }
  const formatted = formatProofForContract(proof, publicSignals);
  const formattedUnswapped = formatProofForContractUnswapped(proof, publicSignals);
  return {
    input,
    publicSignals: formatted.pubSignals.map((v) => v.toString()),
    formatted,
    formattedUnswapped,
    proofBytes: encodeProofAsBytes(formatted),
    proofBytesUnswapped: encodeProofAsBytes(formattedUnswapped)
  };
}

async function wait(publicClient, hash) {
  return publicClient.waitForTransactionReceipt({ hash });
}

async function main() {
  const outputDir = path.join(RESULTS_ROOT, `onchain-${nowStamp()}`);
  fs.mkdirSync(outputDir, { recursive: true });

  const hardhatPath = onchainRequire.resolve("hardhat");
  const viemPath = onchainRequire.resolve("viem");
  ({ encodeAbiParameters, keccak256, toBytes } = await import(pathToFileURL(viemPath).href));
  const { network } = await import(pathToFileURL(hardhatPath).href);
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [admin, oracle, requester] = await viem.getWalletClients();

  const proofPayload = await generateFuelUseProofBytes();

  const fuelUseVerifier = await viem.deployContract("FuelUseVerifier");
  const verifierAdapter = await viem.deployContract("VerifierAdapter", [fuelUseVerifier.address]);
  const proofManager = await viem.deployContract("ProofManager", [admin.account.address]);
  const coordinator = await viem.deployContract("Coordinator", [proofManager.address]);

  const directVerifierSwapped = await fuelUseVerifier.read.verifyProof([
    proofPayload.formatted.pA,
    proofPayload.formatted.pB,
    proofPayload.formatted.pC,
    proofPayload.formatted.pubSignals
  ]);
  const directVerifierUnswapped = await fuelUseVerifier.read.verifyProof([
    proofPayload.formattedUnswapped.pA,
    proofPayload.formattedUnswapped.pB,
    proofPayload.formattedUnswapped.pC,
    proofPayload.formattedUnswapped.pubSignals
  ]);
  const proofBytes = directVerifierSwapped
    ? proofPayload.proofBytes
    : proofPayload.proofBytesUnswapped;
  const selectedEncoding = directVerifierSwapped ? "snarkjs-pB-swapped" : "snarkjs-pB-unswapped";
  const adapterPrecheck = await verifierAdapter.read.verify([
    proofBytes,
    "0x0000000000000000000000000000000000000000000000000000000000000000"
  ]);
  if (!adapterPrecheck) {
    throw new Error(
      `Verifier precheck failed. swapped=${directVerifierSwapped}, unswapped=${directVerifierUnswapped}`
    );
  }

  const setupReceipts = [];
  setupReceipts.push(await wait(
    publicClient,
    await proofManager.write.setCoordinator([coordinator.address], { account: admin.account })
  ));
  setupReceipts.push(await wait(
    publicClient,
    await proofManager.write.setOracle([oracle.account.address], { account: admin.account })
  ));
  setupReceipts.push(await wait(
    publicClient,
    await proofManager.write.setVerifier([verifierAdapter.address], { account: admin.account })
  ));

  const infoHash = keccak256(toBytes("zk-ecf-benchmark-infohash-0"));

  const requestReceipt = await wait(
    publicClient,
    await coordinator.write.requestVerification([infoHash], { account: requester.account })
  );

  const submitReceipt = await wait(
    publicClient,
    await proofManager.write.submitProofForRequest(
      [0n, infoHash, proofBytes, false],
      { account: oracle.account }
    )
  );

  const duplicateRequestReceipt = await wait(
    publicClient,
    await coordinator.write.requestVerification([infoHash], { account: requester.account })
  );

  const proofRecord = await proofManager.read.getProofRecord([infoHash]);
  const request0 = await coordinator.read.getRequest([0n]);
  const request1 = await coordinator.read.getRequest([1n]);

  const results = {
    environment: {
      timestamp: new Date().toISOString(),
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      cpuModel: os.cpus()[0] ? os.cpus()[0].model : null,
      cpuCount: os.cpus().length
    },
    network: network.name || hardhatNetworkName(),
    deployedContracts: {
      fuelUseVerifier: fuelUseVerifier.address,
      verifierAdapter: verifierAdapter.address,
      proofManager: proofManager.address,
      coordinator: coordinator.address
    },
    proofPayload: {
      input: proofPayload.input,
      publicSignals: proofPayload.publicSignals,
      proofBytesLength: proofBytes.length,
      selectedEncoding,
      directVerifierSwapped,
      directVerifierUnswapped,
      adapterPrecheck
    },
    gasUsed: {
      setCoordinator: setupReceipts[0].gasUsed.toString(),
      setOracle: setupReceipts[1].gasUsed.toString(),
      setVerifier: setupReceipts[2].gasUsed.toString(),
      requestNewInfoHash: requestReceipt.gasUsed.toString(),
      submitFuelUseProofWithVerification: submitReceipt.gasUsed.toString(),
      requestExistingInfoHashReuse: duplicateRequestReceipt.gasUsed.toString()
    },
    storageChecks: {
      proofRecord: proofRecord.map((v) => typeof v === "bigint" ? v.toString() : v),
      request0: request0.map((v) => typeof v === "bigint" ? v.toString() : v),
      request1: request1.map((v) => typeof v === "bigint" ? v.toString() : v)
    },
    interpretationBoundaries: {
      verifierConnected: "FuelUseVerifier",
      multiVerifierDispatch: false,
      cryptographicAggregationMeasured: false,
      reuseMechanism: "Coordinator/ProofManager infoHash lookup"
    }
  };

  fs.writeFileSync(path.join(outputDir, "raw-results.json"), `${JSON.stringify(results, null, 2)}\n`);
  fs.writeFileSync(path.join(outputDir, "summary.md"), [
    "# On-chain Gas Benchmark Results",
    "",
    `Executed at: ${results.environment.timestamp}`,
    `Network: ${results.network}`,
    "",
    "| Operation | Gas used |",
    "|---|---:|",
    `| setCoordinator | ${results.gasUsed.setCoordinator} |`,
    `| setOracle | ${results.gasUsed.setOracle} |`,
    `| setVerifier | ${results.gasUsed.setVerifier} |`,
    `| request new infoHash | ${results.gasUsed.requestNewInfoHash} |`,
    `| submit FuelUse proof with verification | ${results.gasUsed.submitFuelUseProofWithVerification} |`,
    `| request existing infoHash reuse | ${results.gasUsed.requestExistingInfoHashReuse} |`,
    "",
    "This benchmark measures the current FuelUse-only verifier path. It does not measure PM10/CO2eq on-chain verification or cryptographic aggregation.",
    ""
  ].join("\n"));

  console.log(`[onchain-bench] Results written to ${outputDir}`);
}

main().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error("[onchain-bench] Failed:", err);
  process.exit(1);
});
