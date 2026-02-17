# Environment Configuration - On-Chain

Create a `.env` file in the `on-chain/` folder with the following variables:

```env
# RPC URL for Sepolia testnet
# You can use Infura, Alchemy, or other providers
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID

# Private key of the account used for deployment
# WARNING: Never commit the real private key!
SEPOLIA_PRIVATE_KEY=0x_YOUR_PRIVATE_KEY_HERE

# Etherscan API key for contract verification (optional)
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_API_KEY
```

## How to get the values

1. **SEPOLIA_RPC_URL**: Sign up on [Infura](https://infura.io) or [Alchemy](https://alchemy.com) and create a Sepolia project
2. **SEPOLIA_PRIVATE_KEY**: Export the private key from MetaMask (Account Details → Export Private Key)
3. **ETHERSCAN_API_KEY**: Sign up on [Etherscan](https://etherscan.io/apis) to get an API key
