// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./erc20/permit/ERC20Permit.sol";

/** 
 @title  Gypsy E2E Transparent Fiat-Stablecoin
 @notice This contract is used by Gypsy to bridge fiat into a fiat stablecoin. 
		This token is designed to be backed and pegged to the USD.
*/

contract USDGToken is ERC20Permit {
	address public admin;
    mapping(address => bool) isBlacklisted;
	
    event Mint(address _from, address indexed _to, uint256 _value);
    event Burn(address indexed _from, uint256 _value);

    constructor() ERC20Permit("USDGContract", "USDG",6) {
        admin = msg.sender;
    }

    function blackList(address _user) public  {
        require(msg.sender == admin, "only admin or treasury");
        require(!isBlacklisted[_user], "user already blacklisted");
        isBlacklisted[_user] = true;
    }

    function removeFromBlacklist(address _user) public {
        require(msg.sender == admin, "only admin or treasury");
        require(isBlacklisted[_user], "user not blacklisted");
        isBlacklisted[_user] = false;
    }

    function transfer(address to, uint256 amount)
        public
        virtual
        override
        returns (bool)
    {
        require(!isBlacklisted[to], "Recipient is backlisted");
        address owner = msg.sender;
        _transfer(owner, to, amount);
        return true;
    }

    function mint(address to, uint256 amount) public virtual returns (bool) {
        //require(msg.sender == admin, "only admin or treasury");

        _mint(to, amount);
        emit Mint(msg.sender, to, amount);
        return true;
    }

    function burn(uint256 amount) public virtual returns (bool) {

        _burn(msg.sender, amount);
        emit Burn(msg.sender, amount);
        return true;
    }

   	//====================
	//safe math
	//====================
    function multiply(uint256 x, uint256 y) internal pure returns (uint256 z) {
        require(y == 0 || (z = x * y) / y == x);
    }
}
