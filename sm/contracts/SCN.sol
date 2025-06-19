// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.12;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Token is ERC20, Ownable {
    uint256 public constant MAX_SUPPLY = 1000000 * 10**18; // 1,000,000 SCN with 18 decimals

    constructor() ERC20("Scoin", "SCN") {
        _mint(msg.sender, MAX_SUPPLY); // Mint full supply to deployer
        transferOwnership(msg.sender); // Set deployer as owner
    }

    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }

    function burnFrom(address account, uint256 amount) external {
        _spendAllowance(account, msg.sender, amount);
        _burn(account, amount);
    }
}