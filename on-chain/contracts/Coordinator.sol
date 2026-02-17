// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @dev Minimal ProofManager interface used by Coordinator.
interface IProofManager {
    function getProofIfExists(bytes32 infoHash)
        external
        view
        returns (bool exists, bytes32 proofHash);
}

/// @title Coordinator for zk-oracle prototype
/// @notice Receives client requests, queries ProofManager,
///         and coordinates result delivery.
contract Coordinator {
    enum Status {
        None,
        Pending,
        ProofFound,
        Error
    }

    struct VerificationRequest {
        address requester;   // who requested verification (client)
        bytes32 infoHash;    // identifier of the "compliance" to be verified
        Status status;
        bytes32 proofHash;   // proof reference (hash, id, etc.)
        string error;        // optional error reason
    }

    /// @notice ProofManager address
    address public proofManager;

    /// @dev Counter to assign unique request IDs
    uint256 public nextRequestId;

    /// @dev Mapping requestId -> request struct
    mapping(uint256 => VerificationRequest) public requests;

    /// @notice Emitted when a new request is created
    event VerificationRequested(
        uint256 indexed requestId,
        address indexed requester,
        bytes32 infoHash
    );

    /// @notice Emitted when a proof is found (or reused)
    event ProofFound(
        uint256 indexed requestId,
        bytes32 proofHash
    );

    /// @notice Emitted on verification process error
    event VerificationError(
        uint256 indexed requestId,
        string reason
    );

    modifier onlyProofManager() {
        require(msg.sender == proofManager, "Coordinator: not ProofManager");
        _;
    }

    constructor(address _proofManager) {
        require(_proofManager != address(0), "Coordinator: zero address");
        proofManager = _proofManager;
    }

    /// @notice Client requests verification for a given infoHash
    /// @param infoHash identifier (e.g. hash of compliance parameters)
    /// @return requestId unique request ID
    function requestVerification(bytes32 infoHash)
        external
        returns (uint256 requestId)
    {
        requestId = nextRequestId++;

        VerificationRequest storage req = requests[requestId];
        req.requester = msg.sender;
        req.infoHash = infoHash;
        req.status = Status.Pending;

        emit VerificationRequested(requestId, msg.sender, infoHash);

        // 1) Synchronous check whether a proof already exists
        (bool exists, bytes32 proofHash) =
            IProofManager(proofManager).getProofIfExists(infoHash);

        if (exists) {
            // Case: "proof was already generated"
            req.status = Status.ProofFound;
            req.proofHash = proofHash;

            emit ProofFound(requestId, proofHash);
            // In this case oracle does not need to do anything:
            // client can already read the result.
        }

        // 2) If not found, request remains Pending:
        // off-chain oracle listens to VerificationRequested
        // and starts proof generation.
    }

    /// @notice Called by ProofManager when proof is available
    /// @param requestId request ID to attach the proof to
    /// @param proofHash proof reference (hash)
    function notifyProof(uint256 requestId, bytes32 proofHash)
        external
        onlyProofManager
    {
        VerificationRequest storage req = requests[requestId];
        require(req.status == Status.Pending, "Coordinator: not pending");

        req.status = Status.ProofFound;
        req.proofHash = proofHash;

        emit ProofFound(requestId, proofHash);
    }

    /// @notice Called by ProofManager in case of verification error
    /// @param requestId request ID
    /// @param reason error reason text
    function notifyError(uint256 requestId, string calldata reason)
        external
        onlyProofManager
    {
        VerificationRequest storage req = requests[requestId];
        require(req.status == Status.Pending, "Coordinator: not pending");

        req.status = Status.Error;
        req.error = reason;

        emit VerificationError(requestId, reason);
    }

    /// @notice Returns all details of a request
    function getRequest(uint256 requestId)
        external
        view
        returns (
            address requester,
            bytes32 infoHash,
            Status status,
            bytes32 proofHash,
            string memory error
        )
    {
        VerificationRequest storage req = requests[requestId];
        return (req.requester, req.infoHash, req.status, req.proofHash, req.error);
    }
}
