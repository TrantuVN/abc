// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "typechain-types/@openzeppelin/contracts/token/ERC20/ERC20.ts";
import "typechain-types/@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.ts";
import "typechain-types/@openzeppelin/contracts/utils/Pausable.ts";
import "typechain-types/@openzeppelin/contracts/access/AccessControl.ts";
import "typechain-types/@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.ts";
import "typechain-types/@openzeppelin/contracts/utils/math/Math.ts";

contract Scoin is ERC20, ERC20Burnable, Pausable, AccessControl, ERC20Permit {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant STAKING_ROLE = keccak256("STAKING_ROLE");

    struct Stake {
        uint128 amount;
        uint64 since;
        bool isActive;
    }

    struct Validator {
        uint128 totalStaked;
        uint64 reputationScore;
        bool isActive;
        address addr;
    }

    mapping(address => Stake) public stakes;
    mapping(address => Validator) public validators;
    mapping(uint256 => address) private validatorByIndex;
    uint256 public validatorCount;

    uint128 public constant MINIMUM_STAKE = 1000 * 10**18;
    uint64 public constant STAKE_LOCK_PERIOD = 365 days;
    uint128 public constant VALIDATOR_THRESHOLD = 10000 * 10**18;
    uint128 public totalStaked;

    struct BandwidthAllocation {
        uint128 amount;
        uint64 expiry;
    }
    
    mapping(address => BandwidthAllocation) public bandwidthAllocations;

    event Staked(address indexed user, uint128 amount);
    event Unstaked(address indexed user, uint128 amount);
    event ValidatorRegistered(address indexed validator);
    event ValidatorRemoved(address indexed validator);
    event BandwidthAllocated(address indexed user, uint128 amount, uint64 expiry);
    event RewardDistributed(address indexed validator, uint128 amount);

    constructor() 
        ERC20("Scoin", "SCOIN") 
        ERC20Permit("Scoin") 
    {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(STAKING_ROLE, msg.sender);
        
        _mint(msg.sender, 1000000 * 10**decimals());
    }

    function stake(uint128 amount) external whenNotPaused {
        require(amount >= MINIMUM_STAKE, "Below minimum stake");
        require(balanceOf(msg.sender) >= amount, "Insufficient balance");

        _transfer(msg.sender, address(this), amount);
        
        Stake storage userStake = stakes[msg.sender];
        if (userStake.isActive) {
            userStake.amount += amount;
        } else {
            userStake.amount = amount;
            userStake.since = uint64(block.timestamp);
            userStake.isActive = true;
        }
        
        unchecked {
            totalStaked += amount;
        }
        
        emit Staked(msg.sender, amount);

        if (userStake.amount >= VALIDATOR_THRESHOLD && !validators[msg.sender].isActive) {
            _registerValidator(msg.sender);
        }
    }

    function unstake() external {
        Stake storage userStake = stakes[msg.sender];
        require(userStake.isActive, "No active stake");
        require(uint64(block.timestamp) >= userStake.since + STAKE_LOCK_PERIOD, "Stake locked");

        uint128 amount = userStake.amount;
        userStake.amount = 0;
        userStake.isActive = false;
        
        unchecked {
            totalStaked -= amount;
        }

        if (validators[msg.sender].isActive) {
            _removeValidator(msg.sender);
        }

        _transfer(address(this), msg.sender, amount);
        emit Unstaked(msg.sender, amount);
    }

    function _registerValidator(address validator) internal {
        validators[validator] = Validator({
            totalStaked: stakes[validator].amount,
            reputationScore: 100,
            isActive: true,
            addr: validator
        });
        
        validatorByIndex[validatorCount] = validator;
        unchecked {
            validatorCount++;
        }
        
        emit ValidatorRegistered(validator);
    }

    function _removeValidator(address validator) internal {
        validators[validator].isActive = false;
        
        for (uint256 i = 0; i < validatorCount;) {
            if (validatorByIndex[i] == validator) {
                validatorByIndex[i] = validatorByIndex[validatorCount - 1];
                delete validatorByIndex[validatorCount - 1];
                unchecked {
                    validatorCount--;
                }
                break;
            }
            unchecked {
                ++i;
            }
        }
        
        emit ValidatorRemoved(validator);
    }

    function allocateBandwidth(
        address user,
        uint128 amount,
        uint64 duration
    ) external onlyRole(STAKING_ROLE) whenNotPaused {
        require(amount > 0, "Invalid amount");
        require(duration > 0, "Invalid duration");

        uint64 expiry = uint64(block.timestamp) + duration;
        bandwidthAllocations[user] = BandwidthAllocation({
            amount: amount,
            expiry: expiry
        });

        emit BandwidthAllocated(user, amount, expiry);
    }

    function distributeRewards(address validator, uint128 amount) 
        external 
        onlyRole(STAKING_ROLE) 
        whenNotPaused 
    {
        require(validators[validator].isActive, "Not active validator");
        _mint(validator, amount);
        emit RewardDistributed(validator, amount);
    }

    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function _update(
        address from,
        address to,
        uint256 amount
    ) internal virtual override(ERC20) whenNotPaused {
        super._update(from, to, amount);
    }

    function getValidators() external view returns (address[] memory) {
        address[] memory validatorAddresses = new address[](validatorCount);
        for (uint256 i = 0; i < validatorCount;) {
            validatorAddresses[i] = validatorByIndex[i];
            unchecked {
                ++i;
            }
        }
        return validatorAddresses;
    }

    function getValidatorInfo(address validator) external view returns (
        uint128 stakedAmount,
        uint64 reputationScore,
        bool isActive
    ) {
        Validator memory v = validators[validator];
        return (v.totalStaked, v.reputationScore, v.isActive);
    }

    function getBandwidthAllocation(address user) external view returns (
        uint128 amount,
        uint64 expiry
    ) {
        BandwidthAllocation memory allocation = bandwidthAllocations[user];
        return (allocation.amount, allocation.expiry);
    }
} 
