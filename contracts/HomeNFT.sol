// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
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

contract HomeNFT is ERC721, ERC721Enumerable, ERC721URIStorage, ERC721Burnable, Ownable {
	using Counters for Counters.Counter;
 	Counters.Counter private _tokenIds; //counter of how many homes were minted from the contract
    address public admin; //the address that is able to add homes to the portfolio
    TestGPSY private gypsy_token; // the Gypsy Token Contract
	USDGToken private usdg_token; // the USDG Token Contract
	REIT private reit; // the REIT  Contract
	
	uint256 public RENT_CYCLE = 2592000; //the default rent cycle, how often rent needs to be paid to occupy the property in seconds. 2592000 is 30 days. 86400 is 1 day.

    mapping(uint256 => bool) isOccupied; //find if a house is occupied
	mapping(uint256 => address) renter; //if the home is occupied then it is being rented. The renter pays the owner of the NFT for renting.
	mapping(uint256 => uint256) started_renting_on; //the timestamp of the property being booked by the new renter
	mapping(uint256 => uint256) last_rent_payment; //the timestamp of the last rental payment to the property
	mapping(uint256 => uint256) lease_ends; //the timestamp of when the renter is done renting
	mapping(uint256 => uint256) rent_price; //the rent price of each home
	mapping(uint256 => uint256) price; //the price of each home (estimated by Parcl Price feeds)
	mapping(uint256 => uint256) appraisal_price; //the price determined by appraisals
	mapping(uint256 => uint256) purchase_price; //the price of the home by Gypsy
	mapping(uint256 => mapping(string => uint256)) recurring_maintance_costs; //the recurring monthly costs for a property (mortgage payment, insurance, taxes, HOA dues)
	//---->home------->mortgage------>$
	//           |---->insurance----->$
	
    /*////////////////////////////////////////////////////////
                      		Events
    ////////////////////////////////////////////////////////*/

    event PayedRent(address indexed renter, address indexed owner, uint256 indexed homeId, uint256 rent_price);
	event RentUpdated(uint256 indexed homeId, uint256 old_rent_price, uint256 new_rent_price, address indexed owner);
	event NewRenter(uint256 indexed homeId, address indexed renter, uint256 timeStamp );
	event AppraisalUpdated(uint256 indexed homeId, uint256 old_appraisal_price, uint256 new_appraisal_price, address indexed owner);
	event NewProperty(uint256 indexed homeId, address owner, string tokenURI, uint256 rent_price, uint256 purchase_price, uint256 timeStamp);
	event LeaseEnds(uint256 indexed homeId, address indexed renter, uint256 timeStamp );

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
            	 ERC721 Open Zeppelin overrides
    ////////////////////////////////////////////////////////*/

    function _beforeTokenTransfer(address from, address to, uint256 tokenId, uint256 batchSize)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
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
        _safeMint(_owner, newHomeId);
        _setTokenURI(newHomeId, tokenURI);
        //set the house as unoccupied
        isOccupied[newHomeId] = false;
		//set the rent price of the property
		rent_price[newHomeId] = _rent_price;
		//set the purchase price of the property
		purchase_price[newHomeId] = _purchase_price;
		//set the appraisal price to the purchase price
		appraisal_price[newHomeId] = _purchase_price;

		emit NewProperty(newHomeId, _owner,tokenURI, _rent_price,  _purchase_price,  block.timestamp);
     
        return 0;
    }

	function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }


    /*////////////////////////////////////////////////////////
                      Rent Payment Logic
    ////////////////////////////////////////////////////////*/

	//Pays rent to the owner of the home NFT in USDG
	function payRent(uint256 homeID)
        public
        returns(bool)
    {
		//allows anyone to rent an unoccupied house but if a house is occupied only that current renter can pay
		require(isOccupied[homeID] == false || renter[homeID] == msg.sender, "The property is currently occupied");
		//get rent amount
		uint256 _rent_amount = rent_price[homeID];
		address owner_of = ownerOf(homeID);
		//make sure the person is able to pay for the rent
		uint256 allowance = usdg_token.allowance(msg.sender, address(this));
		require(_rent_amount == allowance, "Please approve tokens before transferring");
		//Transfer funds
		usdg_token.transferFrom(msg.sender,owner_of, _rent_amount);
		//Updates the property settings
		bool hasRenter = isOccupied[homeID];
		if(hasRenter){
			//last rent payment time
			last_rent_payment[homeID] = block.timestamp;
			//update stay length
			uint256 lease_ends_timestamp = lease_ends[homeID]+ RENT_CYCLE; //rent is over after the current time + the rent cycle (30 days)
			lease_ends[homeID] = lease_ends_timestamp;
		}
		else{
			renter[homeID] = msg.sender;
			started_renting_on[homeID] = block.timestamp;
			last_rent_payment[homeID] = block.timestamp;
        	isOccupied[homeID] = true;
			//figure out when the lease ends
			uint256 lease_ends_timestamp = block.timestamp + RENT_CYCLE; //rent is over after the current time + the rent cycle (30 days)
			lease_ends[homeID] = lease_ends_timestamp;
			emit NewRenter(homeID, msg.sender,block.timestamp);
		}

		emit PayedRent(msg.sender, owner_of, homeID, _rent_amount);

		return true;
    }


	/*////////////////////////////////////////////////////////
                      		MAIN
    ////////////////////////////////////////////////////////*/

	//This function is called in reoccuring times by the chainlink upkeep
	//This should be called daily
	//https://docs.chain.link/chainlink-automation/job-scheduler/

	function main()
        public 
        returns (bool)
    {
		//check all homes and update if the leases end
		uint256 homeCount = count();
		for(uint256 i = 1; i<=homeCount;i++){
			//the home lease ends
			if(block.timestamp > lease_ends[i]){
				address old_renter = renter[i];
				renter[i] = 0x0000000000000000000000000000000000000000;
				started_renting_on[i] = 0;
				last_rent_payment[i] = 0;
				lease_ends[i] = 0;
				isOccupied[i] = false;
				
				emit LeaseEnds(i, old_renter, block.timestamp);
			}
		}
        return true;
    }


	/*////////////////////////////////////////////////////////
                      	Finacials
    ////////////////////////////////////////////////////////*/

  	function occupancyRate()
        public 
        returns (uint256)
    {
        return 1;
    }

	function netOperatingIncome(uint256 homeID)
        public 
        returns (uint256)
    {
        return 1;
    }

	function operatingExpenses(uint256 homeID)
        public 
        returns (uint256)
    {
        return 1;
    }

	function capRate(uint256 homeID)
        public 
        returns (uint256)
    {
        return 1;
    }

	//Vacancy Rate = Number of Days Vacant / 365 Days per Year
	function vacancyRate(uint256 homeID)
        public 
        returns (uint256)
    {
        return 1;
    }

	function depreciation(uint256 homeID)
        public 
        returns (uint256)
    {
        return 1;
    }

	function irr(uint256 homeID)
        public 
        returns (uint256)
    {
        return 1;
    }

	function coc(uint256 homeID)
        public 
        returns (uint256)
    {
        return 1;
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

	//gets if the Home is occupied
	function getOccupied(uint256 homeID) public view returns(bool){
		return isOccupied[homeID];
	}

	//gets the renter of the home
	function getRenter(uint256 homeID) public view returns(address){
		return renter[homeID];
	}

	//gets when the current renter first started renting the property
	function getStartedRentingOn(uint256 homeID) public view returns(uint256){
		return started_renting_on[homeID];
	}

	//gets when the property last recieved a payment
	function getLastRentPayment(uint256 homeID) public view returns(uint256){
		return last_rent_payment[homeID];
	}

	//gets when the property's current renter's lease is done
	function getLeaseEnds(uint256 homeID) public view returns(uint256){
		return lease_ends[homeID];
	}

	//gets when the property last recieved a payment
	function getRentCycle() public view returns(uint256){
		return RENT_CYCLE;
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

		emit RentUpdated(homeID, old_rent_price, new_rent_price, msg.sender);
    }

	//Sets a new Apprasial price for a home
	function setAppraisalPrice(uint256 homeID, uint256 new_apprasial_price)
        public 
    {
		uint256 old_appraisal_price = appraisal_price[homeID];
		appraisal_price[homeID] = new_apprasial_price;
	
		emit  AppraisalUpdated( homeID, old_appraisal_price, new_apprasial_price, msg.sender);
    }

	function setReit(address _reit_contract) public{
		reit = REIT(_reit_contract);
	}

	function setRentCycle(uint256 new_rent_cycle) public{
		RENT_CYCLE = new_rent_cycle;
	}


	
}