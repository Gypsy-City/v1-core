const { expect, assert } = require("chai");
const {
  BN,
  expectEvent,
  expectRevert,
  time,
} = require("@openzeppelin/test-helpers");
const { getCurrentTimestamp } = require("./helpers/time");
const { upkeepSimulateDays } = require("./helpers/chainlinkUpkeep");
//Contracts
const HomeNFT = artifacts.require("HomeNFT");
const TestGPSY = artifacts.require("TestGPSY");
const USDGToken = artifacts.require("USDGToken");
const REIT = artifacts.require("REIT");
const LGPSYToken = artifacts.require("LGPSYToken");

contract("HomeNFT", async (accounts) => {
  const INITIAL_SUPPLY = "0";
  const HOME_PURCHASE_PRICE = 1000000;
  const RENT_PRICE = 6000;
  const RENT_CYCLE = 2592000;
  const RENT_CYCLES_DAYS = RENT_CYCLE / (24 * 60 * 60);
  const HOME_DATA_URI =
    "https://bafybeievyhunzymva6pjfgnjuwsobhxxp3pb6fonxryn5wuvh65h7lthxe.ipfs.w3s.link/data.json";

  let homeNft,
    gpsyToken,
    currentOwner,
    renter,
    renter_two,
    investor,
    operations_wallet,
    profit_wallet,
    minter;

  before(() => {
    currentOwner = accounts[0];
    renter = accounts[1];
    investor = accounts[2];
    operations_wallet = accounts[3];
    profit_wallet = accounts[4];
    renter_two = accounts[5];
  });

  beforeEach(async function () {
    gasAverage = await fetch("https://ethgasstation.info/json/ethgasAPI.json")
      .then((resp) => resp.json())
      .then((data) => data.average);

    gpsyToken = await TestGPSY.new();
    usdgToken = await USDGToken.new();
    homeNft = await HomeNFT.new(gpsyToken.address, usdgToken.address);

    lgpsyToken = await LGPSYToken.new(
      "Staked GPSY",
      "LGPSY",
      currentOwner,
      gpsyToken.address,
      2
    );

    reit = await REIT.new(
      usdgToken.address,
      gpsyToken.address,
      lgpsyToken.address,
      homeNft.address,
      operations_wallet,
      profit_wallet
    );

    await homeNft.setReit(reit.address);
  });

  describe("constructor", async () => {
    it("initialized the gpsytoken contract", async () => {
      let supply = await gpsyToken.totalSupply();
      // gpsytoken contract init
      expect(supply.toString()).to.equal(INITIAL_SUPPLY);

      const transactionHash = gpsyToken.transactionHash;

      const transactionReceipt =
        web3.eth.getTransactionReceipt(transactionHash);
      const blockNumber = transactionReceipt.blockNumber;

      const eventList = await gpsyToken.getPastEvents("allEvents", {
        fromBlock: blockNumber,
        toBlock: blockNumber,
      });
      const events = eventList.filter(
        (ev) => ev.transactionHash === transactionHash
      );
      expect(events.length).to.equal(0);
    });

    it("initialized the usdgtoken contract", async () => {
      let supply = await usdgToken.totalSupply();
      // gpsytoken contract init
      expect(supply.toString()).to.equal(INITIAL_SUPPLY);

      const transactionHash = usdgToken.transactionHash;

      const transactionReceipt =
        web3.eth.getTransactionReceipt(transactionHash);
      const blockNumber = transactionReceipt.blockNumber;

      const eventList = await usdgToken.getPastEvents("allEvents", {
        fromBlock: blockNumber,
        toBlock: blockNumber,
      });
      const events = eventList.filter(
        (ev) => ev.transactionHash === transactionHash
      );
      expect(events.length).to.equal(0);
    });

    it("initialized the home nft contract", async () => {
      const transactionHash = homeNft.transactionHash;

      const transactionReceipt =
        web3.eth.getTransactionReceipt(transactionHash);
      const blockNumber = transactionReceipt.blockNumber;

      const eventList = await homeNft.getPastEvents("allEvents", {
        fromBlock: blockNumber,
        toBlock: blockNumber,
      });
      const events = eventList.filter(
        (ev) => ev.transactionHash === transactionHash
      );
      expect(events.length).to.equal(0);
    });

    it("initialized the REIT connection", async () => {
      let get_reit_address = await homeNft.getReit();
      expect(get_reit_address).to.equal(reit.address);
    });
  });

  describe("adding / removing a home to the portfolio", async () => {
    it("home can be minted to the portfolio", async () => {
      const tx = await homeNft.mint(
        currentOwner,
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_PURCHASE_PRICE,
        { from: currentOwner, gas: 5000000, gasPrice: 500000000 }
      );
      let count = await homeNft.count();

      const value = new BN(1);

      expect(count).to.be.bignumber.equal(value);
    });

    it("home can be minted to the portfolio with the correct URI", async () => {
      await homeNft.mint(
        currentOwner,
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_PURCHASE_PRICE,
        { from: currentOwner, gas: 5000000, gasPrice: 500000000 }
      );

      let uri = await homeNft.tokenURI(1);
      expect(uri).to.be.deep.equal(HOME_DATA_URI);
    });

    it("home can be burned from the portfolio", async () => {
      await homeNft.mint(
        currentOwner,
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_PURCHASE_PRICE,
        { from: currentOwner, gas: 5000000, gasPrice: 500000000 }
      );

      let uri = await homeNft.tokenURI(1);

      await homeNft.burn(1, {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await expectRevert(homeNft.tokenURI(1), "ERC721: invalid token ID");
    });

    it("multiple homes are mintable to the portfolio", async () => {
      await homeNft.mint(
        currentOwner,
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_PURCHASE_PRICE,
        { from: currentOwner, gas: 5000000, gasPrice: 500000000 }
      );

      await homeNft.mint(
        currentOwner,
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_PURCHASE_PRICE,
        { from: currentOwner, gas: 5000000, gasPrice: 500000000 }
      );

      await homeNft.mint(
        currentOwner,
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_PURCHASE_PRICE,
        { from: currentOwner, gas: 5000000, gasPrice: 500000000 }
      );
      let count = await homeNft.count();

      const value = new BN(3);

      expect(count).to.be.bignumber.equal(value);
    });

    it("minted home has the correct rent price", async () => {
      const tx = await homeNft.mint(
        currentOwner,
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_PURCHASE_PRICE,
        { from: currentOwner, gas: 5000000, gasPrice: 500000000 }
      );

      let home_rent_price = await homeNft.getRent(1);

      const bn_expected_value = new BN(RENT_PRICE);
      const bn_home_rent_price_to_number = new BN(home_rent_price);

      expect(bn_home_rent_price_to_number).to.be.bignumber.equal(
        bn_expected_value
      );
    });

    it("minted home has the correct purchase price", async () => {
      const tx = await homeNft.mint(
        currentOwner,
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_PURCHASE_PRICE,
        { from: currentOwner, gas: 5000000, gasPrice: 500000000 }
      );

      let home_purchase_price = await homeNft.getPurchasePrice(1);

      const bn_expected_value = new BN(HOME_PURCHASE_PRICE);
      const bn_home_purchase_price_to_number = new BN(home_purchase_price);

      expect(bn_home_purchase_price_to_number).to.be.bignumber.equal(
        bn_expected_value
      );
    });

    it("minted home has the correct appraisal price", async () => {
      const tx = await homeNft.mint(
        currentOwner,
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_PURCHASE_PRICE,
        { from: currentOwner, gas: 5000000, gasPrice: 500000000 }
      );

      let home_appraisal_price = await homeNft.getAppraisalPrice(1);

      const bn_expected_value = new BN(HOME_PURCHASE_PRICE);
      const bn_home_appraisal_price_to_number = new BN(home_appraisal_price);

      expect(bn_home_appraisal_price_to_number).to.be.bignumber.equal(
        bn_expected_value
      );
    });
  });

  describe("setters", async () => {
    it("owner can set new home rent", async () => {
      await homeNft.mint(
        currentOwner,
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_PURCHASE_PRICE,
        { from: currentOwner, gas: 5000000, gasPrice: 500000000 }
      );

      const NEW_RENT_PRICE = 8000;

      let tx = await homeNft.setRent(1, NEW_RENT_PRICE);
      let new_rent_price = await homeNft.getRent(1);

      const bn_expected_value = new BN(NEW_RENT_PRICE);
      const bn_new_rent_price_to_number = new BN(new_rent_price);

      expect(bn_new_rent_price_to_number).to.be.bignumber.equal(
        bn_expected_value
      );
    });
    it("owner can set new home apprasial price", async () => {
      await homeNft.mint(
        currentOwner,
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_PURCHASE_PRICE,
        { from: currentOwner, gas: 5000000, gasPrice: 500000000 }
      );

      const NEW_APPRASIAL_PRICE = 2000000;

      let tx = await homeNft.setAppraisalPrice(1, NEW_APPRASIAL_PRICE);
      let new_apprasial_price = await homeNft.getAppraisalPrice(1);

      const bn_expected_value = new BN(NEW_APPRASIAL_PRICE);
      const bn_new_apprasial_price_to_number = new BN(new_apprasial_price);

      expect(bn_new_apprasial_price_to_number).to.be.bignumber.equal(
        bn_expected_value
      );
    });

    it("owner can set new rent cycle", async () => {
      const NEW_RENT_CYCLE = 86400; //one day

      //set the new rent cycle
      await homeNft.setRentCycle(NEW_RENT_CYCLE);

      //get the set rent cycle
      const current_rent_cycle = await homeNft.getRentCycle();

      expect(current_rent_cycle).to.be.bignumber.equal(new BN(NEW_RENT_CYCLE));
    });
  });

  describe("getters", async () => {
    it("gets apprasial price", async () => {
      await homeNft.mint(
        currentOwner,
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_PURCHASE_PRICE,
        { from: currentOwner, gas: 5000000, gasPrice: 500000000 }
      );

      let current_value = await homeNft.getAppraisalPrice(1);
      expect(current_value).to.be.bignumber.equal(new BN(HOME_PURCHASE_PRICE));
    });

    it("gets purchase price", async () => {
      await homeNft.mint(
        currentOwner,
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_PURCHASE_PRICE,
        { from: currentOwner, gas: 5000000, gasPrice: 500000000 }
      );

      let current_value = await homeNft.getPurchasePrice(1);
      expect(current_value).to.be.bignumber.equal(new BN(HOME_PURCHASE_PRICE));
    });

    it("gets reit address", async () => {
      let current_value = await homeNft.getReit();
      expect(current_value).to.be.equal(reit.address);
    });

    it("gets rent price", async () => {
      await homeNft.mint(
        currentOwner,
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_PURCHASE_PRICE,
        { from: currentOwner, gas: 5000000, gasPrice: 500000000 }
      );
      let current_value = await homeNft.getRent(1);
      expect(current_value).to.be.equal(RENT_PRICE);
    });

    it("gets renter address when theres a resident renting the property", async () => {
      await homeNft.mint(
        currentOwner,
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_PURCHASE_PRICE,
        { from: currentOwner, gas: 5000000, gasPrice: 500000000 }
      );

      //gives the renter the rent money
      await usdgToken.mint(renter, RENT_PRICE, {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.approve(homeNft.address, RENT_PRICE, {
        from: renter,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.allowance(renter, homeNft.address, {
        from: renter,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //rent the house
      await homeNft.payRent(1, {
        from: renter,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //check the get method
      let renter_address = await homeNft.getRenter(1, {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      expect(renter_address).to.be.equal(renter);
    });

    it("gets when the new renter first started renting the property", async () => {
      await homeNft.mint(
        currentOwner,
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_PURCHASE_PRICE,
        { from: currentOwner, gas: 5000000, gasPrice: 500000000 }
      );

      //gives the renter the rent money
      await usdgToken.mint(renter, RENT_PRICE, {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.approve(homeNft.address, RENT_PRICE, {
        from: renter,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.allowance(renter, homeNft.address, {
        from: renter,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //rent the house
      await homeNft.payRent(1, {
        from: renter,
        gas: 5000000,
        gasPrice: 500000000,
      });

      const current_timestamp = await homeNft.getStartedRentingOn(1);
      const expected_timestamp = await getCurrentTimestamp();

      expect(current_timestamp).to.be.equal(expected_timestamp);
    });

    it("gets the last rental payment for a property", async () => {
      await homeNft.mint(
        currentOwner,
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_PURCHASE_PRICE,
        { from: currentOwner, gas: 5000000, gasPrice: 500000000 }
      );

      //gives the renter the rent money
      await usdgToken.mint(renter, RENT_PRICE, {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.approve(homeNft.address, RENT_PRICE, {
        from: renter,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.allowance(renter, homeNft.address, {
        from: renter,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //rent the house
      await homeNft.payRent(1, {
        from: renter,
        gas: 5000000,
        gasPrice: 500000000,
      });

      const current_timestamp = await homeNft.getLastRentPayment(1);
      const expected_timestamp = await getCurrentTimestamp();

      expect(current_timestamp).to.be.equal(expected_timestamp);

      //let some time pass
      await time.increase(time.duration.weeks(2));

      //gives the renter the rent money
      await usdgToken.mint(renter, RENT_PRICE, {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.approve(homeNft.address, RENT_PRICE, {
        from: renter,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.allowance(renter, homeNft.address, {
        from: renter,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //rent the house again
      await homeNft.payRent(1, {
        from: renter,
        gas: 5000000,
        gasPrice: 500000000,
      });

      const new_current_timestamp = await homeNft.getLastRentPayment(1);
      const new_expected_timestamp = await getCurrentTimestamp();

      expect(new_current_timestamp).to.be.equal(new_expected_timestamp);

      //time should have passed since the first payment
      expect(new_current_timestamp).to.be.gt(current_timestamp);
    });

    it("gets the lease expiration timestamp", async () => {
      await homeNft.mint(
        currentOwner,
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_PURCHASE_PRICE,
        { from: currentOwner, gas: 5000000, gasPrice: 500000000 }
      );

      //gives the renter the rent money
      await usdgToken.mint(renter, RENT_PRICE, {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.approve(homeNft.address, RENT_PRICE, {
        from: renter,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.allowance(renter, homeNft.address, {
        from: renter,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //rent the house
      await homeNft.payRent(1, {
        from: renter,
        gas: 5000000,
        gasPrice: 500000000,
      });

      const current_timestamp = await homeNft.getLeaseEnds(1);
      let expected_timestamp = (await getCurrentTimestamp()) + RENT_CYCLE;

      expect(current_timestamp).to.be.equal(new BN(expected_timestamp));
    });

    it("gets rent cycle", async () => {
      const current_rent_cycle = await homeNft.getRentCycle();
      const expected_rent_cycle = 2592000;
      expect(current_rent_cycle).to.be.bignumber.equal(
        new BN(expected_rent_cycle)
      );
    });
  });

  describe("Renter can send payment", async () => {
    it("renter is able to pay rent", async () => {
      await homeNft.mint(
        currentOwner,
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_PURCHASE_PRICE,
        { from: currentOwner, gas: 5000000, gasPrice: 500000000 }
      );

      //gives the renter the rent money
      await usdgToken.mint(renter, RENT_PRICE, {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.approve(homeNft.address, RENT_PRICE, {
        from: renter,
        gas: 5000000,
        gasPrice: 500000000,
      });

      const allowance_amount = await usdgToken.allowance(
        renter,
        homeNft.address,
        {
          from: renter,
          gas: 5000000,
          gasPrice: 500000000,
        }
      );

      expect(new BN(RENT_PRICE)).to.be.bignumber.equal(allowance_amount);

      //rent the house
      const tx = await homeNft.payRent(1, {
        from: renter,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //check that the funds were actually sent
      const balance_of_renter = await usdgToken.balanceOf(renter);

      //owner of the house recieved the rent payment
      expect(balance_of_renter).to.be.bignumber.equal(new BN(0));
    });

    it("renter can extend stay by paying more rent", async () => {
      await homeNft.mint(
        currentOwner,
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_PURCHASE_PRICE,
        { from: currentOwner, gas: 5000000, gasPrice: 500000000 }
      );

      //gives the renter the rent money
      await usdgToken.mint(renter, RENT_PRICE, {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.approve(homeNft.address, RENT_PRICE, {
        from: renter,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.allowance(renter, homeNft.address, {
        from: renter,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //rent the house
      await homeNft.payRent(1, {
        from: renter,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //give the renter more rent money and rent again
      await usdgToken.mint(renter, RENT_PRICE, {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.approve(homeNft.address, RENT_PRICE, {
        from: renter,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.allowance(renter, homeNft.address, {
        from: renter,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //rent the house
      await homeNft.payRent(1, {
        from: renter,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //the expected lease end day should be 2 of the rent cycle
      const current_lease_end = await homeNft.getLeaseEnds(1);
      const current_time = await getCurrentTimestamp();
      const expected_lease_end = RENT_CYCLE * 2 + current_time;

      //is approximetly instead of equals because test shows 3 seconds off
      //calculation must be within 10 seconds accurate
      expect(current_lease_end).to.be.bignumber.approximately(
        new BN(expected_lease_end),
        new BN(10)
      );
    });

    it("renter sets the home as occupied", async () => {
      await homeNft.mint(
        currentOwner,
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_PURCHASE_PRICE,
        { from: currentOwner, gas: 5000000, gasPrice: 500000000 }
      );

      //gives the renter the rent money
      await usdgToken.mint(renter, RENT_PRICE, {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.approve(homeNft.address, RENT_PRICE, {
        from: renter,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.allowance(renter, homeNft.address, {
        from: renter,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //rent the house
      await homeNft.payRent(1, {
        from: renter,
        gas: 5000000,
        gasPrice: 500000000,
      });

      const isOccupied = await homeNft.getOccupied(1);
      expect(isOccupied).to.be.equal(true);
    });

    it("renter updates the address of who is renting the home", async () => {
      await homeNft.mint(
        currentOwner,
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_PURCHASE_PRICE,
        { from: currentOwner, gas: 5000000, gasPrice: 500000000 }
      );

      //gives the renter the rent money
      await usdgToken.mint(renter, RENT_PRICE, {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.approve(homeNft.address, RENT_PRICE, {
        from: renter,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.allowance(renter, homeNft.address, {
        from: renter,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //rent the house
      await homeNft.payRent(1, {
        from: renter,
        gas: 5000000,
        gasPrice: 500000000,
      });

      const renter_address = await homeNft.getRenter(1);
      expect(renter_address).to.be.equal(renter);
    });

    it("renter cannot rent an occupied property", async () => {
      await homeNft.mint(
        currentOwner,
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_PURCHASE_PRICE,
        { from: currentOwner, gas: 5000000, gasPrice: 500000000 }
      );

      //gives the renter the rent money
      await usdgToken.mint(renter, RENT_PRICE, {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.approve(homeNft.address, RENT_PRICE, {
        from: renter,
        gas: 5000000,
        gasPrice: 500000000,
      });

      const allowance_amount = await usdgToken.allowance(
        renter,
        homeNft.address,
        {
          from: renter,
          gas: 5000000,
          gasPrice: 500000000,
        }
      );

      //rent the house
      const tx = await homeNft.payRent(1, {
        from: renter,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //checks if its set to occupied
      const isOccupied = await homeNft.getOccupied(1);
      expect(isOccupied).to.be.equal(true);

      //gives renter_two money to rent
      await usdgToken.mint(renter_two, RENT_PRICE, {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.approve(homeNft.address, RENT_PRICE, {
        from: renter_two,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.allowance(renter_two, homeNft.address, {
        from: renter,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await expectRevert(
        homeNft.payRent(1, {
          from: renter_two,
          gas: 5000000,
          gasPrice: 500000000,
        }),
        "The property is currently occupied"
      );
    });

    it("renter can pay rent while occupying the property", async () => {
      //give the renter money
      await homeNft.mint(
        currentOwner,
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_PURCHASE_PRICE,
        { from: currentOwner, gas: 5000000, gasPrice: 500000000 }
      );

      //gives the renter the rent money
      await usdgToken.mint(renter, RENT_PRICE, {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.approve(homeNft.address, RENT_PRICE, {
        from: renter,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.allowance(renter, homeNft.address, {
        from: renter,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //rent the house
      await homeNft.payRent(1, {
        from: renter,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //give the renter more money
      await homeNft.mint(
        currentOwner,
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_PURCHASE_PRICE,
        { from: currentOwner, gas: 5000000, gasPrice: 500000000 }
      );

      //gives the renter the rent money
      await usdgToken.mint(renter, RENT_PRICE, {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.approve(homeNft.address, RENT_PRICE, {
        from: renter,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.allowance(renter, homeNft.address, {
        from: renter,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //rent the house again should work
      const tx = await homeNft.payRent(1, {
        from: renter,
        gas: 5000000,
        gasPrice: 500000000,
      });
    });

    it("home NFT owner recieves rent payment", async () => {
      await homeNft.mint(
        currentOwner,
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_PURCHASE_PRICE,
        { from: currentOwner, gas: 5000000, gasPrice: 500000000 }
      );

      //gives the renter the rent money
      await usdgToken.mint(renter, RENT_PRICE, {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.approve(homeNft.address, RENT_PRICE, {
        from: renter,
        gas: 5000000,
        gasPrice: 500000000,
      });

      const allowance_amount = await usdgToken.allowance(
        renter,
        homeNft.address,
        {
          from: renter,
          gas: 5000000,
          gasPrice: 500000000,
        }
      );

      expect(new BN(RENT_PRICE)).to.be.bignumber.equal(allowance_amount);

      //rent the house
      const tx = await homeNft.payRent(1, {
        from: renter,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //check that the funds were actually sent (Sends to the REIT contract)
      const balance_of_owner = await usdgToken.balanceOf(currentOwner);

      //owner of the house recieved the rent payment
      expect(balance_of_owner).to.be.bignumber.equal(new BN(RENT_PRICE));
    });
  });

  describe("Main", async () => {
    it("Renter no longer occupies the property after rent cycle", async () => {
      await homeNft.mint(
        currentOwner,
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_PURCHASE_PRICE,
        { from: currentOwner, gas: 5000000, gasPrice: 500000000 }
      );

      //gives the renter the rent money
      await usdgToken.mint(renter, RENT_PRICE, {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.approve(homeNft.address, RENT_PRICE, {
        from: renter,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.allowance(renter, homeNft.address, {
        from: renter,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //rent the house
      await homeNft.payRent(1, {
        from: renter,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //check if the renter is still occupying the property
      const before_occupy = await homeNft.getOccupied(1);
      expect(before_occupy).to.be.equal(true);

      //now wait until the rent cycle and then see if the renter is still occupying the property
      //Adds one second to the time to verify the last time has passed
      await upkeepSimulateDays(RENT_CYCLES_DAYS + 1, homeNft, currentOwner);

      //check if the renter is still occupying the property
      const current_occupancy = await homeNft.getOccupied(1);
      expect(current_occupancy).to.be.equal(false);
    });

    it("When the lease ends the home's values get reset for the next renter", async () => {
      await homeNft.mint(
        currentOwner,
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_PURCHASE_PRICE,
        { from: currentOwner, gas: 5000000, gasPrice: 500000000 }
      );

      //gives the renter the rent money
      await usdgToken.mint(renter, RENT_PRICE, {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.approve(homeNft.address, RENT_PRICE, {
        from: renter,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.allowance(renter, homeNft.address, {
        from: renter,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //rent the house
      await homeNft.payRent(1, {
        from: renter,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //now wait until the rent cycle and then see if the renter is still occupying the property
      //Adds one second to the time to verify the last time has passed
      await upkeepSimulateDays(RENT_CYCLES_DAYS + 1, homeNft, currentOwner);

      //check if the renter is still occupying the property
      const current_occupancy = await homeNft.getOccupied(1);
      expect(current_occupancy).to.be.equal(false);

      const current_getStartedRentingOn = await homeNft.getStartedRentingOn(1);
      expect(current_getStartedRentingOn).to.be.equal(new BN(0));

      const current_getLastRentPayment = await homeNft.getLastRentPayment(1);
      expect(current_getLastRentPayment).to.be.equal(new BN(0));

      const current_getLeaseEnds = await homeNft.getLeaseEnds(1);
      expect(current_getLeaseEnds).to.be.equal(new BN(0));

      const current_getRenter = await homeNft.getRenter(1);
      expect(current_getRenter).to.be.equal(
        "0x0000000000000000000000000000000000000000"
      );
    });
  });

  describe("Events", async () => {
    it("PayedRent event is triggered", async () => {
      await homeNft.mint(
        currentOwner,
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_PURCHASE_PRICE,
        { from: currentOwner, gas: 5000000, gasPrice: 500000000 }
      );

      //gives the renter the rent money
      await usdgToken.mint(renter, RENT_PRICE, {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.approve(homeNft.address, RENT_PRICE, {
        from: renter,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.allowance(renter, homeNft.address, {
        from: renter,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //rent the house
      const tx = await homeNft.payRent(1, {
        from: renter,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await expectEvent(tx, "PayedRent", {
        renter: renter,
        owner: currentOwner,
        homeId: new BN(1),
        rent_price: new BN(RENT_PRICE),
      });
    });

    it("NewRenter event is triggered", async () => {
      await homeNft.mint(
        currentOwner,
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_PURCHASE_PRICE,
        { from: currentOwner, gas: 5000000, gasPrice: 500000000 }
      );

      //gives the renter the rent money
      await usdgToken.mint(renter, RENT_PRICE, {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.approve(homeNft.address, RENT_PRICE, {
        from: renter,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.allowance(renter, homeNft.address, {
        from: renter,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //rent the house
      const tx = await homeNft.payRent(1, {
        from: renter,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await expectEvent(tx, "NewRenter", {
        renter: renter,
        homeId: new BN(1),
      });
    });

    it("NewProperty event is triggered", async () => {
      const tx = await homeNft.mint(
        currentOwner,
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_PURCHASE_PRICE,
        { from: currentOwner, gas: 5000000, gasPrice: 500000000 }
      );

      await expectEvent(tx, "NewProperty", {
        homeId: new BN(1),
        owner: currentOwner,
        tokenURI: HOME_DATA_URI,
        rent_price: new BN(RENT_PRICE),
        purchase_price: new BN(HOME_PURCHASE_PRICE),
      });
    });

    it("RentUpdated event is triggered", async () => {
      const NEW_RENT_PRICE = 8000;
      await homeNft.mint(
        currentOwner,
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_PURCHASE_PRICE,
        { from: currentOwner, gas: 5000000, gasPrice: 500000000 }
      );

      const tx = await homeNft.setRent(1, NEW_RENT_PRICE, {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await expectEvent(tx, "RentUpdated", {
        homeId: new BN(1),
        old_rent_price: new BN(RENT_PRICE),
        new_rent_price: new BN(NEW_RENT_PRICE),
        owner: currentOwner,
      });
    });

    it("AppraisalUpdated event is triggered", async () => {
      const NEW_PROPERTY_PRICE = 2000000;
      await homeNft.mint(
        currentOwner,
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_PURCHASE_PRICE,
        { from: currentOwner, gas: 5000000, gasPrice: 500000000 }
      );

      const tx = await homeNft.setAppraisalPrice(1, NEW_PROPERTY_PRICE, {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await expectEvent(tx, "AppraisalUpdated", {
        homeId: new BN(1),
        old_appraisal_price: new BN(HOME_PURCHASE_PRICE),
        new_appraisal_price: new BN(NEW_PROPERTY_PRICE),
        owner: currentOwner,
      });
    });

    it("LeaseEnds event is triggered", async () => {
      await homeNft.mint(
        currentOwner,
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_PURCHASE_PRICE,
        { from: currentOwner, gas: 5000000, gasPrice: 500000000 }
      );

      //gives the renter the rent money
      await usdgToken.mint(renter, RENT_PRICE, {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.approve(homeNft.address, RENT_PRICE, {
        from: renter,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.allowance(renter, homeNft.address, {
        from: renter,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //rent the house
      await homeNft.payRent(1, {
        from: renter,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //now wait until the rent cycle and then see if the renter is still occupying the property
      //Adds one second to the time to verify the last time has passed
      const tx = await upkeepSimulateDays(
        RENT_CYCLES_DAYS,
        homeNft,
        currentOwner
      );

      await expectEvent(tx, "LeaseEnds", {
        homeId: new BN(1),
        renter: renter,
      });
    });
  });
});
