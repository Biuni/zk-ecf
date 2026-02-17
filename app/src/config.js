/**
 * Application configuration
 * VITE_* variables are defined in the .env file
 */

// Deployed contract addresses
export const COORDINATOR_ADDRESS = import.meta.env.VITE_COORDINATOR_ADDRESS || '';
export const PROOF_MANAGER_ADDRESS = import.meta.env.VITE_PROOF_MANAGER_ADDRESS || '';

// Chain ID for Sepolia
export const EXPECTED_CHAIN_ID = parseInt(import.meta.env.VITE_CHAIN_ID || '11155111');

// Network name
export const NETWORK_NAME = 'Sepolia';

// Validate configuration
export function validateConfig() {
  const errors = [];
  
  if (!COORDINATOR_ADDRESS || COORDINATOR_ADDRESS === '0x_COORDINATOR_ADDRESS_AFTER_DEPLOY') {
    errors.push('VITE_COORDINATOR_ADDRESS is not configured');
  }
  
  if (!PROOF_MANAGER_ADDRESS || PROOF_MANAGER_ADDRESS === '0x_PROOF_MANAGER_ADDRESS_AFTER_DEPLOY') {
    errors.push('VITE_PROOF_MANAGER_ADDRESS is not configured');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Configuration log (development only)
if (import.meta.env.DEV) {
  console.log('===========================================');
  console.log('App Configuration:');
  console.log('===========================================');
  console.log('Coordinator:', COORDINATOR_ADDRESS || '(not set)');
  console.log('ProofManager:', PROOF_MANAGER_ADDRESS || '(not set)');
  console.log('Expected Chain ID:', EXPECTED_CHAIN_ID);
  console.log('===========================================');
}
