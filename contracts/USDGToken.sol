// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/** 
 @title  Gypsy E2E Transparent Fiat-Stablecoin
 @notice This contract is used by Gypsy to bridge fiat into a fiat stablecoin. 
		This token is designed to be backed and pegged to the USD.
*/

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";

/// @custom:security-contact bryan@gypsy.city
contract USDGToken is ERC20, ERC20Burnable, Ownable, ERC20Permit {
	mapping(address => bool) isBlacklisted;
    constructor() ERC20("USDG", "USDG") ERC20Permit("USDG") {}

    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }

	function blackList(address _user) public onlyOwner  {
        require(!isBlacklisted[_user], "user already blacklisted");
        isBlacklisted[_user] = true;
    }

    function removeFromBlacklist(address _user) public onlyOwner {
        require(isBlacklisted[_user], "user not blacklisted");
        isBlacklisted[_user] = false;
    }
}