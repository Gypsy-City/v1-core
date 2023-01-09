const { expect } = require("chai");
const log = require("./helpers/logger");
const hre = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { calculateETH } = require("./helpers/gasAverage");
const { BN, expectEvent, expectRevert } = require("@openzeppelin/test-helpers");

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
  const HOME_DATA_URI =
    "https://bafybeievyhunzymva6pjfgnjuwsobhxxp3pb6fonxryn5wuvh65h7lthxe.ipfs.w3s.link/data.json";

  let homeNft,
    gpsyToken,
    currentOwner,
    renter,
    investor,
    operations_wallet,
    profit_wallet,
    user1,
    minter,
    gasAverage;

  before(() => {
    currentOwner = accounts[0];
    renter = accounts[1];
    investor = accounts[2];
    operations_wallet = accounts[3];
    profit_wallet = accounts[4];
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

  describe("mint a home to the portfolio", async () => {
    it("homeNFT is mintable", async () => {
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

      log(
        `[${calculateETH(
          gasAverage,
          tx.receipt.gasUsed
        )} ETH] --> fees of minting a new home to the homeNFT`
      );
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

      log(
        `[${calculateETH(
          gasAverage,
          tx.receipt.gasUsed
        )} ETH] --> fees of setting a new rent price for a home`
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

      log(
        `[${calculateETH(
          gasAverage,
          tx.receipt.gasUsed
        )} ETH] --> fees of setting a new apprasial price for a home`
      );
    });
  });
  describe("Renter can send payment", async () => {
    it("renter is able to pay rent", async () => {
      //adds a home to the collection
      await homeNft.mint(
        currentOwner,
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_PURCHASE_PRICE,
        { from: currentOwner, gas: 5000000, gasPrice: 500000000 }
      );

      //gives the renter the rent money
      await usdgToken.mint(renter, new BN(RENT_PRICE), {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.approve(homeNft.address, new BN(RENT_PRICE), {
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

      log(
        `[${calculateETH(
          gasAverage,
          tx.receipt.gasUsed
        )} ETH] --> fees of paying rent`
      );
    });
    it("renter successfully sent rent in USDG to the owner of the NFT", async () => {
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
      const balance_of_owner = await usdgToken.balanceOf(currentOwner);

      //owner of the house recieved the rent payment
      expect(balance_of_owner).to.be.bignumber.equal(new BN(RENT_PRICE));
    });

    it("renter pays rent and subtracts their usdg", async () => {
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
  });
});
