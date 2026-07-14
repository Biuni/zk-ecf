#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { performance } = require("perf_hooks");
const { execFileSync } = require("child_process");
const { createRequire } = require("module");

const ROOT = path.resolve(__dirname, "../..");
const OFFCHAIN = path.join(ROOT, "off-chain");
const BUILDS = path.join(OFFCHAIN, "builds/L1");
const RESULTS_ROOT = path.join(ROOT, "benchmarks/results");
const offchainRequire = createRequire(path.join(OFFCHAIN, "package.json"));
const { groth16 } = offchainRequire("snarkjs");
const { Web3 } = offchainRequire("web3");
const web3 = new Web3();

const CIRCUITS = ["FuelUse", "PM10", "CO2eq"];
const VEHICLE_TYPES = [0, 1, 2];
const FUEL_EFFICIENCY = [12, 20, 32];
const PM10_FACTORS = [200, 320, 500];
const CO2EQ_FACTORS = [2000, 3000, 4000];
const CO2EQ_SCALE = 1000;
const DISTANCE_STEP = [25, 5, 25];

const DEFAULTS = {
  repetitions: 8,
  pipelineSizes: [1, 2, 4, 8],
  pipelineRepeats: 3,
  concurrencyLevels: [1, 2, 4],
  concurrencyPipelines: 6,
  aggregationSizes: [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024],
  reuseRequests: 10000
};

function parseArgs(argv) {
  const config = { ...DEFAULTS };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--repetitions") {
      config.repetitions = Number(next);
      i += 1;
    } else if (arg === "--pipeline-sizes") {
      config.pipelineSizes = next.split(",").map(Number);
      i += 1;
    } else if (arg === "--pipeline-repeats") {
      config.pipelineRepeats = Number(next);
      i += 1;
    } else if (arg === "--concurrency-levels") {
      config.concurrencyLevels = next.split(",").map(Number);
      i += 1;
    } else if (arg === "--concurrency-pipelines") {
      config.concurrencyPipelines = Number(next);
      i += 1;
    } else if (arg === "--aggregation-sizes") {
      config.aggregationSizes = next.split(",").map(Number);
      i += 1;
    } else if (arg === "--reuse-requests") {
      config.reuseRequests = Number(next);
      i += 1;
    } else if (arg === "--help") {
      printHelpAndExit();
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  for (const [key, value] of Object.entries(config)) {
    if (Array.isArray(value) && value.some((n) => !Number.isFinite(n) || n < 1)) {
      throw new Error(`Invalid positive integer list for ${key}`);
    }
    if (!Array.isArray(value) && (!Number.isFinite(value) || value < 1)) {
      throw new Error(`Invalid positive integer for ${key}`);
    }
  }

  return config;
}

function printHelpAndExit() {
  console.log(`Usage: node benchmarks/scripts/run-offchain-benchmarks.js [options]

Options:
  --repetitions N             Per-circuit proof repetitions. Default: ${DEFAULTS.repetitions}
  --pipeline-sizes CSV        Sequential pipeline batch sizes. Default: ${DEFAULTS.pipelineSizes.join(",")}
  --pipeline-repeats N        Repeats per pipeline size. Default: ${DEFAULTS.pipelineRepeats}
  --concurrency-levels CSV    Concurrent pipeline limits. Default: ${DEFAULTS.concurrencyLevels.join(",")}
  --concurrency-pipelines N   Pipelines per concurrency run. Default: ${DEFAULTS.concurrencyPipelines}
  --aggregation-sizes CSV     Metadata aggregation sizes. Default: ${DEFAULTS.aggregationSizes.join(",")}
  --reuse-requests N          Simulated infoHash requests. Default: ${DEFAULTS.reuseRequests}
`);
  process.exit(0);
}

function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function runGit(args) {
  try {
    return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
  } catch (err) {
    return null;
  }
}

function stripAnsi(value) {
  return value.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function fileSize(filePath) {
  return fs.statSync(filePath).size;
}

function circuitPaths(name) {
  return {
    r1cs: path.join(BUILDS, `${name}.r1cs`),
    sym: path.join(BUILDS, `${name}.sym`),
    wasm: path.join(BUILDS, `${name}_js/${name}.wasm`),
    zkey: path.join(BUILDS, `${name}_final.zkey`),
    vkey: path.join(BUILDS, `verification_key_${name}.json`)
  };
}

function collectEnvironment(config) {
  const offchainPackage = readJson(path.join(OFFCHAIN, "package.json"));
  const onchainPackage = readJson(path.join(ROOT, "on-chain/package.json"));

  return {
    timestamp: new Date().toISOString(),
    cwd: ROOT,
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    os: {
      type: os.type(),
      release: os.release(),
      cpus: os.cpus().length,
      cpuModel: os.cpus()[0] ? os.cpus()[0].model : null,
      totalMemoryBytes: os.totalmem()
    },
    git: {
      commit: runGit(["rev-parse", "HEAD"]),
      statusShort: runGit(["status", "--short"])
    },
    packages: {
      offchain: offchainPackage.dependencies,
      onchain: onchainPackage.dependencies
    },
    config
  };
}

function snarkjsR1csInfo(r1csPath) {
  const localSnarkjs = path.join(OFFCHAIN, "node_modules/.bin/snarkjs");
  const command = fs.existsSync(localSnarkjs) ? localSnarkjs : "npx";
  const args = fs.existsSync(localSnarkjs)
    ? ["r1cs", "info", r1csPath]
    : ["snarkjs", "r1cs", "info", r1csPath];
  const raw = execFileSync(command, args, { cwd: OFFCHAIN, encoding: "utf8" });
  const clean = stripAnsi(raw);
  const out = { raw: clean.trim() };
  for (const line of clean.split(/\r?\n/)) {
    const match = line.match(/# of ([^:]+):\s*(\d+)/);
    if (match) {
      const key = match[1].toLowerCase().replace(/\s+/g, "_");
      out[key] = Number(match[2]);
    } else if (line.includes("Curve:")) {
      out.curve = line.split("Curve:")[1].trim();
    }
  }
  return out;
}

function collectCircuitComplexity() {
  const rows = [];
  for (const circuit of CIRCUITS) {
    const paths = circuitPaths(circuit);
    rows.push({
      circuit,
      r1csInfo: snarkjsR1csInfo(paths.r1cs),
      fileSizesBytes: {
        r1cs: fileSize(paths.r1cs),
        wasm: fileSize(paths.wasm),
        zkey: fileSize(paths.zkey),
        verificationKey: fileSize(paths.vkey),
        sym: fileSize(paths.sym)
      }
    });
  }
  return rows;
}

function computeFuelUse(vehicleType, distance) {
  return (distance * FUEL_EFFICIENCY[vehicleType]) / 100;
}

function computePm10(vehicleType, fuelUsed) {
  return fuelUsed * PM10_FACTORS[vehicleType];
}

function computeCo2eq(vehicleType, fuelUsed) {
  return (fuelUsed * CO2EQ_FACTORS[vehicleType]) / CO2EQ_SCALE;
}

function makeBaseInput(index) {
  const vehicleType = VEHICLE_TYPES[index % VEHICLE_TYPES.length];
  const round = Math.floor(index / VEHICLE_TYPES.length) + 1;
  const distance = DISTANCE_STEP[vehicleType] * round;
  const fuelUsed = computeFuelUse(vehicleType, distance);
  if (!Number.isInteger(fuelUsed)) {
    throw new Error(`Generated non-integer fuel input for index ${index}`);
  }
  return {
    vehicle_type: vehicleType,
    distance_traveled: distance,
    derived: {
      fuel_used: fuelUsed,
      pm10: computePm10(vehicleType, fuelUsed),
      co2eq: computeCo2eq(vehicleType, fuelUsed)
    }
  };
}

function inputForCircuit(circuit, baseInput) {
  if (circuit === "FuelUse") {
    return {
      vehicle_type: baseInput.vehicle_type,
      distance_traveled: baseInput.distance_traveled
    };
  }
  if (circuit === "PM10") {
    return {
      vehicle_type: baseInput.vehicle_type,
      fuel_used: baseInput.derived.fuel_used
    };
  }
  if (circuit === "CO2eq") {
    return {
      vehicle_type: baseInput.vehicle_type,
      fuel_used: baseInput.derived.fuel_used
    };
  }
  throw new Error(`Unsupported circuit: ${circuit}`);
}

function formatProofForContract(proof, publicSignals) {
  const pA = [
    BigInt(proof.pi_a[0]).toString(),
    BigInt(proof.pi_a[1]).toString()
  ];

  const pB = [
    [BigInt(proof.pi_b[0][1]).toString(), BigInt(proof.pi_b[0][0]).toString()],
    [BigInt(proof.pi_b[1][1]).toString(), BigInt(proof.pi_b[1][0]).toString()]
  ];

  const pC = [
    BigInt(proof.pi_c[0]).toString(),
    BigInt(proof.pi_c[1]).toString()
  ];

  const pubSignals = publicSignals.map((s) => BigInt(s).toString());
  return { pA, pB, pC, pubSignals };
}

function encodeProofAsBytes(formatted) {
  return web3.eth.abi.encodeParameters(
    ["uint256[2]", "uint256[2][2]", "uint256[2]", "uint256[2]"],
    [formatted.pA, formatted.pB, formatted.pC, formatted.pubSignals]
  );
}

async function proveCircuit(circuit, circuitInput, options = {}) {
  const paths = circuitPaths(circuit);
  const started = performance.now();
  const { proof, publicSignals } = await groth16.fullProve(circuitInput, paths.wasm, paths.zkey);
  const provedAt = performance.now();

  let verified = null;
  let verifyMs = null;
  if (options.verify !== false) {
    const vkey = readJson(paths.vkey);
    const verifyStarted = performance.now();
    verified = await groth16.verify(vkey, publicSignals, proof);
    verifyMs = performance.now() - verifyStarted;
  }

  const formatted = formatProofForContract(proof, publicSignals);
  const proofBytes = encodeProofAsBytes(formatted);
  const ended = performance.now();

  return {
    circuit,
    input: circuitInput,
    publicSignals: formatted.pubSignals,
    fullProveMs: provedAt - started,
    verifyMs,
    totalMs: ended - started,
    verified,
    proofBytesLength: proofBytes.length,
    proofHash: crypto
      .createHash("sha256")
      .update(JSON.stringify({ circuit, formatted }))
      .digest("hex")
  };
}

function quantile(sorted, q) {
  if (sorted.length === 0) return null;
  const position = (sorted.length - 1) * q;
  const base = Math.floor(position);
  const rest = position - base;
  if (sorted[base + 1] === undefined) return sorted[base];
  return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
}

function stats(values) {
  const clean = values.filter((v) => Number.isFinite(v));
  if (clean.length === 0) {
    return { count: 0, min: null, max: null, mean: null, median: null, p95: null, stddev: null };
  }
  const sorted = [...clean].sort((a, b) => a - b);
  const mean = clean.reduce((acc, v) => acc + v, 0) / clean.length;
  const variance = clean.reduce((acc, v) => acc + (v - mean) ** 2, 0) / clean.length;
  return {
    count: clean.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean,
    median: quantile(sorted, 0.5),
    p95: quantile(sorted, 0.95),
    stddev: Math.sqrt(variance)
  };
}

async function benchmarkSingleCircuits(repetitions) {
  const result = {};
  for (const circuit of CIRCUITS) {
    await proveCircuit(circuit, inputForCircuit(circuit, makeBaseInput(0)), { verify: true });
    const iterations = [];
    for (let i = 0; i < repetitions; i += 1) {
      const base = makeBaseInput(i);
      iterations.push(await proveCircuit(circuit, inputForCircuit(circuit, base), { verify: true }));
    }
    result[circuit] = {
      iterations,
      fullProveMs: stats(iterations.map((row) => row.fullProveMs)),
      verifyMs: stats(iterations.map((row) => row.verifyMs)),
      totalMs: stats(iterations.map((row) => row.totalMs)),
      proofBytesLength: stats(iterations.map((row) => row.proofBytesLength)),
      allVerified: iterations.every((row) => row.verified === true)
    };
  }
  return result;
}

async function runSequentialPipeline(baseInput, index) {
  const fuel = await proveCircuit("FuelUse", inputForCircuit("FuelUse", baseInput), { verify: true });
  const fuelUsed = Number(BigInt(fuel.publicSignals[0]));

  const pm10Input = { vehicle_type: baseInput.vehicle_type, fuel_used: fuelUsed };
  const pm10 = await proveCircuit("PM10", pm10Input, { verify: true });

  const co2eqInput = { vehicle_type: baseInput.vehicle_type, fuel_used: fuelUsed };
  const co2eq = await proveCircuit("CO2eq", co2eqInput, { verify: true });

  const node = {
    type: "vertical-batch",
    id: `vb-${index}`,
    size: 3,
    children: [`FuelUse-${index}`, `PM10-${index}`, `CO2eq-${index}`],
    hash: crypto
      .createHash("sha256")
      .update(JSON.stringify({ fuel: fuel.proofHash, pm10: pm10.proofHash, co2eq: co2eq.proofHash }))
      .digest("hex")
  };

  return {
    node,
    proofs: { fuel, pm10, co2eq },
    outputs: {
      fuel_used: fuelUsed,
      pm10: Number(BigInt(pm10.publicSignals[0])),
      co2eq: Number(BigInt(co2eq.publicSignals[0]))
    },
    generationMs: fuel.fullProveMs + pm10.fullProveMs + co2eq.fullProveMs,
    verificationMs: fuel.verifyMs + pm10.verifyMs + co2eq.verifyMs,
    allVerified: [fuel, pm10, co2eq].every((row) => row.verified === true)
  };
}

function aggregatePair(left, right, level) {
  const started = performance.now();
  const hash = crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        level,
        left: left.hash,
        right: right ? right.hash : null,
        size: left.size + (right ? right.size : 0)
      })
    )
    .digest("hex");
  const ended = performance.now();
  return {
    node: {
      type: "batching-orchestration-aggregate",
      id: `agg-L${level}-${hash.slice(0, 8)}`,
      hash,
      size: left.size + (right ? right.size : 0),
      children: right ? [left.id, right.id] : [left.id]
    },
    elapsedMs: ended - started
  };
}

function aggregateRecursively(nodes, level = 0, metrics = []) {
  if (nodes.length <= 1) {
    return { root: nodes[0] || null, metrics };
  }

  const next = [];
  let levelMs = 0;
  let merges = 0;
  for (let i = 0; i < nodes.length; i += 2) {
    const { node, elapsedMs } = aggregatePair(nodes[i], nodes[i + 1], level);
    next.push(node);
    levelMs += elapsedMs;
    merges += 1;
  }

  metrics.push({
    level,
    inputNodes: nodes.length,
    outputNodes: next.length,
    merges,
    levelMs
  });

  return aggregateRecursively(next, level + 1, metrics);
}

async function benchmarkSequentialPipelines(sizes, repeats) {
  const rows = [];
  await runSequentialPipeline(makeBaseInput(0), 0);

  for (const size of sizes) {
    const repeatRows = [];
    for (let repeat = 0; repeat < repeats; repeat += 1) {
      const started = performance.now();
      const batches = [];
      for (let i = 0; i < size; i += 1) {
        batches.push(await runSequentialPipeline(makeBaseInput(i), i + 1));
      }
      const aggregationStarted = performance.now();
      const aggregation = aggregateRecursively(batches.map((row) => row.node));
      const aggregationMs = performance.now() - aggregationStarted;
      const ended = performance.now();
      repeatRows.push({
        size,
        repeat,
        proofCount: size * 3,
        wallMs: ended - started,
        generationMs: batches.reduce((acc, row) => acc + row.generationMs, 0),
        verificationMs: batches.reduce((acc, row) => acc + row.verificationMs, 0),
        aggregationMs,
        aggregateLevels: aggregation.metrics.length,
        allVerified: batches.every((row) => row.allVerified),
        rootHash: aggregation.root ? aggregation.root.hash : null,
        sampleOutput: batches[0] ? batches[0].outputs : null
      });
    }
    rows.push({
      size,
      repeats: repeatRows,
      wallMs: stats(repeatRows.map((row) => row.wallMs)),
      generationMs: stats(repeatRows.map((row) => row.generationMs)),
      verificationMs: stats(repeatRows.map((row) => row.verificationMs)),
      aggregationMs: stats(repeatRows.map((row) => row.aggregationMs)),
      throughputProofsPerSecond: stats(repeatRows.map((row) => row.proofCount / (row.wallMs / 1000))),
      allVerified: repeatRows.every((row) => row.allVerified)
    });
  }
  return rows;
}

function makeDummyNodes(count) {
  const nodes = [];
  for (let i = 0; i < count; i += 1) {
    const hash = crypto.createHash("sha256").update(`proof-${i}`).digest("hex");
    nodes.push({ type: "proof", id: `proof-${i}`, hash, size: 1 });
  }
  return nodes;
}

function benchmarkAggregationOverhead(sizes) {
  return sizes.map((size) => {
    const runs = [];
    for (let repeat = 0; repeat < 10; repeat += 1) {
      const nodes = makeDummyNodes(size);
      const started = performance.now();
      const aggregation = aggregateRecursively(nodes);
      const elapsedMs = performance.now() - started;
      runs.push({
        repeat,
        elapsedMs,
        levels: aggregation.metrics.length,
        rootHash: aggregation.root ? aggregation.root.hash : null
      });
    }
    return {
      size,
      runs,
      elapsedMs: stats(runs.map((row) => row.elapsedMs)),
      levels: runs[0] ? runs[0].levels : 0
    };
  });
}

function benchmarkProofReuseSimulation(requests) {
  const uniqueCount = Math.max(1, Math.floor(requests / 2));
  const cache = new Map();
  let hits = 0;
  let misses = 0;
  const started = performance.now();
  for (let i = 0; i < requests; i += 1) {
    const logicalId = i < uniqueCount ? i : i - uniqueCount;
    const infoHash = crypto.createHash("sha256").update(`statement-${logicalId}`).digest("hex");
    if (cache.has(infoHash)) {
      hits += 1;
      cache.get(infoHash);
    } else {
      misses += 1;
      cache.set(infoHash, crypto.createHash("sha256").update(`proof-${logicalId}`).digest("hex"));
    }
  }
  const elapsedMs = performance.now() - started;
  return {
    requests,
    uniqueCount,
    hits,
    misses,
    hitRate: hits / requests,
    elapsedMs,
    note: "This is an in-memory simulation of infoHash reuse semantics, not an on-chain gas measurement."
  };
}

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await fn(items[index], index);
    }
  }

  const workers = [];
  for (let i = 0; i < Math.min(limit, items.length); i += 1) {
    workers.push(worker());
  }
  await Promise.all(workers);
  return results;
}

async function benchmarkConcurrency(levels, pipelineCount) {
  const rows = [];
  const items = Array.from({ length: pipelineCount }, (_, i) => i);

  for (const level of levels) {
    await runSequentialPipeline(makeBaseInput(0), 0);
    const started = performance.now();
    const pipelines = await mapWithConcurrency(items, level, async (item) => {
      const pipelineStarted = performance.now();
      const result = await runSequentialPipeline(makeBaseInput(item), item + 1);
      return {
        ...result,
        wallMs: performance.now() - pipelineStarted
      };
    });
    const wallMs = performance.now() - started;
    const proofCount = pipelineCount * 3;
    rows.push({
      concurrency: level,
      pipelineCount,
      proofCount,
      wallMs,
      throughputProofsPerSecond: proofCount / (wallMs / 1000),
      pipelineWallMs: stats(pipelines.map((row) => row.wallMs)),
      generationMs: stats(pipelines.map((row) => row.generationMs)),
      verificationMs: stats(pipelines.map((row) => row.verificationMs)),
      allVerified: pipelines.every((row) => row.allVerified)
    });
  }
  return rows;
}

function writeMarkdownSummary(outputDir, environment, results) {
  const lines = [];
  lines.push("# Off-chain Benchmark Results");
  lines.push("");
  lines.push(`Executed at: ${environment.timestamp}`);
  lines.push(`Node: ${environment.node}`);
  lines.push(`CPU: ${environment.os.cpuModel} (${environment.os.cpus} logical CPUs)`);
  lines.push(`Git commit: ${environment.git.commit || "unknown"}`);
  lines.push("");
  lines.push("## Scope");
  lines.push("");
  lines.push("- Executed: local Groth16 proving and verification with existing build artifacts.");
  lines.push("- Executed: sequential vertical FuelUse -> PM10 -> CO2eq pipeline benchmarks.");
  lines.push("- Executed: controlled concurrency over independent vertical pipelines.");
  lines.push("- Executed: batching/orchestration aggregation overhead over metadata hashes.");
  lines.push("- Executed: in-memory simulation of infoHash proof reuse semantics.");
  lines.push("- Not part of this off-chain run: on-chain gas benchmarks.");
  lines.push("");
  lines.push("## Circuit Complexity");
  lines.push("");
  lines.push("| Circuit | Constraints | Wires | Private inputs | Public inputs | Outputs | R1CS bytes | WASM bytes | zkey bytes |");
  lines.push("|---|---:|---:|---:|---:|---:|---:|---:|---:|");
  for (const row of results.circuitComplexity) {
    lines.push(`| ${row.circuit} | ${row.r1csInfo.constraints} | ${row.r1csInfo.wires} | ${row.r1csInfo.private_inputs} | ${row.r1csInfo.public_inputs} | ${row.r1csInfo.outputs} | ${row.fileSizesBytes.r1cs} | ${row.fileSizesBytes.wasm} | ${row.fileSizesBytes.zkey} |`);
  }
  lines.push("");
  lines.push("## Single-Circuit Proving");
  lines.push("");
  lines.push("| Circuit | Repetitions | Mean prove ms | Median prove ms | p95 prove ms | Mean verify ms | All verified |");
  lines.push("|---|---:|---:|---:|---:|---:|---|");
  for (const circuit of CIRCUITS) {
    const row = results.singleCircuit[circuit];
    lines.push(`| ${circuit} | ${row.fullProveMs.count} | ${row.fullProveMs.mean.toFixed(3)} | ${row.fullProveMs.median.toFixed(3)} | ${row.fullProveMs.p95.toFixed(3)} | ${row.verifyMs.mean.toFixed(3)} | ${row.allVerified} |`);
  }
  lines.push("");
  lines.push("## Sequential Vertical Pipeline");
  lines.push("");
  lines.push("| Batches | Proofs | Median wall ms | Median aggregation ms | Median proofs/sec | All verified |");
  lines.push("|---:|---:|---:|---:|---:|---|");
  for (const row of results.sequentialPipelines) {
    lines.push(`| ${row.size} | ${row.size * 3} | ${row.wallMs.median.toFixed(3)} | ${row.aggregationMs.median.toFixed(6)} | ${row.throughputProofsPerSecond.median.toFixed(3)} | ${row.allVerified} |`);
  }
  lines.push("");
  lines.push("## Concurrency");
  lines.push("");
  lines.push("| Concurrency | Pipelines | Proofs | Wall ms | Proofs/sec | All verified |");
  lines.push("|---:|---:|---:|---:|---:|---|");
  for (const row of results.concurrency) {
    lines.push(`| ${row.concurrency} | ${row.pipelineCount} | ${row.proofCount} | ${row.wallMs.toFixed(3)} | ${row.throughputProofsPerSecond.toFixed(3)} | ${row.allVerified} |`);
  }
  lines.push("");
  lines.push("## Proof Reuse Simulation");
  lines.push("");
  lines.push(`Requests: ${results.proofReuseSimulation.requests}`);
  lines.push(`Hits: ${results.proofReuseSimulation.hits}`);
  lines.push(`Misses: ${results.proofReuseSimulation.misses}`);
  lines.push(`Hit rate: ${(results.proofReuseSimulation.hitRate * 100).toFixed(2)}%`);
  lines.push("");
  lines.push("## Conservative Interpretation");
  lines.push("");
  lines.push("The aggregation numbers measure metadata hashing and grouping overhead only. They do not measure cryptographic proof aggregation, recursive verification, folding, or IVC.");
  lines.push("The strongest measured bottleneck in this suite is local proof generation, not metadata batching.");
  fs.writeFileSync(path.join(outputDir, "summary.md"), `${lines.join("\n")}\n`);
}

async function main() {
  const config = parseArgs(process.argv);
  const outputDir = path.join(RESULTS_ROOT, `offchain-${nowStamp()}`);
  fs.mkdirSync(outputDir, { recursive: true });

  console.log(`[bench] Writing results to ${outputDir}`);
  console.log("[bench] Collecting environment and circuit complexity...");
  const environment = collectEnvironment(config);
  const circuitComplexity = collectCircuitComplexity();

  console.log("[bench] Running single-circuit proof benchmarks...");
  const singleCircuit = await benchmarkSingleCircuits(config.repetitions);

  console.log("[bench] Running sequential vertical pipeline benchmarks...");
  const sequentialPipelines = await benchmarkSequentialPipelines(config.pipelineSizes, config.pipelineRepeats);

  console.log("[bench] Running batching/orchestration aggregation overhead benchmark...");
  const aggregationOverhead = benchmarkAggregationOverhead(config.aggregationSizes);

  console.log("[bench] Running infoHash proof reuse simulation...");
  const proofReuseSimulation = benchmarkProofReuseSimulation(config.reuseRequests);

  console.log("[bench] Running controlled concurrency benchmark...");
  const concurrency = await benchmarkConcurrency(config.concurrencyLevels, config.concurrencyPipelines);

  const results = {
    environment,
    circuitComplexity,
    singleCircuit,
    sequentialPipelines,
    aggregationOverhead,
    proofReuseSimulation,
    concurrency,
    interpretationBoundaries: {
      aggregationType: "batching/orchestration aggregation over metadata hashes",
      cryptographicAggregationImplemented: false,
      recursiveVerificationImplemented: false,
      liveOracleCircuits: ["FuelUse"],
      benchmarkOnlyCircuits: ["PM10", "CO2eq"]
    }
  };

  fs.writeFileSync(path.join(outputDir, "environment.json"), `${JSON.stringify(environment, null, 2)}\n`);
  fs.writeFileSync(path.join(outputDir, "raw-results.json"), `${JSON.stringify(results, null, 2)}\n`);
  writeMarkdownSummary(outputDir, environment, results);

  console.log("[bench] Complete.");
  console.log(`[bench] Summary: ${path.join(outputDir, "summary.md")}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[bench] Failed:", err);
  process.exit(1);
});
