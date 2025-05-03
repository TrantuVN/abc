// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "typechain-types/@openzeppelin/contracts/access/AccessControl.ts";
import "./ContentManager.sol";

contract ContentQuery is AccessControl {
    ContentManager public immutable contentManager;

    // Query indexes
    mapping(uint256 => string[]) public contentByTimestamp; // timestamp => CIDs
    mapping(uint256 => string[]) public contentByReputation; // reputation score => CIDs
    mapping(address => string[]) public contentByOwner; // owner => CIDs
    mapping(bool => string[]) public contentByApprovalStatus; // approval status => CIDs

    // Events
    event ContentIndexed(string indexed cid, address indexed owner, uint256 timestamp);
    event IndexCleared(string indexed indexType);

    constructor(address _contentManager) {
        contentManager = ContentManager(_contentManager);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // Query functions
    function queryContentByTimeRange(
        uint256 startTime,
        uint256 endTime,
        bool onlyApproved
    ) external view returns (string[] memory) {
        require(startTime <= endTime, "Invalid time range");
        
        // First pass to count matching content
        uint256 count = 0;
        for (uint256 t = startTime; t <= endTime; t++) {
            string[] memory contentAtTime = contentByTimestamp[t];
            for (uint256 i = 0; i < contentAtTime.length; i++) {
                if (!onlyApproved || isContentApproved(contentAtTime[i])) {
                    count++;
                }
            }
        }

        // Second pass to collect content
        string[] memory result = new string[](count);
        uint256 resultIndex = 0;
        for (uint256 t = startTime; t <= endTime; t++) {
            string[] memory contentAtTime = contentByTimestamp[t];
            for (uint256 i = 0; i < contentAtTime.length; i++) {
                if (!onlyApproved || isContentApproved(contentAtTime[i])) {
                    result[resultIndex] = contentAtTime[i];
                    resultIndex++;
                }
            }
        }

        return result;
    }

    function queryContentByReputationRange(
        uint256 minReputation,
        uint256 maxReputation
    ) external view returns (string[] memory) {
        require(minReputation <= maxReputation, "Invalid reputation range");
        
        uint256 count = 0;
        for (uint256 r = minReputation; r <= maxReputation; r++) {
            count += contentByReputation[r].length;
        }

        string[] memory result = new string[](count);
        uint256 resultIndex = 0;
        for (uint256 r = minReputation; r <= maxReputation; r++) {
            string[] memory contentAtRep = contentByReputation[r];
            for (uint256 i = 0; i < contentAtRep.length; i++) {
                result[resultIndex] = contentAtRep[i];
                resultIndex++;
            }
        }

        return result;
    }

    function queryContentByOwner(address owner) external view returns (string[] memory) {
        return contentByOwner[owner];
    }

    function queryContentByApproval(bool approved) external view returns (string[] memory) {
        return contentByApprovalStatus[approved];
    }

    // Indexing functions
    function indexContent(string calldata cid) external {
        require(msg.sender == address(contentManager), "Only ContentManager can index");
        
        (
            address owner,
            uint256 timestamp,
            bool isModerated,
            bool isApproved,
            ,  // bandwidthAllocation
            uint256 reputationScore
        ) = contentManager.getContentDetails(cid);

        // Index by timestamp
        contentByTimestamp[timestamp].push(cid);
        
        // Index by reputation
        contentByReputation[reputationScore].push(cid);
        
        // Index by owner
        contentByOwner[owner].push(cid);
        
        // Index by approval status (only if moderated)
        if (isModerated) {
            contentByApprovalStatus[isApproved].push(cid);
        }

        emit ContentIndexed(cid, owner, timestamp);
    }

    // Helper functions
    function isContentApproved(string memory cid) internal view returns (bool) {
        (
            ,  // owner
            ,  // timestamp
            bool isModerated,
            bool isApproved,
            ,  // bandwidthAllocation
            // reputationScore
        ) = contentManager.getContentDetails(cid);
        
        return isModerated && isApproved;
    }

    // Admin functions
    function clearIndex(string calldata indexType) external onlyRole(DEFAULT_ADMIN_ROLE) {
        emit IndexCleared(indexType);
    }
} 