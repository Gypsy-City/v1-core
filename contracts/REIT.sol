// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "./TestGPSY.sol";
import "./USDGToken.sol";
import "./HomeNFT.sol";
import "./LGPSYToken.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "hardhat/console.sol";

/** 

 @title  REIT contract
 @author Gypsy.City
 @notice This contract is used by Gypsy to remain compliant with REIT laws.
 @notice SEC File on REITs: https://www.sec.gov/files/reits.pdf

To qualify as a REIT, a company must have the bulk of its assets and income connected to real estate
investment and must distribute at least 90 percent of its taxable income to shareholders annually in the form of dividends.

REIT REQUIREMENTS
	-Be an entity that would be taxable as a corporation but for its REIT status
	-Be managed by a board of directors or trustees
	-Have shares that are fully transferable
	-Have a minimum of 100 shareholders after its first year as a REIT
	-Have no more than 50 percent of its shares held by five or fewer individuals during the last half of the taxable year
	-Invest at least 75 percent of its total assets in real estate assets and cash
	-Derive at least 75 percent of its gross income from real estate related sources, including rents from real property and interest on mortgages financing real property
*/

contract REIT is IERC721Receiver, Ownable {
    address public admin;

    //Wallet connections
    address public operations_wallet; //The REIT operating wallet (Buys, upgrades, and maintains properties)
    address public profits_wallet; //The REIT wallet for profit. This is the 10% profit that a REIT can keep.

    //REIT connections
    address public stablecoin; //the way renters pay for the rent
    address public reit_share; //the share of the REIT.
    address public reit_share_vault; //Pays dividends in new shares of the REIT. Pays 90% of profit
    address public reit_homes_nft; //The NFT collection that has all the homes

    //REIT connection contracts;
    TestGPSY private gypsy_token;
    USDGToken private usdg_token;
    HomeNFT private home_nft;
    LGPSYToken private lgpsy_token;

    //REIT Financials
    uint256 public revenue;
    uint256 public operating_expense;

    //Balance sheet
    uint256 public cash_and_short_term_investments;
    uint256 public total_liabilities;
    uint256 public total_equity;

    //Cashflow
    uint256 public net_income;
    uint256 public cash_from_operations;
    uint256 public cash_from_investing;
    uint256 public cash_from_financing;
    uint256 public net_change_in_cash;
    uint256 public free_cash_flow;

    /*////////////////////////////////////////////////////////
                      		Events
    ////////////////////////////////////////////////////////*/

    event Dividend(
        uint256 balance_to_send_to_reit,
        uint256 balance_to_send_to_investor
    );
    event Request(uint256 amount);

    constructor(
        address _stablecoin,
        address _reit_share,
        address _reit_share_vault,
        address _reit_homes_nft,
        address _reit_operations_wallet,
        address _reit_profits_wallet
    ) {
        //set all contracts
        stablecoin = _stablecoin;
        reit_share = _reit_share;
        reit_share_vault = _reit_share_vault;
        operations_wallet = _reit_operations_wallet;
        profits_wallet = _reit_profits_wallet;
        reit_homes_nft = _reit_homes_nft;

        //make contract objects
        gypsy_token = TestGPSY(_reit_share);
        usdg_token = USDGToken(_stablecoin);
        home_nft = HomeNFT(_reit_homes_nft);
        lgpsy_token = LGPSYToken(_reit_share_vault);

        //set admin
        admin = msg.sender;
    }

    /*////////////////////////////////////////////////////////
            		    REIT TOKEN 
    ////////////////////////////////////////////////////////*/

    /// @notice mints GPSY based on backing price
    /// @dev Called by investors
    function buy(uint256 gpsy_token_amount) public {
        //mints new tokens at backing price
		uint256 backing_price = backingPerShare();
		//make sure this doesnt overflow
		//this was designed this way to do division with more precision
		uint256 usdg_amount_with_extra_decimals = SafeMath.mul(gpsy_token_amount, backing_price);
		uint256 usdg_amount = SafeMath.div(
			usdg_amount_with_extra_decimals,
			10 ** usdg_token.decimals()
		);

		//uint256 allowance = usdg_token.allowance(msg.sender, address(this));
		//require(usdg_amount <= allowance, "Please approve tokens before transferring");

		usdg_token.transferFrom(msg.sender, address(this), usdg_amount);
		//give them the tokens
		gypsy_token.mint(msg.sender, gpsy_token_amount);
    }

	function buyTo(uint256 gpsy_token_amount, address to) public {
		//mints new tokens at backing price
		uint256 backing_price = backingPerShare();

		//make sure this doesnt overflow
		//this was designed this way to do division with more precision
		uint256 usdg_amount_with_extra_decimals = SafeMath.mul(gpsy_token_amount, backing_price);
		uint256 usdg_amount = SafeMath.div(
			usdg_amount_with_extra_decimals,
			10 ** usdg_token.decimals()
		);

		//uint256 allowance = usdg_token.allowance(to, address(this));
		//require(usdg_amount <= allowance, "Please approve Reit spending tokens before transferring");

		//take the USDG
		usdg_token.transferFrom(to, address(this), usdg_amount);
		//give them the tokens
		gypsy_token.mint(to, gpsy_token_amount);        
    }

    /// @notice gets the backing per token in Real estate & Cash reserves
    function backingPerShare() public view returns (uint256) {
        uint256 homeCount = home_nft.count();

		//if there are no homes or gypsy in circulation
        if (homeCount == 0 || gypsy_token.totalSupply() == 0) {
            return 100 * 10 ** usdg_token.decimals();
        } else {
            uint256 current_nav = nav();
            //make sure this doesnt overflow
            //this was designed this way to do division with more precision
            uint256 current_nav_with_decimals = SafeMath.mul(
                current_nav,
                10 ** usdg_token.decimals()
            );
            uint256 backing_per_gpsy = SafeMath.div(
                current_nav_with_decimals,
                gypsy_token.totalSupply()
            );
            return backing_per_gpsy;
        }
    }

    /*////////////////////////////////////////////////////////
            			REIT OPERATIONS
    ////////////////////////////////////////////////////////*/

    /// @notice asks for money from the treasury for the operation wallet
    function request(uint256 amount) public onlyOwner {
        uint256 balance_to_send = usdg_token.balanceOf(address(this));
        require(balance_to_send >= amount, "Insufficient balance for request");
        usdg_token.transfer(operations_wallet, amount);

        emit Request(amount);
    }

    /// @notice Distributes profits to staked investors and gypsy
    /// @dev Called by Gypsy
    function sendDividend() public onlyOwner returns (uint256)  {
        //Sends 10% of the profits to the REIT
        //Sends 90% of the profits to the investors

        uint256 balance_to_send = usdg_token.balanceOf(address(this));
        uint256 balance_to_send_to_reit = SafeMath.div(balance_to_send, 10);
        uint256 balance_to_send_to_investor = balance_to_send -
            balance_to_send_to_reit;

        //transfer to REIT profit
        usdg_token.transfer(profits_wallet, balance_to_send_to_reit);

        //transfer to investors (vault)
        usdg_token.transfer(address(lgpsy_token), balance_to_send_to_investor);

        emit Dividend(balance_to_send_to_reit, balance_to_send_to_investor);

        return balance_to_send;
    }

	/// @notice Distributes profits to staked investors and gypsy
    /// @dev Called by Gypsy
    function sendDividendGypsy(uint256 balance_to_send) public onlyOwner returns (uint256) {
        //Sends 10% of the profits to the REIT
        //Sends 90% of the profits to the investors

        uint256 balance_to_send_to_reit = SafeMath.div(balance_to_send, 10);
        uint256 balance_to_send_to_investor = balance_to_send -
            balance_to_send_to_reit;

        //transfer to REIT profit
        usdg_token.transfer(profits_wallet, balance_to_send_to_reit);

        //transfer to investors (vault)
        //usdg_token.transfer(address(lgpsy_token), balance_to_send_to_investor);

		uint256 backing = backingPerShare();

		  uint256 current_gpsy_amount_with_decimals = SafeMath.div(
                balance_to_send_to_investor,
                backing
            );

		

       uint256 current_gpsy_amount = SafeMath.mul(
                current_gpsy_amount_with_decimals,
                10 ** gypsy_token.decimals()
            );
		
		//mint new gypsy that is equal to the USDG meant to send out
		gypsy_token.mint(address(this), current_gpsy_amount);    
		//send to vault as payment
		gypsy_token.transfer(address(lgpsy_token), current_gpsy_amount);


		
        emit Dividend(balance_to_send_to_reit, balance_to_send_to_investor);

        return balance_to_send;
    }

    function addHome(
        string memory tokenURI,
        uint256 _rent_price,
        uint256 _purchase_price
    ) public onlyOwner returns (bool) {
        //add home NFT
        home_nft.mint(address(this), tokenURI, _rent_price, _purchase_price);

        request(_purchase_price);
        return true;
    }

    function appraiseHome(
        uint256 homeID,
        uint256 new_apprasial_price
    ) public onlyOwner returns (bool) {
        //add home NFT
        home_nft.setAppraisalPrice(homeID, new_apprasial_price);
        return true;
    }

    /// @notice gets the value of the home + cash on hand
    function nav() public view returns (uint256) {
        uint256 cash_on_hand = usdg_token.balanceOf(address(this));
        return cash_on_hand + totalAssets();
    }

    /*////////////////////////////////////////////////////////
            			REIT FINACIALS
    ////////////////////////////////////////////////////////*/

    /// @notice gets the value of the homes
    function totalAssets() public view returns (uint256) {
        uint256 homeCount = home_nft.count();
        uint256 homeSum = 0;

        for (uint256 i = 1; i <= homeCount; i++) {
            homeSum += home_nft.getAppraisalPrice(i);
        }
        return homeSum;
    }

    /// @notice gets the rent of the homes
    function totalRent() public view returns (uint256) {
        uint256 homeCount = home_nft.count();
        uint256 rentSum = 0;

        for (uint256 i = 1; i <= homeCount; i++) {
            rentSum += home_nft.getRent(i);
        }

        return rentSum;
    }

    function numberOfProperties() public view returns (uint256) {
        return home_nft.count();
    }

    /*////////////////////////////////////////////////////////
            	 ERC721 Open Zeppelin overrides
    ////////////////////////////////////////////////////////*/

    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external override returns (bytes4) {
		return IERC721Receiver.onERC721Received.selector;
	}

    /*////////////////////////////////////////////////////////
            	  Ownership
    ////////////////////////////////////////////////////////*/

	function acceptOwnershipGypsy() public onlyOwner{
		gypsy_token.acceptOwnership();
	}
	function acceptOwnershipHomeNft() public onlyOwner{
		home_nft.acceptOwnership();
	}

	function burnHome(uint256 num) public onlyOwner{
		home_nft.burn(num);
	}

	function setRent(uint256 id, uint256 price) public onlyOwner{
		home_nft.setRent(id, price);
	}

	function setAppraisalPrice(uint256 id, uint256 price) public onlyOwner{
		home_nft.setAppraisalPrice(id, price);
	}

	function setRentCycle(uint256 cycle) public onlyOwner{
		home_nft.setRentCycle(cycle);
	}


}


