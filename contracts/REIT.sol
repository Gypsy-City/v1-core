// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./TestGPSY.sol";
import "./USDGToken.sol";
import "./HomeNFT.sol";
import "./LGPSYToken.sol";

/** 

 @title  REIT contract
 @author Gypsy.City
 @notice This contract is used by Gypsy to remain compliant with REIT laws.
 @notice SEC File: https://www.sec.gov/files/reits.pdf

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

contract REIT  {
	address public admin;

	//REIT connections
	address public stablecoin; //the way renters pay for the rent
	address public reit_share; //the share of the REIT. 
	address public reit_share_vault; //Pays dividends in new shares of the REIT. Pays 90% of profit
	address public reit_operations_wallet; //The REIT operating wallet (Buys, upgrades, and maintains properties)
	address public reit_profits_wallet; //The REIT wallet for profit. This is the 10% profit that a REIT can keep.
	address public reit_homes_nft; //The NFT collection that has all the homes

	//REIT connection contracts;
	TestGPSY private gypsy_token; 
	USDGToken private usdg_token; 
  	HomeNFT private home_nft;
	LGPSYToken private lgpsy_token;

	//REIT Financials
	uint256 public revenue;
	uint256 public operating_expense;
	uint256 public nav;

	//Balance sheet
	uint256 public cash_and_short_term_investments;
	uint256 public total_assets;
	uint256 public total_liabilities;
	uint256 public total_equity;

	//Cashflow
	uint256 public net_income;
	uint256 public cash_from_operations;
	uint256 public cash_from_investing;
	uint256 public cash_from_financing;
	uint256 public net_change_in_cash;
	uint256 public free_cash_flow;

    constructor(address _stablecoin, address _reit_share, address _reit_share_vault, address _reit_homes_nft, address _reit_operations_wallet, address _reit_profits_wallet) {
        //set all contracts
		stablecoin = _stablecoin;
		reit_share = _reit_share;
		reit_share_vault = _reit_share_vault;
		reit_operations_wallet = _reit_operations_wallet;
		reit_profits_wallet = _reit_profits_wallet;
		reit_homes_nft =_reit_homes_nft;

		//make contract objects
		gypsy_token = TestGPSY(_reit_share); 
		usdg_token = USDGToken(_stablecoin); 
		home_nft = HomeNFT(_reit_homes_nft);
		lgpsy_token = LGPSYToken(_reit_share_vault);

		//set admin
		admin = msg.sender;
    }

    /// @notice Chooses to buy or mint GPSY based on price
	/// @dev Called by investors
	function invest() public{

		//gets on-chain price
		//gets backing per GPSY

		//if onChainPrice > backing
		//Mint new GPSY @ backing
		//else
		//buy on-chain
	}

    /// @notice Distributes profits to staked investors and gypsy
	/// @dev Called by Gypsy
	function sendDividend()public{
		
	}
   
    /// @notice gets the value of the home
	function getNAV()public{
		
	}
}
