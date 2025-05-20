// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@account-abstraction/contracts/core/BasePaymaster.sol";
import "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MyPaymaster is BasePaymaster, Ownable {
    uint256 public constant MAX_GAS = 1_000_000;

    constructor(IEntryPoint _entryPoint) {
        entryPoint = _entryPoint;
    }

    receive() external payable {}

    function validatePaymasterUserOp(
        UserOperation calldata userOp,
        bytes32,  // userOpHash
        uint256   // maxCost
    ) external view override returns (bytes memory context, uint256 validationData) {
        require(userOp.callGasLimit <= MAX_GAS, "Gas limit too high");
        return ("", 0); // 0 = valid
    }

    function postOp(
        PostOpMode,           // mode: op succeeded, reverted, etc.
        bytes calldata,       // context from validatePaymasterUserOp
        uint256               // actualGasCost
    ) external override {
        // Optional: track user usage, log gas, etc.
    }

    function withdraw(address payable to, uint256 amount) external onlyOwner {
        (bool success, ) = to.call{value: amount}("");
        require(success, "Withdrawal failed");
    }
}
