// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.13;

import {Paymaster} from "./Paymaster.sol";
import {SafeERC20} from "../openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "../openzeppelin-contracts/contracts/interfaces/IERC20.sol";
import {Pausable} from "../openzeppelin-contracts/contracts/utils/Pausable.sol";
import {IPaymasterExtended} from "../external/IPaymasterExtented.sol";
import {UserOperation} from "../external/UserOperation.sol";
import {IPaymaster} from "../external/IPaymaster.sol";
import "@openzeppelin/contracts/access/Ownable.sol";


/// @notice Paymaster that allows users to pay gas using Scoin token and supports paymasterData
contract PaymasterToken is Paymaster, IPaymasterExtended, Pausable {
    using SafeERC20 for IERC20;

    IERC20 public immutable scoin;
    uint256 public constant TOKEN_GAS_PRICE = 1e15; // 0.001 SCN per 1k gas

    mapping(address => uint256) public balances;

    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);
    event Charged(address indexed user, uint256 gasUsed, uint256 feeInSCN);

    constructor(address _entryPoint, address _scoin)
        Paymaster(_entryPoint)
        Pausable()
    {
        scoin = IERC20(_scoin);
    }

    /// @notice Deposit SCN tokens to be used for gas fees
    function deposit(uint256 amount) external whenNotPaused {
        balances[msg.sender] += amount;
        scoin.safeTransferFrom(msg.sender, address(this), amount);
        emit Deposit(msg.sender, amount);
    }

    /// @notice Withdraw SCN tokens
    function withdraw(uint256 amount) external whenNotPaused {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        balances[msg.sender] -= amount;
        scoin.safeTransfer(msg.sender, amount);
        emit Withdraw(msg.sender, amount);
    }

    /// @notice Validate the UserOperation and ensure sender has sufficient SCN
    function validatePaymasterUserOp(
    UserOperation calldata userOp,
    bytes32 /*userOpHash*/,
    uint256 maxCost
)
    external
    view
    override (Paymaster, IPaymaster)
    returns (bytes memory context, uint256 validationData)
{
    address sender = userOp.sender;

    // Convert maxCost in ETH to SCN token equivalent using fixed gas token price
    uint256 maxFeeSCN = (maxCost * TOKEN_GAS_PRICE) / 1e18;

    require(balances[sender] >= maxFeeSCN, "Insufficient SCN balance for gas");

    // Return encoded context and 0 deadline (no time limit)
    return (abi.encode(sender, maxFeeSCN), 0);
}
    /// @notice Deduct SCN after successful operation using paymasterData
    function postOp(
        PostOpMode,
        bytes calldata context,
        uint256 actualGasCost,
        bytes calldata /*paymasterData*/
    ) external virtual override onlyEntryPoint {
        (address sender, uint256 maxFeeSCN) = abi.decode(context, (address, uint256));
        uint256 feeInSCN = (actualGasCost * TOKEN_GAS_PRICE) / 1e18;
        if (feeInSCN > maxFeeSCN) feeInSCN = maxFeeSCN;
        require(balances[sender] >= feeInSCN, "Insufficient SCN in postOp");
        balances[sender] -= feeInSCN;
        emit Charged(sender, actualGasCost, feeInSCN);
    }

    /// @notice Admin-only: withdraw SCN token
    function emergencyWithdraw(address to, uint256 amount) external onlyOwner {
        scoin.safeTransfer(to, amount);
    }

    /// @notice View user's SCN balance
    function getBalance(address user) external view returns (uint256) {
        return balances[user];
    }
}
