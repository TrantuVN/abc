// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.13;

import {IPaymaster} from "./IPaymaster.sol";

interface IPaymasterExtended is IPaymaster {
    function postOp(
        PostOpMode mode,
        bytes calldata context,
        uint256 actualGasCost,
        bytes calldata paymasterData
    ) external;
}
