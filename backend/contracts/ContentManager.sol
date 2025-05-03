// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "typechain-types/@openzeppelin/contracts/access/AccessControl.ts";
import "typechain-types/@openzeppelin/contracts/utils/Pausable.ts";
import "typechain-types/@openzeppelin/contracts/utils/ReentrancyGuard.ts";
import "./Scoin.sol";
import "./ContentQuery.sol";

contract ContentManager is AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant VALIDATOR_ROLE = keccak256("VALIDATOR_ROLE");
    bytes32 public constant AI_MODERATOR_ROLE = keccak256("AI_MODERATOR_ROLE");

    Scoin public immutable scoin;
    ContentQuery public contentQuery;

    // Moderation thresholds
    uint256 public constant requiredAIDecisions = 3;

    struct Content {
        string cid;
        address owner;
        uint256 timestamp;
        bool isModerated;
        bool isApproved;
        uint256 bandwidthAllocation;
        uint256 reputationScore;
        string title;
        string description;
    }

    struct ModerationDecision {
        address moderator;
        bool approved;
        uint256 confidence;
        uint256 timestamp;
        bool isAI;
    }

    // Content management
    mapping(string => Content) public contents; // CID => Content
    mapping(address => string[]) public userContent; // User => CIDs
    mapping(string => ModerationDecision[]) public moderationDecisions; // CID => Decisions

    // Bandwidth management
    mapping(address => uint256) public userBandwidth;
    uint128 public constant BANDWIDTH_PRICE = 100 * 10**18; // 100 SCOIN
    uint64 public constant BANDWIDTH_DURATION = 365 days;

    // Events
    event ContentSubmitted(string indexed cid, address indexed owner, uint256 timestamp);
    event ContentModerated(string indexed cid, bool approved, uint256 confidence, bool isAIModerated);
    event BandwidthPurchased(address indexed user, uint256 amount);
    event ReputationUpdated(address indexed user, uint256 newScore);

    constructor(address _scoin) {
        scoin = Scoin(_scoin);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function setContentQuery(address _contentQuery) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(address(contentQuery) == address(0), "ContentQuery already set");
        contentQuery = ContentQuery(_contentQuery);
    }

    // Content submission
    function submitContent(
        string calldata cid,
        uint256 size,
        string calldata title,
        string calldata description
    ) external whenNotPaused nonReentrant {
        require(bytes(cid).length > 0, "Invalid CID");
        require(!contents[cid].isModerated, "Content already exists");
        require(userBandwidth[msg.sender] >= size, "Insufficient bandwidth");
        require(bytes(title).length > 0, "Title required");
        require(bytes(description).length > 0, "Description required");

        contents[cid] = Content({
            cid: cid,
            owner: msg.sender,
            timestamp: block.timestamp,
            isModerated: false,
            isApproved: false,
            bandwidthAllocation: size,
            reputationScore: 0,
            title: title,
            description: description
        });

        userContent[msg.sender].push(cid);
        userBandwidth[msg.sender] -= size;

        // Index the content if query contract is set
        if (address(contentQuery) != address(0)) {
            contentQuery.indexContent(cid);
        }

        emit ContentSubmitted(cid, msg.sender, block.timestamp);
    }

    // AI-based moderation function
    function submitAIModeration(
        string calldata cid,
        bool approved,
        uint256 confidence
    ) external onlyRole(AI_MODERATOR_ROLE) whenNotPaused {
        require(bytes(cid).length > 0, "Invalid CID");
        require(!contents[cid].isModerated, "Content already moderated");
        
        ModerationDecision memory decision = ModerationDecision({
            moderator: msg.sender,
            approved: approved,
            confidence: confidence,
            timestamp: block.timestamp,
            isAI: true
        });
        
        moderationDecisions[cid].push(decision);
        
        // Check if we have enough AI decisions
        if (moderationDecisions[cid].length >= requiredAIDecisions) {
            _finalizeModeration(cid);
        }
    }

    // Bandwidth purchase
    function purchaseBandwidth(uint256 amount) external whenNotPaused nonReentrant {
        require(amount > 0, "Invalid amount");
        uint256 cost = amount * BANDWIDTH_PRICE;
        require(scoin.balanceOf(msg.sender) >= cost, "Insufficient SCOIN balance");

        // Transfer SCOIN
        require(scoin.transferFrom(msg.sender, address(this), cost), "Transfer failed");

        // Allocate bandwidth
        userBandwidth[msg.sender] += amount;
        scoin.allocateBandwidth(msg.sender, uint128(amount), BANDWIDTH_DURATION);

        emit BandwidthPurchased(msg.sender, amount);
    }

    // Validator rewards
    function distributeValidatorRewards(address validator, uint256 amount) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
        whenNotPaused 
    {
        require(hasRole(VALIDATOR_ROLE, validator), "Not a validator");
        scoin.distributeRewards(validator, uint128(amount));
    }

    // Internal functions
    function _finalizeModeration(string memory cid) internal {
        ModerationDecision[] storage decisions = moderationDecisions[cid];
        uint256 approvalCount = 0;
        uint256 totalConfidence = 0;

        // Count approvals from AI moderators
        for (uint i = 0; i < decisions.length; i++) {
            if (decisions[i].approved) {
                approvalCount++;
            }
            totalConfidence += decisions[i].confidence;
        }

        uint256 averageConfidence = totalConfidence / decisions.length;
        bool finalApproval = approvalCount > decisions.length / 2;

        Content storage content = contents[cid];
        content.isModerated = true;
        content.isApproved = finalApproval;

        // Update reputation score
        if (finalApproval) {
            content.reputationScore = averageConfidence;
            _updateUserReputation(content.owner, averageConfidence);
        }

        // Re-index the content after moderation if query contract is set
        if (address(contentQuery) != address(0)) {
            contentQuery.indexContent(cid);
        }

        emit ContentModerated(cid, finalApproval, averageConfidence, true);
    }

    function _updateUserReputation(address user, uint256 score) internal {
        // Update user's reputation in the validator system if they're a validator
        if (hasRole(VALIDATOR_ROLE, user)) {
            // Implement reputation update logic
            emit ReputationUpdated(user, score);
        }
    }

    // View functions
    function getUserContent(address user) external view returns (string[] memory) {
        return userContent[user];
    }

    function getContentDetails(string calldata cid) external view returns (
        address owner,
        uint256 timestamp,
        bool isModerated,
        bool isApproved,
        uint256 bandwidthAllocation,
        uint256 reputationScore,
        string memory title,
        string memory description
    ) {
        Content memory content = contents[cid];
        return (
            content.owner,
            content.timestamp,
            content.isModerated,
            content.isApproved,
            content.bandwidthAllocation,
            content.reputationScore,
            content.title,
            content.description
        );
    }

    function getModerationDecisions(string calldata cid) external view returns (
        ModerationDecision[] memory
    ) {
        return moderationDecisions[cid];
    }

    // Admin functions
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
} 