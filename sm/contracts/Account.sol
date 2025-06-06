// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.12;
import "@account-abstraction/contracts/core/EntryPoint.sol";
import "@account-abstraction/contracts/interfaces/IAccount.sol";
contract Account is IAccount {
    uint256 public count ;
    address public owner;
    constructor (address _owner) {
        owner = _owner;
    }
    function validateUserOp(UserOperation calldata, bytes32, uint256) external pure returns (uint256 validationData) {
        // Here you can implement your custom validation logic
        // For simplicity, we will just return 0 to indicate success
        return 0;
    }
    function execute() external {
        count++;
    }
}
contract AccountFactory {
    function createAccount(address owner) external returns (address) {
        Account acc = new Account(owner);
        return address(acc);
    }
}