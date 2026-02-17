# 🧩 **ARCHITECTURE DESCRIPTION**

## **Overview**

The architecture is a complete system for managing and verifying *zero-knowledge proofs* through an off-chain oracle.  
The system is composed of:

1. **On-chain smart contracts**
2. **Off-chain oracle**
3. **Frontend client**
4. **Prover + database**
5. **Asynchronous events to coordinate the flow**

Main goals:

- receive verification requests from a client,
- verify whether a proof already exists,
- optionally generate proofs through an off-chain oracle,
- store and verify proofs,
- return results to the client.

---

# 🟦 **1. On-Chain Smart Contracts**

## **1.1 Coordinator.sol**

It is the entry point for verification requests.

### **Responsibilities**

- Accepts client requests: `requestVerification(infoHash)`
- Checks if a proof already exists through ProofManager
- If proof exists -> emits `ProofFound`
- If proof does not exist -> emits `VerificationRequested` (event listened to by oracle)
- Receives callbacks from ProofManager:

  - `notifyProof(requestId, proofHash)`
  - `notifyError(requestId, reason)`

### **Managed data**

Each request has:

- `requester`
- `infoHash`
- `status` (Pending, ProofFound, Error)
- `proofHash` (if present)
- `error` (if present)

### **Events**

- `VerificationRequested(requestId, requester, infoHash)`
- `ProofFound(requestId, proofHash)`
- `VerificationError(requestId, reason)`

---

## **1.2 ProofManager.sol**

It is the main component that manages proofs.

### **Responsibilities**

- Check whether a proof already exists (`getProofIfExists`)
- Receive new proofs from oracle (`submitProofForRequest`)
- Verify proof through a Verifier smart contract
- Store proofs
- Reuse existing proofs for identical infoHash values
- Notify Coordinator:

  - `notifyProof(requestId, proofHash)`
  - `notifyError(requestId, reason)`

### **Data structure**

`mapping(infoHash -> ProofRecord)` where `ProofRecord` contains:

- `exists`
- `infoHash`
- `proofHash`
- `isAggregate`
- `timestamp`

### **Events**

- `ProofStored(infoHash, proofHash, isAggregate)`

### **Authorization**

- Only one specific account (`oracle`) can call `submitProofForRequest`

---

## **1.3 Verifier.sol (optional)**

These are Smart Contracts generated via snarkJS under `on-chain/verifiers`.

Expected API:

```solidity
function verify(bytes proof, bytes32 infoHash) external view returns (bool)
```

---

# 🟦 **2. Off-Chain Oracle (Node.js)**

The oracle is a Node.js process that:

1. Connects to blockchain via Web3.js
2. Listens to Coordinator event `VerificationRequested`
3. Retrieves required data from Prover via REST API
4. Generates proof (through snarkJS)
5. Calls `ProofManager.submitProofForRequest(...)`
6. Coordinator automatically receives notification

### **Authentication**

The oracle signs transactions using a **dedicated private key**, registered in ProofManager as authorized.

---

# 🟦 **3. Database**

The database is currently just a JSON file that mirrors the data the Prover must provide to generate proof.

---

# 🟦 **4. Demo Client (React + Web3.js)**

The client allows users to:

- send verification request (`requestVerification(infoHash)`)
- view request status
- view final result

### **Main features**

- MetaMask connection through Web3.js
- `RequestForm` component to send requests
- `ContractEvents` component to listen to:

  - `VerificationRequested`
  - `ProofFound`
  - `VerificationError`

- Dynamic rendering of status and result

### **Hook**

- `useContract(abi, address)` to instantiate smart contracts

### **Context**

- `Web3Context` to manage:

  - web3 instance
  - accounts
  - networkId

---

# 🟦 **5. End-to-End Flow**

### **1. Client -> Coordinator**

Client sends:

```
requestVerification(infoHash)
```

### **2. Coordinator -> ProofManager**

Checks if proof exists:

- if yes -> `ProofFound`
- if no -> `VerificationRequested`

### **3. Oracle receives event**

It processes:

- fetches data from Prover
- generates proof
- submits proof to ProofManager:

```
submitProofForRequest(requestId, infoHash, proof, isAggregate)
```

### **4. ProofManager**

- verifies (optional)
- stores
- calls `Coordinator.notifyProof(requestId, proofHash)`

### **5. Coordinator**

Emits event:

```
ProofFound(requestId, proofHash)
```

### **6. Client**

Updates UI with result

---

# 🟦 **6. Component Integration**

| Component         | Communicates with | Method                     |
| ----------------- | ----------------- | -------------------------- |
| Client            | Coordinator       | Web3.js (tx + events)      |
| Coordinator       | ProofManager      | direct on-chain calls      |
| ProofManager      | Coordinator       | on-chain callbacks         |
| Off-chain Oracle  | Coordinator       | Web3.js events             |
| Off-chain Oracle  | ProofManager      | signed tx                  |
| Off-chain Oracle  | ProverDB          | HTTP REST                  |
| Prover            | DB                | SQL queries                |
