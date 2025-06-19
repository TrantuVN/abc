// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.12;

import {IPaymaster} from "@account-abstraction/contracts/interfaces/IPaymaster.sol";
import {IEntryPoint} from "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import "@account-abstraction/contracts/interfaces/UserOperation.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Paymaster is IPaymaster, Ownable {
    IEntryPoint public entryPoint;
    IERC20 public token;
    uint256 public constant MAX_FREE_CALLS = 3;
    uint256 public constant TOKEN_FEE = 10 * 10**18; // 10 tokens per transaction
    mapping(address => uint256) public userCalls;

    event UpdateEntryPoint(address indexed newEntryPoint, address indexed oldEntryPoint);
    event UserAccepted(address indexed user, uint256 callCount);
    event UserRejected(address indexed user, uint256 callCount);
    event TokenCharged(address indexed user, uint256 amount);

    modifier onlyEntryPoint() {
        require(msg.sender == address(entryPoint), "Only EntryPoint can call");
        _;
    }

    constructor(address _entryPoint, address _token) {
        entryPoint = IEntryPoint(_entryPoint);
        token = IERC20(_token);
    }

    function setEntryPoint(address _newEntryPoint) external onlyOwner {
        emit UpdateEntryPoint(_newEntryPoint, address(entryPoint));
        entryPoint = IEntryPoint(_newEntryPoint);
    }

    function validatePaymasterUserOp(
        UserOperation calldata userOp,
        bytes32,
        uint256
    ) external override returns (bytes memory context, uint256 validationData) {
        address sender = userOp.sender;
        uint256 calls = userCalls[sender];

        if (calls >= MAX_FREE_CALLS) {
            require(token.balanceOf(sender) >= TOKEN_FEE, "Paymaster: Insufficient token balance");
            require(token.allowance(sender, address(this)) >= TOKEN_FEE, "Paymaster: Insufficient token allowance");
        }

        return (abi.encode(sender), 0); // No expiry
    }

    function postOp(
        PostOpMode,
        bytes calldata context,
        uint256
    ) external override onlyEntryPoint {
        address sender = abi.decode(context, (address));
        userCalls[sender] += 1;

        if (userCalls[sender] <= MAX_FREE_CALLS) {
            emit UserAccepted(sender, userCalls[sender]);
        } else {
            token.transferFrom(sender, address(this), TOKEN_FEE);
            emit TokenCharged(sender, TOKEN_FEE);
            emit UserAccepted(sender, userCalls[sender]);
        }
    }

    // Reset user calls
    function resetUserCalls(address user) external onlyOwner {
        userCalls[user] = 0;
    }

    // Withdraw collected tokens
    function withdrawTokens(address to, uint256 amount) external onlyOwner {
        token.transfer(to, amount);
    }

    // Stake & Deposit Functions
    function addStake(uint32 _unstakeDelaySeconds) external payable onlyOwner {
        entryPoint.addStake{value: msg.value}(_unstakeDelaySeconds);
    }

    function unlockStake() external onlyOwner {
        entryPoint.unlockStake();
    }

    function withdrawStake(address payable to) external onlyOwner {
        entryPoint.withdrawStake(to);
    }

    function deposit() external payable {
        entryPoint.depositTo{value: msg.value}(address(this));
    }

    function withdraw(address payable to, uint256 amount) external onlyOwner {
        entryPoint.withdrawTo(to, amount);
    }

    function withdrawAll(address payable to) external onlyOwner {
        entryPoint.withdrawTo(to, getDeposit());
    }

    function getDeposit() public view returns (uint112) {
        return entryPoint.getDepositInfo(address(this)).deposit;
    }
}