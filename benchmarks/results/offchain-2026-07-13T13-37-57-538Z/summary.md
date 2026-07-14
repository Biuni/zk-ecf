# Off-chain Benchmark Results

Executed at: 2026-07-13T13:37:57.543Z
Node: v24.9.0
CPU: Apple M1 Pro (10 logical CPUs)
Git commit: 800cd5f4ca889d0cc30cc602013b69447299fe40

## Scope

- Executed: local Groth16 proving and verification with existing build artifacts.
- Executed: sequential vertical FuelUse -> PM10 -> CO2eq pipeline benchmarks.
- Executed: controlled concurrency over independent vertical pipelines.
- Executed: batching/orchestration aggregation overhead over metadata hashes.
- Executed: in-memory simulation of infoHash proof reuse semantics.
- Not part of this off-chain run: on-chain gas benchmarks.

## Circuit Complexity

| Circuit | Constraints | Wires | Private inputs | Public inputs | Outputs | R1CS bytes | WASM bytes | zkey bytes |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| FuelUse | 148 | 150 | 2 | 0 | 2 | 23500 | 39884 | 83442 |
| PM10 | 147 | 149 | 2 | 0 | 2 | 23408 | 39797 | 83119 |
| CO2eq | 150 | 152 | 2 | 0 | 2 | 23792 | 39996 | 84168 |

## Single-Circuit Proving

| Circuit | Repetitions | Mean prove ms | Median prove ms | p95 prove ms | Mean verify ms | All verified |
|---|---:|---:|---:|---:|---:|---|
| FuelUse | 8 | 30.930 | 30.308 | 33.971 | 9.503 | true |
| PM10 | 8 | 29.415 | 29.278 | 30.330 | 9.091 | true |
| CO2eq | 8 | 29.351 | 28.983 | 30.634 | 9.160 | true |

## Sequential Vertical Pipeline

| Batches | Proofs | Median wall ms | Median aggregation ms | Median proofs/sec | All verified |
|---:|---:|---:|---:|---:|---|
| 1 | 3 | 115.379 | 0.060625 | 26.001 | true |
| 2 | 6 | 232.063 | 0.113916 | 25.855 | true |
| 4 | 12 | 481.792 | 0.136250 | 24.907 | true |
| 8 | 24 | 940.084 | 0.149542 | 25.530 | true |

## Concurrency

| Concurrency | Pipelines | Proofs | Wall ms | Proofs/sec | All verified |
|---:|---:|---:|---:|---:|---|
| 1 | 6 | 18 | 697.690 | 25.799 | true |
| 2 | 6 | 18 | 632.842 | 28.443 | true |
| 4 | 6 | 18 | 590.179 | 30.499 | true |

## Proof Reuse Simulation

Requests: 10000
Hits: 5000
Misses: 5000
Hit rate: 50.00%

## Conservative Interpretation

The aggregation numbers measure metadata hashing and grouping overhead only. They do not measure cryptographic proof aggregation, recursive verification, folding, or IVC.
The strongest measured bottleneck in this suite is local proof generation, not metadata batching.
