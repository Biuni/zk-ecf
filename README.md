# ZK-Oracle Prototype

On-chain Zero-Knowledge Proof verification system with an off-chain oracle.

## 📋 Architecture

The system is composed of:

1. **Smart Contracts (on-chain)**: Coordinator, ProofManager, VerifierAdapter, FuelUseVerifier
2. **Off-Chain Oracle**: Node.js service that generates and submits proofs
3. **Frontend**: React client to interact with the system

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18
- npm or yarn
- MetaMask
- Account with ETH on Sepolia testnet

### 1. Install dependencies

```bash
# On-chain (Hardhat)
cd on-chain
npm install

# Off-chain (Oracle)
cd ../off-chain
npm install

# Frontend
cd ../app
npm install
```

### 2. Environment configuration

#### On-chain (`on-chain/.env`)
```env
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID
SEPOLIA_PRIVATE_KEY=0x_YOUR_PRIVATE_KEY
```

#### Off-chain (`off-chain/.env`)
```env
JSON_RPC_PROVIDER=wss://sepolia.infura.io/ws/v3/YOUR_PROJECT_ID
ORACLE_PRIVATE_KEY=0x_YOUR_ORACLE_PRIVATE_KEY
COORDINATOR_ADDRESS=0x_AFTER_DEPLOY
PROOF_MANAGER_ADDRESS=0x_AFTER_DEPLOY
```

#### Frontend (`app/.env`)
```env
VITE_COORDINATOR_ADDRESS=0x_AFTER_DEPLOY
VITE_PROOF_MANAGER_ADDRESS=0x_AFTER_DEPLOY
VITE_CHAIN_ID=11155111
```

### 3. Deploy contracts

```bash
cd on-chain

# Compile contracts
npx hardhat compile

# Deploy to Sepolia
npx hardhat ignition deploy ./ignition/modules/Deploy.ts --network sepolia --parameters '{"adminAddress": "0xYOUR_ADMIN_ADDRESS", "oracleAddress": "0xYOUR_ORACLE_ADDRESS"}'
```

After deployment, update addresses in the `.env` files.

### 4. Start Oracle

```bash
cd off-chain
node scripts/main.js
```

### 5. Start Frontend

```bash
cd app
npm run dev
```

## 📁 Project structure

```
zk-ecf/
├── on-chain/                 # Smart contracts
│   ├── Coordinator.sol       # Request entry point
│   ├── ProofManager.sol      # Proof management
│   ├── VerifierAdapter.sol   # Adapter for snarkJS verifier
│   ├── verifiers/            # Groth16 verifiers
│   │   └── FuelUseVerifier.sol
│   └── ignition/modules/     # Deployment scripts
│
├── off-chain/                # Oracle service
│   ├── scripts/
│   │   ├── main.js           # Oracle entry point
│   │   ├── blockchain.js     # Web3 connection
│   │   └── proof_engine.js   # Proof generation
│   ├── circuits/             # Circom circuits
│   └── builds/               # Circuit builds
│
├── app/                      # React frontend
│   └── src/
│       ├── components/       # UI components
│       ├── context/          # Web3Context
│       └── hooks/            # Custom hooks
│
└── data/                     # Test data
    └── proverData.json
```

## 🔄 Verification flow

1. **Client** sends `requestVerification(infoHash)` to Coordinator
2. **Coordinator** checks whether a proof already exists
3. If it does not exist, it emits `VerificationRequested`
4. **Oracle** receives the event and generates the ZK proof
5. **Oracle** calls `submitProofForRequest()` on ProofManager
6. **ProofManager** verifies the proof on-chain via VerifierAdapter
7. **ProofManager** notifies Coordinator
8. **Coordinator** emits `ProofFound`
9. **Client** receives event and displays result

## 🛠️ Useful commands

```bash
# Compile contracts
cd on-chain && npx hardhat compile

# Start local Hardhat network
cd on-chain && npx hardhat node

# Generate new circuit (if needed)
cd off-chain && ./bin/build.sh

# Frontend
cd app && npm run dev
```

## 📖 Documentation

For a detailed architecture description, see [description.md](./description.md).
