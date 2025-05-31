// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.13;

import {IPaymaster} from "../external/IPaymaster.sol";
import {IEntryPoint} from "../external/IEntryPoint.sol";
import {UserOperation} from "../external/UserOperation.sol";
import {Ownable} from "../openzeppelin-contracts/contracts/access/Ownable.sol";
// Based on PayMaster in: https://github.com/eth-infinitism/account-abstraction
// ...    
contract Paymaster is IPaymaster, Ownable(address(this)) {

    IEntryPoint public entryPoint;
    uint256 public constant MAX_FREE_CALLS = 3;
    mapping(address => uint256) public userCalls;

    event UpdateEntryPoint(address indexed newEntryPoint, address indexed oldEntryPoint);
    event UserAccepted(address indexed user, uint256 callCount);
    event UserRejected(address indexed user, uint256 callCount);

    modifier onlyEntryPoint() {
        require(msg.sender == address(entryPoint), "Only EntryPoint can call");
        _;
    }

    constructor(address _entryPoint) {
        entryPoint = IEntryPoint(_entryPoint);
    }

    function setEntryPoint(address _newEntryPoint) external onlyOwner {
        emit UpdateEntryPoint(_newEntryPoint, address(entryPoint));
        entryPoint = IEntryPoint(_newEntryPoint);
    }

    function validatePaymasterUserOp(
        UserOperation calldata userOp,
        bytes32,
        uint256
    ) external view override virtual returns (bytes memory context, uint256 validationData) {
        address sender = userOp.sender;
        uint256 calls = userCalls[sender];

        if (calls >= MAX_FREE_CALLS) {
            revert("Paymaster: User has exceeded free limit");
        }

        return (abi.encode(sender), 0); // deadline = 0 (no expiry)
    }
/// @notice Handler for charging the sender (smart wallet) for the transaction after it has been paid for by the paymaster
    function postOp(PostOpMode mode, bytes calldata context, uint256 actualGasCost) external onlyEntryPoint {}

    /// ------- Stake and Deposit APIs (same as before) -------

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
