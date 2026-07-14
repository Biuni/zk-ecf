# Benchmarks

This directory contains the experimental benchmark suite for the zk-Oracle
prototype.

## Documents

- `docs/implementation-audit.md`: repository audit and MHBP implementation map.
- `docs/benchmark-design.md`: experiment design, scope, and reproducibility.
- `docs/experimental-report.md`: results from the executed benchmark run.

## Executable Off-chain Benchmark

Run from the repository root:

```bash
node benchmarks/scripts/run-offchain-benchmarks.js
```

The script writes timestamped results to:

```text
benchmarks/results/offchain-<timestamp>/
```

Each result directory contains raw JSON and a Markdown summary.

## On-chain Gas Benchmark

Implemented script:

```text
benchmarks/scripts/onchain-gas-benchmark.mjs
```

Run from `on-chain/` with the NVM Node v24.9.0 environment:

```bash
npx hardhat run ../benchmarks/scripts/onchain-gas-benchmark.mjs --network hardhatMainnet
```

## Terminology

The current repository implements batching/orchestration aggregation over proof
metadata. It does not implement recursive SNARK aggregation, folding, IVC, or
cryptographic proof aggregation.