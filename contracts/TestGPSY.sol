// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";

contract TestGPSY is ERC20, ERC20Burnable,Ownable2Step, ERC20Permit {
    constructor() ERC20("Gypsy Token", "GPSY") ERC20Permit("Gypsy Token") {}

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
}
