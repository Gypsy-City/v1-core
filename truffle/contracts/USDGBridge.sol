// contracts/MBSContract.sol
// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

contract USDGBridge {
    address public admin;

    constructor() {
        admin = msg.sender;
    }

    function multiply(uint256 x, uint256 y) internal pure returns (uint256 z) {
        require(y == 0 || (z = x * y) / y == x);
    }
}
