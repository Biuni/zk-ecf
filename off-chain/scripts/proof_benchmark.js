const { groth16 } = require("snarkjs");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { performance } = require("perf_hooks");

const BUILDS_PATH = path.join(__dirname, "../builds/L1");
const VEHICLE_TYPES = [0, 1, 2];
const FUEL_EFFICIENCY = [12, 20, 32];
const PM10_FACTORS = [200, 320, 500];
const CO2EQ_FACTORS = [2000, 3000, 4000];
const CO2EQ_SCALE = 1000;
const MAX_FUEL_ALLOWED = 300;
const PM10_THRESHOLD = 150000;
const CO2EQ_THRESHOLD = 900;

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

function hashProofPayload(proofBytes, publicSignals, tag) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify({ tag, proofBytes, publicSignals }))
    .digest("hex");
}

function formatMs(value) {
  return `${value.toFixed(2)} ms`;
}

function computeFuelUse(vehicleType, distance) {
  const efficiency = FUEL_EFFICIENCY[vehicleType];
  return (distance * efficiency) / 100;
}

function computePm10(vehicleType, fuelUsed) {
  return fuelUsed * PM10_FACTORS[vehicleType];
}

function computeCo2eq(vehicleType, fuelUsed) {
  return (fuelUsed * CO2EQ_FACTORS[vehicleType]) / CO2EQ_SCALE;
}

function findCompatibleVerticalInput(preferredInput) {
  const MAX_DISTANCE_SEARCH = 5000;

  const candidateTypes = preferredInput && Number.isInteger(Number(preferredInput.vehicle_type))
    ? [Number(preferredInput.vehicle_type), ...VEHICLE_TYPES.filter((t) => t !== Number(preferredInput.vehicle_type))]
    : VEHICLE_TYPES;

  for (const vehicleType of candidateTypes) {
    for (let distance = 1; distance <= MAX_DISTANCE_SEARCH; distance += 1) {
      const fuel = computeFuelUse(vehicleType, distance);
      if (!Number.isInteger(fuel)) {
        continue;
      }

      if (fuel > MAX_FUEL_ALLOWED) {
        continue;
      }

      const pm10 = computePm10(vehicleType, fuel);
      if (pm10 > PM10_THRESHOLD) {
        continue;
      }

      const co2eqScaled = fuel * CO2EQ_FACTORS[vehicleType];
      if (co2eqScaled % CO2EQ_SCALE !== 0) {
        continue;
      }

      const co2eq = computeCo2eq(vehicleType, fuel);
      if (co2eq > CO2EQ_THRESHOLD) {
        continue;
      }

      return {
        vehicle_type: vehicleType,
        distance_traveled: distance,
        derived: { fuel_used: fuel, pm10, co2eq }
      };
    }
  }

  throw new Error("Nessun input compatibile trovato per il batching verticale FuelUse->PM10->CO2eq");
}

function aggregatePair(left, right, level) {
  const start = performance.now();

  const aggregateHash = crypto
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

  const end = performance.now();

  return {
    node: {
      type: "aggregate",
      id: `agg-L${level}-${aggregateHash.slice(0, 8)}`,
      hash: aggregateHash,
      size: left.size + (right ? right.size : 0),
      children: right ? [left.id, right.id] : [left.id]
    },
    elapsedMs: end - start
  };
}

function aggregateRecursively(nodes, level = 0, metrics = []) {
  if (nodes.length === 0) {
    return { root: null, metrics };
  }

  if (nodes.length === 1) {
    return { root: nodes[0], metrics };
  }

  const nextLevel = [];
  let levelTimeMs = 0;
  let merges = 0;

  for (let i = 0; i < nodes.length; i += 2) {
    const left = nodes[i];
    const right = nodes[i + 1];
    const { node, elapsedMs } = aggregatePair(left, right, level);
    nextLevel.push(node);
    levelTimeMs += elapsedMs;
    merges += 1;
  }

  metrics.push({
    level,
    inputNodes: nodes.length,
    outputNodes: nextLevel.length,
    merges,
    levelTimeMs
  });

  return aggregateRecursively(nextLevel, level + 1, metrics);
}

async function generateCircuitProof(circuitName, circuitInput, options = {}) {
  const { silent = false } = options;
  const wasmPath = path.join(BUILDS_PATH, `${circuitName}_js/${circuitName}.wasm`);
  const zkeyPath = path.join(BUILDS_PATH, `${circuitName}_final.zkey`);

  if (!silent) {
    console.log(`\n[+] Generazione proof ${circuitName}`);
    console.log("Input:", circuitInput);
  }

  const started = performance.now();
  const { proof, publicSignals } = await groth16.fullProve(circuitInput, wasmPath, zkeyPath);
  const ended = performance.now();

  const formatted = formatProofForContract(proof, publicSignals);
  const proofBytes = [formatted.pA, formatted.pB, formatted.pC, formatted.pubSignals];

  return {
    circuitName,
    proofBytes,
    publicSignals: formatted.pubSignals,
    elapsedMs: ended - started,
    proofHash: hashProofPayload(proofBytes, formatted.pubSignals, circuitName)
  };
}

function parseSignal(signal) {
  return Number(BigInt(signal));
}

async function generateVerticalBatch(baseInput, batchIndex) {
  const start = performance.now();

  const fuel = await generateCircuitProof(
    "FuelUse",
    {
      vehicle_type: baseInput.vehicle_type,
      distance_traveled: baseInput.distance_traveled
    },
    { silent: true }
  );

  const fuelUsed = parseSignal(fuel.publicSignals[0]);

  const pm10 = await generateCircuitProof(
    "PM10",
    {
      vehicle_type: baseInput.vehicle_type,
      fuel_used: fuelUsed
    },
    { silent: true }
  );

  const pm10Value = parseSignal(pm10.publicSignals[0]);

  const co2eq = await generateCircuitProof(
    "CO2eq",
    {
      vehicle_type: baseInput.vehicle_type,
      fuel_used: fuelUsed
    },
    { silent: true }
  );

  const verticalAggStart = performance.now();
  const verticalHash = crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        type: "vertical-batch",
        batchIndex,
        fuel: fuel.proofHash,
        pm10: pm10.proofHash,
        co2eq: co2eq.proofHash
      })
    )
    .digest("hex");
  const verticalAggEnd = performance.now();

  const end = performance.now();

  const generationMs = fuel.elapsedMs + pm10.elapsedMs + co2eq.elapsedMs;
  const verticalAggregationMs = verticalAggEnd - verticalAggStart;

  return {
    node: {
      type: "vertical-batch",
      id: `vb-${batchIndex}`,
      hash: verticalHash,
      size: 3,
      children: [`FuelUse-${batchIndex}`, `PM10-${batchIndex}`, `CO2eq-${batchIndex}`]
    },
    generationMs,
    verticalAggregationMs,
    totalMs: end - start,
    outputs: {
      fuel_used: fuelUsed,
      pm10: pm10Value,
      co2eq: parseSignal(co2eq.publicSignals[0])
    }
  };
}

async function generateVerticalBatches(baseInput, count) {
  const nodes = [];
  let generationTotalMs = 0;
  let verticalAggregationTotalMs = 0;

  for (let i = 0; i < count; i += 1) {
    try {
      const batch = await generateVerticalBatch(baseInput, i + 1);
      nodes.push(batch.node);
      generationTotalMs += batch.generationMs;
      verticalAggregationTotalMs += batch.verticalAggregationMs;
    } catch (err) {
      console.error(`Errore durante il vertical batch #${i + 1}`);
      console.error("Input base:", baseInput);
      throw err;
    }
  }

  return { nodes, generationTotalMs, verticalAggregationTotalMs };
}

async function warmupBenchmark(baseInput) {
  console.log("\n[WARMUP] Avvio warm-up (non conteggiato nel benchmark)...");

  // Warm-up completo della pipeline verticale per inizializzare:
  // - caricamento wasm/zkey
  // - witness calculator
  // - cache FS / JIT runtime
  const { nodes } = await generateVerticalBatches(baseInput, 1);
  aggregateRecursively(nodes);

  console.log("[WARMUP] Completato. Avvio misure reali.");
}

async function runVerticalBatchingBenchmark(baseInput) {
  const sizes = [1, 2, 4, 8];
  const results = [];

  console.log("\n===========================================");
  console.log("Empirical Vertical Batching Benchmark");
  console.log("===========================================");
  console.log("Pipeline verticale per batch: FuelUse -> PM10 -> CO2eq");
  console.log("Le proof sono reali; l'aggregazione finale e' simulata ricorsivamente.");

  await warmupBenchmark(baseInput);

  for (const size of sizes) {
    const totalProofs = size * 3;
    console.log(`\n[TEST] ${size} batch verticali (${totalProofs} prove totali)...`);

    const totalStart = performance.now();

    const { nodes, generationTotalMs, verticalAggregationTotalMs } =
      await generateVerticalBatches(baseInput, size);

    const recursiveAggregationStart = performance.now();
    const { root, metrics } = aggregateRecursively(nodes);
    const recursiveAggregationEnd = performance.now();

    const totalEnd = performance.now();

    const recursiveAggregationMs = recursiveAggregationEnd - recursiveAggregationStart;
    const aggregationTotalMs = verticalAggregationTotalMs + recursiveAggregationMs;
    const totalMs = totalEnd - totalStart;

    const levelBreakdown = metrics.map(
      (m) => `L${m.level}: ${m.inputNodes}->${m.outputNodes} (${formatMs(m.levelTimeMs)})`
    );

    results.push({
      proofs: totalProofs,
      generationMs: generationTotalMs,
      aggregationMs: aggregationTotalMs,
      totalMs,
      avgPerProofMs: generationTotalMs / totalProofs,
      aggregateLevels: metrics.length,
      rootSize: root ? root.size : 0,
      rootHash: root ? root.hash.slice(0, 12) : "-"
    });

    console.log(`  - Tempo generazione prove (3 circuiti x batch): ${formatMs(generationTotalMs)}`);
    console.log(`  - Tempo aggregazione verticale+ricorsiva: ${formatMs(aggregationTotalMs)}`);
    console.log(`  - Tempo totale: ${formatMs(totalMs)}`);
    console.log(`  - Livelli aggregazione ricorsiva: ${metrics.length}`);
    if (levelBreakdown.length > 0) {
      console.log(`  - Dettaglio livelli: ${levelBreakdown.join(" | ")}`);
    }
  }

  console.log("\n===========================================");
  console.log("Risultati sintetici");
  console.log("===========================================");
  console.table(
    results.map((r) => ({
      prove: r.proofs,
      gen_ms: Number(r.generationMs.toFixed(2)),
      agg_ms: Number(r.aggregationMs.toFixed(2)),
      totale_ms: Number(r.totalMs.toFixed(2)),
      avg_prova_ms: Number(r.avgPerProofMs.toFixed(2)),
      livelli: r.aggregateLevels
    }))
  );

  const baseline = results[0];
  if (baseline) {
    console.log("\nCrescita rispetto al caso base (1 batch verticale = 3 prove):");
    for (const row of results) {
      const genGrowth = row.generationMs / baseline.generationMs;
      const totalGrowth = row.totalMs / baseline.totalMs;
      console.log(
        `- ${row.proofs} prove -> generazione x${genGrowth.toFixed(2)}, totale x${totalGrowth.toFixed(2)}`
      );
    }
  }

  return results;
}

function loadProverData() {
  const dataPath = path.join(__dirname, "../../data/proverData.json");
  try {
    return JSON.parse(fs.readFileSync(dataPath, "utf8"));
  } catch (err) {
    console.error("Error loading proverData.json:", err.message);
    return null;
  }
}

async function main() {
  const proverData = loadProverData();
  if (!proverData) {
    process.exitCode = 1;
    return;
  }

  try {
    const compatibleInput = findCompatibleVerticalInput(proverData);
    console.log("\n[+] Input compatibile selezionato per batching verticale:");
    console.log(compatibleInput);
    await runVerticalBatchingBenchmark(compatibleInput);
  } catch (err) {
    console.error("Benchmark error:", err);
    process.exitCode = 1;
  }
}

main().then(() => {
  process.exit(process.exitCode || 0);
});
