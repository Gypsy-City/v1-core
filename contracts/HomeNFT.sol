// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "./TestGPSY.sol";
import "./USDGToken.sol";
import "./REIT.sol";

/** 
 @title  Gypsy Portfolio NFT collection
 @notice This contract allows users to pay rent in USDG and buy and sell homes on-chain. 
         It is fully compatible with [ERC721](https://eips.ethereum.org/EIPS/eip-721) allowing the homes to be traded on NFT marketplaces.
		 A home NFT can be burned and exchanged for the transfer of the SPV that owns the title to the home.
		 This contract also mints & burns GPSY tokens that are backed by the homes values.
*/

contract HomeNFT is ERC721URIStorage {
	using Counters for Counters.Counter;
 	Counters.Counter private _tokenIds; //counter of how many homes were minted from the contract
    address public admin; //the address that is able to add homes to the portfolio
    TestGPSY private gypsy_token; // the Gypsy Token Contract
	USDGToken private usdg_token; // the USDG Token Contract
	REIT private reit; // the REIT  Contract
	
    mapping(uint256 => bool) isOccupied; //find if a house is occupied
	mapping(uint256 => address) renter; //if the home is occupied then it is being rented. The renter pays the owner of the NFT for renting.
	mapping(uint256 => uint256) rent_price; //the rent price of each home
	mapping(uint256 => uint256) price; //the price of each home (estimated by Parcl Price feeds)
	mapping(uint256 => uint256) appraisal_price; //the price determined by appraisals
	mapping(uint256 => uint256) purchase_price; //the price of the home by Gypsy
	
    /*////////////////////////////////////////////////////////
                      		Events
    ////////////////////////////////////////////////////////*/

    event PayedRent(address indexed renter, address indexed owner, uint256 indexed homeId, uint256 rent_price);
	event RentChanged(uint256 indexed homeId, uint256 old_rent_price,uint256 new_rent_price, address indexed owner);
	event AppraisalChanged(uint256 indexed homeId, uint256 old_appraisal_price,uint256 new_appraisal_price, address indexed owner);

    constructor(address _gypsy_token_contract, address _usdg_token_contract) ERC721("Gypsy Porfolio", "HOME") {
        admin = msg.sender;
        gypsy_token = TestGPSY(_gypsy_token_contract);
		usdg_token = USDGToken(_usdg_token_contract);
    } 

    function count() public view returns (uint256) {
        uint256 newHomeId = _tokenIds.current();
        return newHomeId;
    }

    /*////////////////////////////////////////////////////////
            	 Adding/Removing Homes Logic
    ////////////////////////////////////////////////////////*/
    function mint(address _owner, string memory tokenURI, uint256 _rent_price, uint256 _purchase_price )
        public
        returns (uint256)
    {
	
		//Mint the home
        _tokenIds.increment();

        uint256 newHomeId = _tokenIds.current();
        _mint(_owner, newHomeId);
        _setTokenURI(newHomeId, tokenURI);
        //set the house as unoccupied
        isOccupied[newHomeId] = false;
		//set the rent price of the property
		rent_price[newHomeId] = _rent_price;
		//set the purchase price of the property
		purchase_price[newHomeId] = _purchase_price;
		//set the appraisal price to the purchase price
		appraisal_price[newHomeId] = _purchase_price;
     
        return 0;
    }


    /*////////////////////////////////////////////////////////
                      Rent Payment Logic
    ////////////////////////////////////////////////////////*/

	//Pays rent to the owner of the home NFT in USDG
	function payRent(uint256 homeID)
        public
        returns(bool)
    {
		//get rent amount
		uint256 _rent_amount = rent_price[homeID];
		address owner_of = ownerOf(homeID);
		//make sure the person is able to pay for the rent
		uint256 allowance = usdg_token.allowance(msg.sender, address(this));
		require(_rent_amount == allowance, "Please approve tokens before transferring");
		usdg_token.transferFrom(msg.sender,owner_of, _rent_amount);

		emit PayedRent(msg.sender, owner_of, homeID, _rent_amount);

		return true;
    }
	
	/*////////////////////////////////////////////////////////
                      Getters
    ////////////////////////////////////////////////////////*/

	//Gets the rent price for a home
  	function getRent(uint256 homeID)
        public view
        returns (uint256)
    {
        return rent_price[homeID];
    }

	//Gets the purchase price for a home
	function getPurchasePrice(uint256 homeID)
        public view
        returns (uint256)
    {
        return purchase_price[homeID];
    }

	//Gets the appraisal price for a home
	function getAppraisalPrice(uint256 homeID)
        public view
        returns (uint256)
    {
        return appraisal_price[homeID];
    }

	//gets the REIT that owns the NFT collection
	function getReit() public view returns(address){
		return address(reit);
	}

	/*////////////////////////////////////////////////////////
                      Setters
    ////////////////////////////////////////////////////////*/

	//Sets a new rent price for a home
	function setRent(uint256 homeID, uint256 new_rent_price)
        public 
    {
		uint256 old_rent_price = rent_price[homeID];
		rent_price[homeID] = new_rent_price;

		emit RentChanged(homeID, old_rent_price, new_rent_price, msg.sender);
    }

	//Sets a new Apprasial price for a home
	function setAppraisalPrice(uint256 homeID, uint256 new_apprasial_price)
        public 
    {
		uint256 old_appraisal_price = appraisal_price[homeID];
		appraisal_price[homeID] = new_apprasial_price;
	
		emit  AppraisalChanged( homeID, old_appraisal_price, new_apprasial_price, msg.sender);
    }

	function setReit(address _reit_contract) public{
		reit = REIT(_reit_contract);
	}
	
   	//====================
	//safe math
	//====================
	function multiply(uint256 x, uint256 y) internal pure returns (uint256 z) {
        require(y == 0 || (z = x * y) / y == x);
    }

}