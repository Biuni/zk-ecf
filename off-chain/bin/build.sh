#!/bin/bash

# =========================================================

set -e  # exit if a command fails

echo "==============================================="
echo "🔧 Starting CIRCOM circuit compilation"
echo "==============================================="

# === LAYER 1: Transport ===
echo "🚛 Compiling LAYER 1 (Transport)..."

circom circuits/L1/FuelUse.circom --r1cs --wasm --sym -l node_modules -o builds/L1
circom circuits/L1/PM10.circom --r1cs --wasm --sym -l node_modules -o builds/L1
circom circuits/L1/CO2eq.circom --r1cs --wasm --sym -l node_modules -o builds/L1

# =========================================================

echo "==============================================="
echo "⚙️  Starting Groth16 setup for all circuits"
echo "==============================================="

PTAU_FILE="powersOfTau28_hez_final_10.ptau"

# Check whether the ptau file exists
if [ ! -f "$PTAU_FILE" ]; then
  echo "❌ File $PTAU_FILE not found!"
  echo "Download it with:"
  echo "curl -o $PTAU_FILE https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_10.ptau"
  exit 1
fi

# === LAYER 1: Transport ===
echo "🚛 Setup LAYER 1 (Transport)..."

snarkjs groth16 setup builds/L1/FuelUse.r1cs $PTAU_FILE builds/L1/FuelUse_0000.zkey
snarkjs groth16 setup builds/L1/PM10.r1cs $PTAU_FILE builds/L1/PM10_0000.zkey
snarkjs groth16 setup builds/L1/CO2eq.r1cs $PTAU_FILE builds/L1/CO2eq_0000.zkey

# =========================================================

echo "==============================================="
echo "🤝 Starting CONTRIBUTION for all circuits"
echo "==============================================="

# Function to generate a random phrase (16 chars)
random_phrase() {
  openssl rand -hex 8
}

# === LAYER 1 ===
echo "🚛 Contribution LAYER 1 (Transport)..."

snarkjs zkey contribute builds/L1/FuelUse_0000.zkey builds/L1/FuelUse_final.zkey \
  --name="FuelUse Contribution" -v -e=$(random_phrase)

snarkjs zkey contribute builds/L1/PM10_0000.zkey builds/L1/PM10_final.zkey \
  --name="PM10 Contribution" -v -e=$(random_phrase)

snarkjs zkey contribute builds/L1/CO2eq_0000.zkey builds/L1/CO2eq_final.zkey \
  --name="CO2eq Contribution" -v -e=$(random_phrase)

# =========================================================

echo "==============================================="
echo "🧩 Extracting VERIFICATION KEYS"
echo "==============================================="

# === LAYER 1 ===
echo "🚛 Extracting LAYER 1 (Transport)..."

snarkjs zkey export verificationkey builds/L1/FuelUse_final.zkey builds/L1/verification_key_FuelUse.json
snarkjs zkey export verificationkey builds/L1/PM10_final.zkey builds/L1/verification_key_PM10.json
snarkjs zkey export verificationkey builds/L1/CO2eq_final.zkey builds/L1/verification_key_CO2eq.json

# =========================================================

echo "==============================================="
echo "🧩 Exporting SOLIDITY verifiers"
echo "==============================================="

# === LAYER 1 ===
echo "🚛 Exporting LAYER 1 (Transport)..."

snarkjs zkey export solidityverifier builds/L1/FuelUse_final.zkey ../on-chain/contracts/FuelUseVerifier.sol
perl -0pi -e 's/contract Groth16Verifier/contract FuelUseVerifier/' ../on-chain/contracts/FuelUseVerifier.sol
snarkjs zkey export solidityverifier builds/L1/PM10_final.zkey ../on-chain/verifiers/PM10Verifier.sol
snarkjs zkey export solidityverifier builds/L1/CO2eq_final.zkey ../on-chain/verifiers/CO2eqVerifier.sol
