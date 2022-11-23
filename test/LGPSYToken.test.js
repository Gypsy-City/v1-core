const { expect } = require("chai");
const log = require("./helpers/logger");
const { calculateETH } = require("./helpers/gasAverage");
const {
  BN,
  expectEvent,
  expectRevert,
  time,
} = require("@openzeppelin/test-helpers");

//Contracts
const HomeNFT = artifacts.require("HomeNFT");
const TestGPSY = artifacts.require("TestGPSY");
const USDGToken = artifacts.require("USDGToken");
const LGPSYToken = artifacts.require("LGPSYToken");
const REIT = artifacts.require("REIT");

contract("LGPSYToken", async (accounts) => {
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

    await homeNft.mint(
      lgpsyToken.address,
      HOME_DATA_URI,
      RENT_PRICE,
      HOME_PURCHASE_PRICE,
      { from: currentOwner, gas: 5000000, gasPrice: 500000000 }
    );

    await usdgToken.mint(renter, RENT_PRICE, {
      from: currentOwner,
      gas: 5000000,
      gasPrice: 500000000,
    });

    await gpsyToken.mint(investor, 100000);
  });

  describe("constructor", async () => {
    it("initialized the lgpsy contract", async () => {
      let supply = await lgpsyToken.totalSupply();
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
  });

  describe("staker functions", async () => {
    it("GPSY holder is able to stake GPSY", async () => {
      const STAKE_AMOUNT = new BN(100);
      await gpsyToken.approve(lgpsyToken.address, STAKE_AMOUNT, {
        from: investor,
        gas: 5000000,
        gasPrice: 500000000,
      });

      const allowance_amount = await gpsyToken.allowance(
        investor,
        lgpsyToken.address,
        {
          from: investor,
          gas: 5000000,
          gasPrice: 500000000,
        }
      );

      expect(STAKE_AMOUNT).to.be.bignumber.equal(allowance_amount);

      let tx = await lgpsyToken.deposit(STAKE_AMOUNT, investor, {
        from: investor,
        gas: 5000000,
        gasPrice: 500000000,
      });

      log(
        `[${calculateETH(
          gasAverage,
          tx.receipt.gasUsed
        )} ETH] --> fees of staking GPSY`
      );
    });

    it("GPSY staker recieves the correct shares of LGPSY", async () => {
      const STAKE_AMOUNT = new BN(100);
      await gpsyToken.approve(lgpsyToken.address, STAKE_AMOUNT, {
        from: investor,
        gas: 5000000,
        gasPrice: 500000000,
      });

      const allowance_amount = await gpsyToken.allowance(
        investor,
        lgpsyToken.address,
        {
          from: investor,
          gas: 5000000,
          gasPrice: 500000000,
        }
      );

      expect(STAKE_AMOUNT).to.be.bignumber.equal(allowance_amount);

      let investor_gypsy_balance_before = await gpsyToken.balanceOf(investor);

      let tx = await lgpsyToken.deposit(STAKE_AMOUNT, investor, {
        from: investor,
        gas: 5000000,
        gasPrice: 500000000,
      });

      let investor_balance_lgpsy = await lgpsyToken.balanceOf(investor);
      let investor_balance_of_assets = await lgpsyToken.balanceOfAssets(
        investor
      );
      let investor_max_withdraw = await lgpsyToken.maxWithdraw(investor);
      let total_assets_in_vault = await lgpsyToken.totalAssets();

      let investor_gypsy_balance_after = await gpsyToken.balanceOf(investor);

      let investor_gypsy_balance_difference = investor_gypsy_balance_before.sub(
        investor_gypsy_balance_after
      );

      //makes sure the investor got the LGPSY
      expect(STAKE_AMOUNT).to.be.bignumber.equal(investor_balance_lgpsy);
      expect(STAKE_AMOUNT).to.be.bignumber.equal(investor_balance_of_assets);
      expect(STAKE_AMOUNT).to.be.bignumber.equal(investor_max_withdraw);
      expect(STAKE_AMOUNT).to.be.bignumber.equal(investor_max_withdraw);

      //make sure the investor doesnt have the GPSY
      expect(STAKE_AMOUNT).to.be.bignumber.equal(total_assets_in_vault);
      expect(STAKE_AMOUNT).to.be.bignumber.equal(
        investor_gypsy_balance_difference
      );
    });

    it("GPSY staker can withdraw staked gypsy", async () => {
      const STAKE_AMOUNT = new BN(100);
      await gpsyToken.approve(lgpsyToken.address, STAKE_AMOUNT, {
        from: investor,
        gas: 5000000,
        gasPrice: 500000000,
      });

      const allowance_amount = await gpsyToken.allowance(
        investor,
        lgpsyToken.address,
        {
          from: investor,
          gas: 5000000,
          gasPrice: 500000000,
        }
      );

      expect(STAKE_AMOUNT).to.be.bignumber.equal(allowance_amount);

      let investor_gypsy_balance_before = await gpsyToken.balanceOf(investor);

      await lgpsyToken.deposit(STAKE_AMOUNT, investor, {
        from: investor,
        gas: 5000000,
        gasPrice: 500000000,
      });

      let investor_balance_lgpsy = await lgpsyToken.balanceOf(investor);
      let investor_balance_of_assets = await lgpsyToken.balanceOfAssets(
        investor
      );

      let investor_max_withdraw = await lgpsyToken.maxWithdraw(investor);
      let total_assets_in_vault = await lgpsyToken.totalAssets();

      //makes sure the investor got the LGPSY
      expect(STAKE_AMOUNT).to.be.bignumber.equal(investor_balance_lgpsy);
      expect(STAKE_AMOUNT).to.be.bignumber.equal(investor_balance_of_assets);
      expect(STAKE_AMOUNT).to.be.bignumber.equal(investor_max_withdraw);
      expect(STAKE_AMOUNT).to.be.bignumber.equal(investor_max_withdraw);
      expect(STAKE_AMOUNT).to.be.bignumber.equal(total_assets_in_vault);

      let tx = await lgpsyToken.withdraw(STAKE_AMOUNT, investor, investor, {
        from: investor,
        gas: 5000000,
        gasPrice: 500000000,
      });

      log(
        `[${calculateETH(
          gasAverage,
          tx.receipt.gasUsed
        )} ETH] --> fees of withdraw GPSY from LGPSY`
      );

      investor_balance_lgpsy = await lgpsyToken.balanceOf(investor);
      investor_balance_of_assets = await lgpsyToken.balanceOfAssets(investor);
      investor_max_withdraw = await lgpsyToken.maxWithdraw(investor);
      total_assets_in_vault = await lgpsyToken.totalAssets();

      let zero_bn = new BN(0);
      //makes sure the investor gave back LGPSY
      expect(investor_balance_lgpsy).to.be.bignumber.equal(zero_bn);
      expect(investor_balance_of_assets).to.be.bignumber.equal(zero_bn);
      expect(investor_max_withdraw).to.be.bignumber.equal(zero_bn);
      expect(total_assets_in_vault).to.be.bignumber.equal(zero_bn);

      //makes sure the investor got back GPSY
      investor_balance_gpsy = await gpsyToken.balanceOf(investor);

      expect(investor_gypsy_balance_before).to.be.bignumber.equal(
        investor_balance_gpsy
      );
    });

    it("GPSY staker recieves vested payments over time", async () => {
      const STAKE_AMOUNT = new BN(100);
      const PROFIT_AMOUNT = new BN(50);
      await gpsyToken.approve(lgpsyToken.address, STAKE_AMOUNT, {
        from: investor,
        gas: 5000000,
        gasPrice: 500000000,
      });

      const allowance_amount = await gpsyToken.allowance(
        investor,
        lgpsyToken.address,
        {
          from: investor,
          gas: 5000000,
          gasPrice: 500000000,
        }
      );

      expect(STAKE_AMOUNT).to.be.bignumber.equal(allowance_amount);

      let investor_gypsy_balance_before = await gpsyToken.balanceOf(investor);

      await lgpsyToken.deposit(STAKE_AMOUNT, investor, {
        from: investor,
        gas: 5000000,
        gasPrice: 500000000,
      });

      let investor_balance_lgpsy = await lgpsyToken.balanceOf(investor);
      let investor_balance_of_assets = await lgpsyToken.balanceOfAssets(
        investor
      );
      let investor_max_withdraw = await lgpsyToken.maxWithdraw(investor);
      let total_assets_in_vault = await lgpsyToken.totalAssets();

      let investor_gypsy_balance_after = await gpsyToken.balanceOf(investor);

      let investor_gypsy_balance_difference = investor_gypsy_balance_before.sub(
        investor_gypsy_balance_after
      );

      //makes sure the investor got the LGPSY
      expect(STAKE_AMOUNT).to.be.bignumber.equal(investor_balance_lgpsy);
      expect(STAKE_AMOUNT).to.be.bignumber.equal(investor_balance_of_assets);
      expect(STAKE_AMOUNT).to.be.bignumber.equal(investor_max_withdraw);
      expect(STAKE_AMOUNT).to.be.bignumber.equal(investor_max_withdraw);

      //make sure the investor doesnt have the GPSY
      expect(STAKE_AMOUNT).to.be.bignumber.equal(total_assets_in_vault);
      expect(STAKE_AMOUNT).to.be.bignumber.equal(
        investor_gypsy_balance_difference
      );

      //Add new GPSY to the vault
      await gpsyToken.mint(lgpsyToken.address, 50, {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //make sure the contract recieved the minted tokens
      let new_balance_in_vault = await gpsyToken.balanceOf(lgpsyToken.address);

      let expected_new_total_assets_in_vault = PROFIT_AMOUNT.add(STAKE_AMOUNT);

      expect(new_balance_in_vault).to.be.bignumber.equal(
        expected_new_total_assets_in_vault
      );

      //make sure the investor can redeem it
      let new_total_assets_in_vault = await lgpsyToken.totalAssets();
      let max_redeem = await lgpsyToken.maxRedeem(investor);
      expect(max_redeem).to.be.bignumber.equal(new_total_assets_in_vault);
    });

    it("Vesting schedule is correct amount", async () => {
      const STAKE_AMOUNT = new BN(1000000000000);
      const PROFIT_AMOUNT = new BN(500000000);

      //mint the investor a bunch of tokens
      await gpsyToken.mint(investor, STAKE_AMOUNT, {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //
      await gpsyToken.approve(lgpsyToken.address, STAKE_AMOUNT, {
        from: investor,
        gas: 5000000,
        gasPrice: 500000000,
      });

      const allowance_amount = await gpsyToken.allowance(
        investor,
        lgpsyToken.address,
        {
          from: investor,
          gas: 5000000,
          gasPrice: 500000000,
        }
      );

      expect(STAKE_AMOUNT).to.be.bignumber.equal(allowance_amount);

      let investor_gypsy_balance_before = await gpsyToken.balanceOf(investor);

      await lgpsyToken.deposit(STAKE_AMOUNT, investor, {
        from: investor,
        gas: 5000000,
        gasPrice: 500000000,
      });

      let investor_balance_lgpsy = await lgpsyToken.balanceOf(investor);
      let investor_balance_of_assets = await lgpsyToken.balanceOfAssets(
        investor
      );
      let investor_max_withdraw = await lgpsyToken.maxWithdraw(investor);
      let total_assets_in_vault = await lgpsyToken.totalAssets();

      let investor_gypsy_balance_after = await gpsyToken.balanceOf(investor);

      let investor_gypsy_balance_difference = investor_gypsy_balance_before.sub(
        investor_gypsy_balance_after
      );

      //makes sure the investor got the LGPSY
      expect(investor_balance_lgpsy).to.be.bignumber.equal(STAKE_AMOUNT);
      expect(investor_balance_of_assets).to.be.bignumber.equal(STAKE_AMOUNT);
      expect(investor_max_withdraw).to.be.bignumber.equal(STAKE_AMOUNT);
      expect(investor_max_withdraw).to.be.bignumber.equal(STAKE_AMOUNT);

      //make sure the investor doesnt have the GPSY
      expect(total_assets_in_vault).to.be.bignumber.equal(STAKE_AMOUNT);
      expect(investor_gypsy_balance_difference).to.be.bignumber.equal(
        STAKE_AMOUNT
      );

      //Add new GPSY to the owner
      await gpsyToken.mint(currentOwner, PROFIT_AMOUNT, {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //Transfer the tokens into the vault to be dispersed
      await gpsyToken.transfer(lgpsyToken.address, PROFIT_AMOUNT, {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //updates the vesting period of the profit the owner deposited
      //the vesting period is set to 5 days
      const VESTING_PERIOD = time.duration.weeks(4);
      let tx = await lgpsyToken.updateVestingSchedule(VESTING_PERIOD, {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      let balance_of_contract_after = await gpsyToken.balanceOf(
        lgpsyToken.address
      );
      let free_assets_start = await lgpsyToken.freeAssets();
      let LGPSY_PRECISION = await lgpsyToken.precision();
      let expected_issuance_rate =
        ((balance_of_contract_after - free_assets_start) * LGPSY_PRECISION) /
        VESTING_PERIOD;

      let actual_issuance_rate = await lgpsyToken.issuanceRate();

      expected_issuance_rate = Math.floor(expected_issuance_rate); //needs to round up whole number

      expect(new BN(expected_issuance_rate)).to.be.bignumber.equal(
        new BN(actual_issuance_rate)
      );
    });

    it("An investor can withdraw 50% of profits after half of the vesting period", async () => {
      const STAKE_AMOUNT = new BN(1000000000000);
      const PROFIT_AMOUNT = new BN(500000000000);

      //mint the investor a bunch of tokens
      await gpsyToken.mint(investor, STAKE_AMOUNT, {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //
      await gpsyToken.approve(lgpsyToken.address, STAKE_AMOUNT, {
        from: investor,
        gas: 5000000,
        gasPrice: 500000000,
      });

      const allowance_amount = await gpsyToken.allowance(
        investor,
        lgpsyToken.address,
        {
          from: investor,
          gas: 5000000,
          gasPrice: 500000000,
        }
      );

      expect(STAKE_AMOUNT).to.be.bignumber.equal(allowance_amount);

      let investor_gypsy_balance_before = await gpsyToken.balanceOf(investor);

      await lgpsyToken.deposit(STAKE_AMOUNT, investor, {
        from: investor,
        gas: 5000000,
        gasPrice: 500000000,
      });

      let investor_balance_lgpsy = await lgpsyToken.balanceOf(investor);
      let investor_balance_of_assets = await lgpsyToken.balanceOfAssets(
        investor
      );
      let investor_max_withdraw = await lgpsyToken.maxWithdraw(investor);
      let total_assets_in_vault = await lgpsyToken.totalAssets();

      let investor_gypsy_balance_after = await gpsyToken.balanceOf(investor);

      let investor_gypsy_balance_difference = investor_gypsy_balance_before.sub(
        investor_gypsy_balance_after
      );

      //makes sure the investor got the LGPSY
      expect(investor_balance_lgpsy).to.be.bignumber.equal(STAKE_AMOUNT);
      expect(investor_balance_of_assets).to.be.bignumber.equal(STAKE_AMOUNT);
      expect(investor_max_withdraw).to.be.bignumber.equal(STAKE_AMOUNT);
      expect(investor_max_withdraw).to.be.bignumber.equal(STAKE_AMOUNT);

      //make sure the investor doesnt have the GPSY
      expect(total_assets_in_vault).to.be.bignumber.equal(STAKE_AMOUNT);
      expect(investor_gypsy_balance_difference).to.be.bignumber.equal(
        STAKE_AMOUNT
      );

      //Add new GPSY to the owner
      await gpsyToken.mint(currentOwner, PROFIT_AMOUNT, {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //Transfer the tokens into the vault to be dispersed
      await gpsyToken.transfer(lgpsyToken.address, PROFIT_AMOUNT, {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //updates the vesting period of the profit the owner deposited
      //the vesting period is set to 5 days
      const VESTING_PERIOD = time.duration.weeks(4);
      let tx = await lgpsyToken.updateVestingSchedule(VESTING_PERIOD, {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      let balance_of_contract_after = await gpsyToken.balanceOf(
        lgpsyToken.address
      );
      let free_assets_start = await lgpsyToken.freeAssets();
      let LGPSY_PRECISION = await lgpsyToken.precision();
      let expected_issuance_rate =
        ((balance_of_contract_after - free_assets_start) * LGPSY_PRECISION) /
        VESTING_PERIOD;

      let actual_issuance_rate = await lgpsyToken.issuanceRate();

      expected_issuance_rate = Math.floor(expected_issuance_rate); //needs to round up whole number

      expect(new BN(expected_issuance_rate)).to.be.bignumber.equal(
        new BN(actual_issuance_rate)
      );

      //skip half of the vesting period
      await time.increase(time.duration.weeks(2));

      //widthdraw the stake
      let max_withdraw_after_half_vesting_period = await lgpsyToken.maxWithdraw(
        investor
      );

      let expected_withdraw_after_half_vesting_period =
        STAKE_AMOUNT.toNumber() + actual_issuance_rate * time.duration.weeks(2);

      //the example was off isuance by half of a second's amount so using percent error instead of exact.
      //this can probably be fixed
      expect(max_withdraw_after_half_vesting_period).to.be.equal(
        expected_withdraw_after_half_vesting_period
      );
    });
  });
});
