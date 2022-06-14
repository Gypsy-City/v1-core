// contracts/MBSContract.sol
// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract USDGToken is ERC20 {
    address public admin;

    constructor() ERC20("USDGContract", "USDG") {
        admin = msg.sender;
    }

    function multiply(uint256 x, uint256 y) internal pure returns (uint256 z) {
        require(y == 0 || (z = x * y) / y == x);
    }

    function mint(address to, uint256 amount) public virtual returns (bool) {
        require(msg.sender == admin, "only admin or treasury");
        uint256 newAmount = multiply(amount, 10**18);
        _mint(to, newAmount);
        return true;
    }

    function burn(uint256 amount) public virtual returns (bool) {
        _burn(msg.sender, amount);
        return true;
    }
}
