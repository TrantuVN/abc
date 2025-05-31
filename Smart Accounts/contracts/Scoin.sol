// SPDX-License-Identifier: MIT
pragma solidity >=0.8.12 <0.9.0;
import "../openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import "../openzeppelin-contracts/contracts/access/Ownable.sol";
import "../openzeppelin-contracts/contracts/token/ERC20/extensions/ERC20Permit.sol";

contract Scoin is ERC20, ERC20Permit, Ownable {
    // Define a state variable for the initial supply
    uint256 public INITIAL_SUPPLY;

    // Define struct for reward tiers
    struct RewardTier {
        uint256 minLikes;
        uint256 rewardAmount;
    }

    // Define struct for user data
    struct UserData {
        uint256 likeCount;
        uint256 moderationScore; // scaled by 1e18
        uint256 firstLikeTimestamp;
        uint8 rewardClaimedLevel; // The highest reward level claimed
    }

    // Map user addresses to their data
    mapping(address => UserData) public userData;
    // Array of reward tiers
    RewardTier[] public rewardTiers;

    // The single constructor for the contract
    constructor() ERC20("Scoin", "SCN") ERC20Permit("Scoin") Ownable(msg.sender) {
        // Set the initial supply
        INITIAL_SUPPLY = 1_000_000 * 1e18;
        // Mint the entire initial supply to the contract deployer
        _mint(msg.sender, INITIAL_SUPPLY);

        // Initialize reward tiers
        // Use the now-initialized INITIAL_SUPPLY
        rewardTiers.push(RewardTier(1000, (INITIAL_SUPPLY * 1) / 100));     // 1%
        rewardTiers.push(RewardTier(5000, (INITIAL_SUPPLY * 2) / 100));     // 2%
        rewardTiers.push(RewardTier(10000, (INITIAL_SUPPLY * 3) / 100));    // 3%
    }

    /**
     * @dev Records a like for a specific user. Only the owner can call this.
     * @param user The address of the user receiving the like.
     */
    function recordLike(address user) external onlyOwner {
        UserData storage data = userData[user];
        if (data.likeCount == 0) {
            data.firstLikeTimestamp = block.timestamp;
        }
        data.likeCount += 1;
    }

    /**
     * @dev Updates a user's moderation score. Only the owner can call this.
     * @param user The address of the user whose score to update.
     * @param score The new moderation score (scaled by 1e18, e.g., 0.5 * 1e18 for 0.5).
     */
    function updateModerationScore(address user, uint256 score) external onlyOwner {
        require(score <= 1e18, "Score out of range"); // Score cannot exceed 1e18 (equivalent to 1.0)
        userData[user].moderationScore = score;
    }

    /**
     * @dev Allows a user to claim their reward if they meet the criteria.
     */
    function claimReward() external {
        UserData storage data = userData[msg.sender];

        // Check if the user has already claimed any reward level
        require(data.rewardClaimedLevel == 0, "Already claimed a reward level");
        // Check moderation score
        require(data.moderationScore >= 0.5 * 1e18, "Moderation score too low");
        // Check claim period (within 30 days of the first like)
        require(block.timestamp <= data.firstLikeTimestamp + 30 days, "Claim period expired");

        uint8 level = 0;
        uint256 rewardAmount = 0;

        // Iterate through reward tiers from highest to lowest
        for (uint8 i = uint8(rewardTiers.length); i > 0; i--) {
            if (data.likeCount >= rewardTiers[i - 1].minLikes) {
                level = i;
                rewardAmount = rewardTiers[i - 1].rewardAmount;
                break; // Found the highest eligible level, exit loop
            }
        }

        require(level > 0, "Not enough likes for any reward");

        // Set the claimed level for the user
        data.rewardClaimedLevel = level;
        // Transfer the reward from the contract to the user
        // Note: The contract itself needs to hold enough Scoin tokens for this to work.
        // If you intended to mint tokens, you would need a _mint function (if available in ERC20 or a custom mechanism).
        // For this example, we assume the contract has the tokens.
        _transfer(address(this), msg.sender, rewardAmount);
        // This replaces _transfer(owner(), msg.sender, rewardAmount);
        // Because owner() is just the contract's owner, not necessarily where the tokens for distribution are held.
        // If tokens are held by the contract itself, we transfer from the contract's address.
    }

    /**
     * @dev Returns the claimable reward level and amount for a user.
     * @param user The address of the user.
     * @return level The claimable reward level (0 if none).
     * @return amount The amount of reward tokens.
     */

    function getClaimableLevel(address user) external view returns (uint8 level, uint256 amount) {
        UserData memory data = userData[user];

        // Check conditions for claiming a reward
        if (
            data.rewardClaimedLevel != 0 || // Already claimed a reward
            data.moderationScore < 0.5 * 1e18 || // Moderation score too low
            block.timestamp > data.firstLikeTimestamp + 30 days // Claim period expired
        ) {
            return (0, 0); // Not eligible
        }

        // Find the highest reward level the user is eligible for
        for (uint8 i = uint8(rewardTiers.length); i > 0; i--) {
            if (data.likeCount >= rewardTiers[i - 1].minLikes) {
                return (i, rewardTiers[i - 1].rewardAmount);
            }
        }

        return (0, 0); // Not enough likes for any level
    }
}