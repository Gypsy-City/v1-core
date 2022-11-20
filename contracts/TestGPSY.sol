// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./erc20/permit/ERC20Permit.sol";

contract TestGPSY is ERC20Permit {
  
    address public admin;

    event Mint(address _from, address indexed _to, uint256 _value);
    event Burn(address indexed _from, uint256 _value);

    constructor() ERC20Permit("GPSYContract", "GPSY", 6) {
        admin = msg.sender;
    }

    function mint(address to, uint256 amount) public virtual returns (bool) {
        _mint(to, amount);
        emit Mint(msg.sender, to, amount);
        return true;
    }

    function burn(uint256 amount) public virtual returns (bool) {
        _burn(msg.sender, amount);
        emit Burn(msg.sender, amount);
        return true;
    }

}
