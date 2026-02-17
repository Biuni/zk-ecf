# Environment Configuration - Off-Chain Oracle

Create a `.env` file in the `off-chain/` folder with the following variables:

```env
# WebSocket RPC URL for Sepolia (required to listen to events)
# IMPORTANT: Use WebSocket (wss://), not HTTP (https://)
JSON_RPC_PROVIDER=wss://sepolia.infura.io/ws/v3/YOUR_INFURA_PROJECT_ID

# Oracle account private key
# This account must be registered as oracle in ProofManager
# WARNING: Never commit the real private key!
ORACLE_PRIVATE_KEY=0x_YOUR_ORACLE_PRIVATE_KEY_HERE

# Deployed contract addresses on Sepolia
# These values must be updated after deployment
COORDINATOR_ADDRESS=0x_COORDINATOR_ADDRESS_AFTER_DEPLOY
PROOF_MANAGER_ADDRESS=0x_PROOF_MANAGER_ADDRESS_AFTER_DEPLOY
```

## How to get the values

1. **JSON_RPC_PROVIDER**: Use a WebSocket endpoint (wss://) from Infura or Alchemy
2. **ORACLE_PRIVATE_KEY**: Generate a new oracle account and export its private key
3. **COORDINATOR_ADDRESS** and **PROOF_MANAGER_ADDRESS**: After deployment, copy the addresses from the output

## Important note

The Oracle account must have ETH on Sepolia to pay for transactions.
You can get testnet ETH from:
- [Sepolia Faucet](https://sepoliafaucet.com/)
- [Alchemy Sepolia Faucet](https://sepoliafaucet.com/)
