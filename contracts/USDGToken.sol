pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract USDGToken is ERC20 {
    mapping(address => bool) isBlacklisted;
    address public admin;

    event Mint(address _from, address indexed _to, uint256 _value);
    event Burn(address indexed _from, uint256 _value);

    constructor() ERC20("USDGContract", "USDG") {
        admin = msg.sender;
    }


    function multiply(uint256 x, uint256 y) internal pure returns (uint256 z) {
        require(y == 0 || (z = x * y) / y == x);
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
        address owner = _msgSender();
        _transfer(owner, to, amount);
        return true;
    }

    function mint(address to, uint256 amount) public virtual returns (bool) {
        require(msg.sender == admin, "only admin or treasury");
        uint256 newAmount = multiply(amount, 10**18);
        _mint(to, newAmount);
        emit Mint(msg.sender, to, newAmount);
        return true;
    }

    function burn(uint256 amount) public virtual returns (bool) {
        uint256 newAmount = multiply(amount, 10**18);
        _burn(msg.sender, newAmount);
        emit Burn(msg.sender, newAmount);
        return true;
    }
}
