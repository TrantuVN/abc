// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "typechain-types/@openzeppelin/contracts/token/ERC20/IERC20.ts";
import "typechain-types/@openzeppelin/contracts/access/AccessControl.ts";
import "typechain-types/@openzeppelin/contracts/utils/ReentrancyGuard.ts";
import "./Scoin.sol";

contract BandwidthMarket is AccessControl, ReentrancyGuard {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    
    Scoin public immutable scoin;
    
    struct Provider {
        string ipfsNodeId;
        uint256 bandwidth;
        uint256 price;
        uint256 totalEarned;
        uint128 reputation;
        bool isRegistered;
    }
    
    struct Consumer {
        bool isRegistered;
        uint256 totalSpent;
        mapping(address => uint256) allocatedBandwidth;
    }
    
    mapping(address => Provider) public providers;
    mapping(address => Consumer) public consumers;
    
    event ProviderRegistered(address indexed provider, string ipfsNodeId, uint256 bandwidth, uint256 price);
    event ConsumerRegistered(address indexed consumer);
    event BandwidthPurchased(address indexed consumer, address indexed provider, uint256 amount, uint256 price);
    event ReputationUpdated(address indexed provider, uint256 newReputation);

    constructor(address _scoinAddress) {
        scoin = Scoin(_scoinAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    function registerProvider(
        string calldata _ipfsNodeId,
        uint256 _bandwidth,
        uint256 _price
    ) external {
        require(!providers[msg.sender].isRegistered, "Already registered");
        require(_bandwidth > 0 && _price > 0, "Invalid parameters");
        
        providers[msg.sender] = Provider({
            ipfsNodeId: _ipfsNodeId,
            bandwidth: _bandwidth,
            price: _price,
            totalEarned: 0,
            reputation: 100,
            isRegistered: true
        });
        
        emit ProviderRegistered(msg.sender, _ipfsNodeId, _bandwidth, _price);
    }

    function registerConsumer() external {
        require(!consumers[msg.sender].isRegistered, "Already registered");
        consumers[msg.sender].isRegistered = true;
        emit ConsumerRegistered(msg.sender);
    }

    function purchaseBandwidth(address provider, uint256 amount) external nonReentrant {
        Provider storage providerData = providers[provider];
        Consumer storage consumerData = consumers[msg.sender];
        
        require(consumerData.isRegistered, "Consumer not registered");
        require(providerData.isRegistered, "Provider not registered");
        require(amount <= providerData.bandwidth, "Insufficient bandwidth");
        
        uint256 cost = amount * providerData.price;
        require(scoin.transferFrom(msg.sender, provider, cost), "Transfer failed");
        
        unchecked {
            providerData.bandwidth -= amount;
            consumerData.allocatedBandwidth[provider] += amount;
            consumerData.totalSpent += cost;
            providerData.totalEarned += cost;
        }
        
        emit BandwidthPurchased(msg.sender, provider, amount, cost);
    }

    function updateProviderReputation(address provider, uint128 newReputation) external onlyRole(ADMIN_ROLE) {
        require(providers[provider].isRegistered, "Provider not registered");
        require(newReputation <= 100, "Invalid reputation score");
        
        providers[provider].reputation = newReputation;
        emit ReputationUpdated(provider, newReputation);
    }

    function getProvider(address provider) external view returns (
        bool isRegistered,
        uint256 bandwidth,
        uint256 price,
        string memory ipfsNodeId,
        uint256 totalEarned,
        uint128 reputation
    ) {
        Provider storage p = providers[provider];
        return (
            p.isRegistered,
            p.bandwidth,
            p.price,
            p.ipfsNodeId,
            p.totalEarned,
            p.reputation
        );
    }

    function getConsumerAllocation(address consumer, address provider) external view returns (uint256) {
        return consumers[consumer].allocatedBandwidth[provider];
    }
} 