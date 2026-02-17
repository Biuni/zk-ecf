// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title VerifierAdapter
/// @notice Adapts the snarkJS Groth16Verifier interface to the IVerifier interface
///         expected by ProofManager

interface IGroth16Verifier {
    function verifyProof(
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        uint[2] calldata _pubSignals
    ) external view returns (bool);
}

contract VerifierAdapter {
    /// @notice The underlying Groth16 verifier contract
    IGroth16Verifier public immutable groth16Verifier;

    constructor(address _groth16Verifier) {
        require(_groth16Verifier != address(0), "VerifierAdapter: zero address");
        groth16Verifier = IGroth16Verifier(_groth16Verifier);
    }

    /// @notice Verifies a proof by decoding the bytes and calling the Groth16 verifier
    /// @param proof ABI-encoded proof data (pA, pB, pC, pubSignals)
    /// @param infoHash Not used in verification, kept for interface compatibility
    /// @return True if the proof is valid, false otherwise
    function verify(bytes calldata proof, bytes32 infoHash) external view returns (bool) {
        // Suppress unused variable warning
        infoHash;
        
        // Decode the proof from bytes
        // Expected format: abi.encode(pA, pB, pC, pubSignals)
        (
            uint[2] memory pA,
            uint[2][2] memory pB,
            uint[2] memory pC,
            uint[2] memory pubSignals
        ) = abi.decode(proof, (uint[2], uint[2][2], uint[2], uint[2]));

        // Call the underlying verifier
        return groth16Verifier.verifyProof(pA, pB, pC, pubSignals);
    }
}

