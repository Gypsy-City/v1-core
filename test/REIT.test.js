const { expect } = require("chai");
const log = require("./helpers/logger");
const { calculateETH } = require("./helpers/gasAverage");
const { BN, expectEvent, expectRevert } = require("@openzeppelin/test-helpers");

//Contracts
const HomeNFT = artifacts.require("HomeNFT");
const TestGPSY = artifacts.require("TestGPSY");
const USDGToken = artifacts.require("USDGToken");
const REIT = artifacts.require("REIT");
const LGPSYToken = artifacts.require("LGPSYToken");

contract("REIT", async (accounts) => {
  const INITIAL_SUPPLY = "0";
  const HOME_PURCHASE_PRICE = 1000000;
  const RENT_PRICE = 6000;
  const HOME_DATA_URI =
    "https://bafybeievyhunzymva6pjfgnjuwsobhxxp3pb6fonxryn5wuvh65h7lthxe.ipfs.w3s.link/data.json";

  let homeNft,
    gpsyToken,
    usdgToken,
    lgpsyToken,
    currentOwner,
    renter,
    operations_wallet,
    profit_wallet,
    gasAverage;

  before(() => {
    currentOwner = accounts[0];
    renter = accounts[1];
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

    await homeNft.mint(
      reit.address,
      HOME_DATA_URI,
      RENT_PRICE,
      HOME_PURCHASE_PRICE,
      {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      }
    );
  });

  describe("constructor", async () => {
    it("initialized the REIT contract with correct contract connections", async () => {
      //contracts
      let expected_stablecoin_address = await reit.stablecoin();
      let expected_reit_share_address = await reit.reit_share();
      let expected_reit_share_vault_address = await reit.reit_share_vault();
      let expected_reit_homes_nft_address = await reit.reit_homes_nft();

      //wallets
      let expected_operations_wallet_address = await reit.operations_wallet();
      let expected_profits_wallet_address = await reit.profits_wallet();

      expect(expected_stablecoin_address).to.equal(usdgToken.address);
      expect(expected_reit_share_address).to.equal(gpsyToken.address);
      expect(expected_reit_share_vault_address).to.equal(lgpsyToken.address);
      expect(expected_reit_homes_nft_address).to.equal(homeNft.address);
      expect(expected_operations_wallet_address).to.equal(operations_wallet);
      expect(expected_profits_wallet_address).to.equal(profit_wallet);
    });
  });

  describe("Cashflow", async () => {
    it("The contract recieves the rent payment", async () => {
      //checks the balance of the contract
      //renter pays rent
      //checkes the balance of the contract
      //expect them to be the same

      let before_balance = await usdgToken.balanceOf(reit.address);
      expect(before_balance).to.be.bignumber.equal(new BN(0));

      //gives the renter the rent money
      await usdgToken.mint(renter, new BN(RENT_PRICE), {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //approve the rent payment
      await usdgToken.approve(homeNft.address, new BN(RENT_PRICE), {
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

      let after_balance = await usdgToken.balanceOf(reit.address);
      expect(after_balance).to.be.bignumber.equal(new BN(RENT_PRICE));
    });
    it("The contract can send dividends", async () => {
      let before_balance = await usdgToken.balanceOf(reit.address);
      expect(before_balance).to.be.bignumber.equal(new BN(0));

      //gives the renter the rent money
      await usdgToken.mint(renter, new BN(RENT_PRICE), {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //approve the rent payment
      await usdgToken.approve(homeNft.address, new BN(RENT_PRICE), {
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

      let after_balance = await usdgToken.balanceOf(reit.address);
      expect(after_balance).to.be.bignumber.equal(new BN(RENT_PRICE));

      //check before balance
      let lgpsy_balance_before = await usdgToken.balanceOf(lgpsyToken.address);
      let profit_wallet_balance_before = await usdgToken.balanceOf(
        lgpsyToken.address
      );

      expect(lgpsy_balance_before).to.be.bignumber.equal(new BN(0));
      expect(profit_wallet_balance_before).to.be.bignumber.equal(new BN(0));

      //CONTRACT HAS NOW RECIEVED THE PAYMENT LETS SEND IT OUT
      await reit.sendDividend(),
        {
          from: renter,
          gas: 5000000,
          gasPrice: 500000000,
        };

      let lgpsy_balance_after = await usdgToken.balanceOf(lgpsyToken.address);
      let profit_wallet_balance_after = await usdgToken.balanceOf(
        profit_wallet
      );

      let expected_lgpsy_balance = RENT_PRICE - RENT_PRICE / 10;
      let expected_profit_wallet_balance = RENT_PRICE / 10;

      expect(lgpsy_balance_after).to.be.bignumber.equal(
        new BN(expected_lgpsy_balance)
      );
      expect(profit_wallet_balance_after).to.be.bignumber.equal(
        new BN(expected_profit_wallet_balance)
      );
      //check if dividends were recieved correctly
    });
  });
});
