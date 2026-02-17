# Environment Configuration - Frontend

Create a `.env` file in the `app/` folder with the following variables:

```env
# Deployed contract addresses on Sepolia
# These values must be updated after deployment
VITE_COORDINATOR_ADDRESS=0x_COORDINATOR_ADDRESS_AFTER_DEPLOY
VITE_PROOF_MANAGER_ADDRESS=0x_PROOF_MANAGER_ADDRESS_AFTER_DEPLOY

# Chain ID for Sepolia
VITE_CHAIN_ID=11155111
```

## How to get the values

1. **VITE_COORDINATOR_ADDRESS** and **VITE_PROOF_MANAGER_ADDRESS**: 
   After deploying the contracts, copy the addresses from the deploy command output

## Note

Variables that start with `VITE_` are exposed to the client in Vite.
Never put private keys or sensitive information in these variables.
