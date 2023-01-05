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
  });

  describe("Constructor", async () => {
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
      //gives the reit the money to buy the home
      await usdgToken.mint(reit.address, new BN(HOME_PURCHASE_PRICE), {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //adds home
      await reit.addHome(HOME_DATA_URI, RENT_PRICE, HOME_PURCHASE_PRICE, {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

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
      //gives the reit the money to buy the home
      await usdgToken.mint(reit.address, new BN(HOME_PURCHASE_PRICE), {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //buys the home
      await reit.addHome(HOME_DATA_URI, RENT_PRICE, HOME_PURCHASE_PRICE, {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

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

  describe("Purchase Gypsy token", async () => {
    it("Investor successfully purchases Gypsy when there are no houses and no cash reserves", async () => {
      let before_balance = await usdgToken.balanceOf(reit.address);
      expect(before_balance).to.be.bignumber.equal(new BN(0));

      //make sure there are no homes yet
      let house_count = await homeNft.count();
      expect(house_count).to.be.bignumber.equal(new BN(0));

      const INVESTMENT_MONEY = 100000000;
      const GYPSY_TOKEN_AMOUNT = INVESTMENT_MONEY / 100;
      //gives the investor the money to invest
      await usdgToken.mint(investor, new BN(INVESTMENT_MONEY), {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.approve(reit.address, new BN(INVESTMENT_MONEY), {
        from: investor,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await reit.buy(new BN(GYPSY_TOKEN_AMOUNT), {
        from: investor,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //check if the investor has the Gypsy
      let investor_gypsy_balance = await gpsyToken.balanceOf(investor);
      expect(investor_gypsy_balance).to.be.bignumber.equal(
        new BN(GYPSY_TOKEN_AMOUNT)
      );

      //check if REIT has the USDG
      let reit_usdg_balance = await usdgToken.balanceOf(reit.address);
      expect(reit_usdg_balance).to.be.bignumber.equal(new BN(INVESTMENT_MONEY));

      //check if the backing of Gypsy is $100
      let current_backing_per_gypsy = await reit.backingPerShare();
      let expected_backing_per_gypsy =
        100 * Math.pow(10, await gpsyToken.decimals());
      expect(current_backing_per_gypsy).to.be.bignumber.equal(
        new BN(expected_backing_per_gypsy)
      );
    });

    it("Investor successfully purchases Gypsy when there are no houses and cash reserves", async () => {
      let before_balance = await usdgToken.balanceOf(reit.address);
      expect(before_balance).to.be.bignumber.equal(new BN(0));

      //make sure there are no homes yet
      let house_count = await homeNft.count();
      expect(house_count).to.be.bignumber.equal(new BN(0));

      const INVESTMENT_MONEY = 100000000;
      const GYPSY_TOKEN_AMOUNT = INVESTMENT_MONEY / 100;
      //gives the investor the money to invest
      await usdgToken.mint(investor, new BN(INVESTMENT_MONEY), {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.approve(reit.address, new BN(INVESTMENT_MONEY), {
        from: investor,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await reit.buy(new BN(GYPSY_TOKEN_AMOUNT), {
        from: investor,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //check if the investor has the Gypsy
      let investor_gypsy_balance = await gpsyToken.balanceOf(investor);
      expect(investor_gypsy_balance).to.be.bignumber.equal(
        new BN(GYPSY_TOKEN_AMOUNT)
      );

      //check if REIT has the USDG
      let reit_usdg_balance = await usdgToken.balanceOf(reit.address);
      expect(reit_usdg_balance).to.be.bignumber.equal(new BN(INVESTMENT_MONEY));

      //check if the backing of Gypsy is $100
      let current_backing_per_gypsy = await reit.backingPerShare();
      let expected_backing_per_gypsy =
        100 * Math.pow(10, await gpsyToken.decimals());
      expect(current_backing_per_gypsy).to.be.bignumber.equal(
        new BN(expected_backing_per_gypsy)
      );

      //Now the investor buys more Gypsy

      //gives the investor the money to invest
      await usdgToken.mint(investor, new BN(INVESTMENT_MONEY), {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.approve(reit.address, new BN(INVESTMENT_MONEY), {
        from: investor,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await reit.buy(new BN(GYPSY_TOKEN_AMOUNT), {
        from: investor,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //check if the investor has the Gypsy
      let new_investor_gypsy_balance = await gpsyToken.balanceOf(investor);
      expect(new_investor_gypsy_balance).to.be.bignumber.equal(
        new BN(GYPSY_TOKEN_AMOUNT * 2)
      );

      //check if REIT has the USDG
      let new_reit_usdg_balance = await usdgToken.balanceOf(reit.address);
      expect(new_reit_usdg_balance).to.be.bignumber.equal(
        new BN(INVESTMENT_MONEY * 2)
      );

      //check if the backing of Gypsy is $100
      let new_current_backing_per_gypsy = await reit.backingPerShare();
      let new_expected_backing_per_gypsy =
        100 * Math.pow(10, await gpsyToken.decimals());
      expect(new_current_backing_per_gypsy).to.be.bignumber.equal(
        new BN(new_expected_backing_per_gypsy)
      );
    });

    it("Investor successfully purchases Gypsy when there are 1 house and no cash reserves", async () => {
      let before_balance = await usdgToken.balanceOf(reit.address);
      expect(before_balance).to.be.bignumber.equal(new BN(0));

      //make sure there are no homes yet
      let house_count = await homeNft.count();
      expect(house_count).to.be.bignumber.equal(new BN(0));

      //investor buys gypsy
      const INVESTMENT_MONEY = 10000;
      const INVESTMENT_MONEY_WITH_DECIMALS =
        INVESTMENT_MONEY * Math.pow(10, await usdgToken.decimals());

      const GYPSY_TOKEN_AMOUNT = INVESTMENT_MONEY / 100;
      const GYPSY_TOKEN_AMOUNT_WITH_DECIMALS =
        GYPSY_TOKEN_AMOUNT * Math.pow(10, await gpsyToken.decimals());
      //gives the investor the money to invest
      await usdgToken.mint(investor, new BN(INVESTMENT_MONEY_WITH_DECIMALS), {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.approve(
        reit.address,
        new BN(INVESTMENT_MONEY_WITH_DECIMALS),
        {
          from: investor,
          gas: 5000000,
          gasPrice: 500000000,
        }
      );

      await reit.buy(new BN(GYPSY_TOKEN_AMOUNT_WITH_DECIMALS), {
        from: investor,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //check if the investor has the Gypsy
      let investor_gypsy_balance = await gpsyToken.balanceOf(investor);
      expect(investor_gypsy_balance).to.be.bignumber.equal(
        new BN(GYPSY_TOKEN_AMOUNT_WITH_DECIMALS)
      );

      //check if REIT has the USDG
      let reit_usdg_balance = await usdgToken.balanceOf(reit.address);
      expect(reit_usdg_balance).to.be.bignumber.equal(
        new BN(INVESTMENT_MONEY_WITH_DECIMALS)
      );

      //check if the backing of Gypsy is $100
      let current_backing_per_gypsy = await reit.backingPerShare();
      let expected_backing_per_gypsy =
        100 * Math.pow(10, await gpsyToken.decimals());
      expect(current_backing_per_gypsy).to.be.bignumber.equal(
        new BN(expected_backing_per_gypsy)
      );

      //now the REIT buys a home which empties out the treasury so it has no reserves
      const HOME_VALUE = 10000;
      const HOME_VALUE_WITH_DECIMALS =
        HOME_VALUE * Math.pow(10, await usdgToken.decimals());

      //Now have the REIT purchase a home.
      const RENT_PRICE = 5000 * Math.pow(10, await usdgToken.decimals());
      await reit.addHome(HOME_DATA_URI, RENT_PRICE, HOME_VALUE_WITH_DECIMALS);

      //check we have the home
      let current_home_count = await reit.numberOfProperties();
      expect(current_home_count).to.be.bignumber.equal(new BN(1));

      //now the investor buys more gypsy when the backing hasnt changed

      //gives the investor the money to invest
      await usdgToken.mint(investor, new BN(INVESTMENT_MONEY_WITH_DECIMALS), {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.approve(
        reit.address,
        new BN(INVESTMENT_MONEY_WITH_DECIMALS),
        {
          from: investor,
          gas: 5000000,
          gasPrice: 500000000,
        }
      );

      await reit.buy(new BN(GYPSY_TOKEN_AMOUNT_WITH_DECIMALS), {
        from: investor,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //check if the investor has the Gypsy
      let new_investor_gypsy_balance = await gpsyToken.balanceOf(investor);
      expect(new_investor_gypsy_balance).to.be.bignumber.equal(
        new BN(GYPSY_TOKEN_AMOUNT_WITH_DECIMALS * 2)
      );

      //check if REIT has the USDG
      let new_reit_usdg_balance = await usdgToken.balanceOf(reit.address);
      expect(new_reit_usdg_balance).to.be.bignumber.equal(
        new BN(INVESTMENT_MONEY_WITH_DECIMALS)
      );

      //check if the backing of Gypsy is still $100
      let new_current_backing_per_gypsy = await reit.backingPerShare();
      let new_expected_backing_per_gypsy =
        100 * Math.pow(10, await gpsyToken.decimals());
      expect(new_current_backing_per_gypsy).to.be.bignumber.equal(
        new BN(new_expected_backing_per_gypsy)
      );
    });

    it("Investor successfully purchases Gypsy when there are 1 house and cash reserves", async () => {
      let before_balance = await usdgToken.balanceOf(reit.address);
      expect(before_balance).to.be.bignumber.equal(new BN(0));

      //make sure there are no homes yet
      let house_count = await homeNft.count();
      expect(house_count).to.be.bignumber.equal(new BN(0));

      //investor buys gypsy
      const INVESTMENT_MONEY = 10000;
      const INVESTMENT_MONEY_WITH_DECIMALS =
        INVESTMENT_MONEY * Math.pow(10, await usdgToken.decimals());

      const GYPSY_TOKEN_AMOUNT = INVESTMENT_MONEY / 100;
      const GYPSY_TOKEN_AMOUNT_WITH_DECIMALS =
        GYPSY_TOKEN_AMOUNT * Math.pow(10, await gpsyToken.decimals());
      //gives the investor the money to invest
      await usdgToken.mint(investor, new BN(INVESTMENT_MONEY_WITH_DECIMALS), {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.approve(
        reit.address,
        new BN(INVESTMENT_MONEY_WITH_DECIMALS),
        {
          from: investor,
          gas: 5000000,
          gasPrice: 500000000,
        }
      );

      await reit.buy(new BN(GYPSY_TOKEN_AMOUNT_WITH_DECIMALS), {
        from: investor,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //check if the investor has the Gypsy
      let investor_gypsy_balance = await gpsyToken.balanceOf(investor);
      expect(investor_gypsy_balance).to.be.bignumber.equal(
        new BN(GYPSY_TOKEN_AMOUNT_WITH_DECIMALS)
      );

      //check if REIT has the USDG
      let reit_usdg_balance = await usdgToken.balanceOf(reit.address);
      expect(reit_usdg_balance).to.be.bignumber.equal(
        new BN(INVESTMENT_MONEY_WITH_DECIMALS)
      );

      //check if the backing of Gypsy is $100
      let current_backing_per_gypsy = await reit.backingPerShare();
      let expected_backing_per_gypsy =
        100 * Math.pow(10, await gpsyToken.decimals());
      expect(current_backing_per_gypsy).to.be.bignumber.equal(
        new BN(expected_backing_per_gypsy)
      );

      //now the REIT buys a home which leaves cash reserves in the treasury
      const HOME_VALUE = 8000;
      const HOME_VALUE_WITH_DECIMALS =
        HOME_VALUE * Math.pow(10, await usdgToken.decimals());

      //Now have the REIT purchase a home.
      const RENT_PRICE = 5000 * Math.pow(10, await usdgToken.decimals());
      await reit.addHome(HOME_DATA_URI, RENT_PRICE, HOME_VALUE_WITH_DECIMALS);

      //check if we have the correct remaining USDG in the treasury
      let current_cash_reserves = await usdgToken.balanceOf(reit.address);
      let expected_cash_reserves =
        INVESTMENT_MONEY_WITH_DECIMALS - HOME_VALUE_WITH_DECIMALS;
      expect(current_cash_reserves).to.be.bignumber.equal(
        new BN(expected_cash_reserves)
      );

      //check we have the home
      let current_home_count = await reit.numberOfProperties();
      expect(current_home_count).to.be.bignumber.equal(new BN(1));

      //now the investor buys more gypsy when the backing hasnt changed

      //gives the investor the money to invest
      await usdgToken.mint(investor, new BN(INVESTMENT_MONEY_WITH_DECIMALS), {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.approve(
        reit.address,
        new BN(INVESTMENT_MONEY_WITH_DECIMALS),
        {
          from: investor,
          gas: 5000000,
          gasPrice: 500000000,
        }
      );

      await reit.buy(new BN(GYPSY_TOKEN_AMOUNT_WITH_DECIMALS), {
        from: investor,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //check if the investor has the Gypsy
      let new_investor_gypsy_balance = await gpsyToken.balanceOf(investor);
      expect(new_investor_gypsy_balance).to.be.bignumber.equal(
        new BN(GYPSY_TOKEN_AMOUNT_WITH_DECIMALS * 2)
      );

      //check if REIT has the USDG
      let new_reit_usdg_balance = await usdgToken.balanceOf(reit.address);
      expect(new_reit_usdg_balance).to.be.bignumber.equal(
        new BN(INVESTMENT_MONEY_WITH_DECIMALS + expected_cash_reserves)
      );

      //check if the backing of Gypsy is still $100
      let new_current_backing_per_gypsy = await reit.backingPerShare();
      let new_expected_backing_per_gypsy =
        100 * Math.pow(10, await gpsyToken.decimals());
      expect(new_current_backing_per_gypsy).to.be.bignumber.equal(
        new BN(new_expected_backing_per_gypsy)
      );
    });

    it("Investor successfully purchases Gypsy when there are 1 house and no cash reserves and the price of the home dropped", async () => {
      let before_balance = await usdgToken.balanceOf(reit.address);
      expect(before_balance).to.be.bignumber.equal(new BN(0));

      //make sure there are no homes yet
      let house_count = await homeNft.count();
      expect(house_count).to.be.bignumber.equal(new BN(0));

      //investor buys gypsy
      const INVESTMENT_MONEY = 10000;
      const INVESTMENT_MONEY_WITH_DECIMALS =
        INVESTMENT_MONEY * Math.pow(10, await usdgToken.decimals());

      const GYPSY_TOKEN_AMOUNT = INVESTMENT_MONEY / 100;
      const GYPSY_TOKEN_AMOUNT_WITH_DECIMALS =
        GYPSY_TOKEN_AMOUNT * Math.pow(10, await gpsyToken.decimals());
      //gives the investor the money to invest
      await usdgToken.mint(investor, new BN(INVESTMENT_MONEY_WITH_DECIMALS), {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.approve(
        reit.address,
        new BN(INVESTMENT_MONEY_WITH_DECIMALS),
        {
          from: investor,
          gas: 5000000,
          gasPrice: 500000000,
        }
      );

      await reit.buy(new BN(GYPSY_TOKEN_AMOUNT_WITH_DECIMALS), {
        from: investor,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //check if the investor has the Gypsy
      let investor_gypsy_balance = await gpsyToken.balanceOf(investor);
      expect(investor_gypsy_balance).to.be.bignumber.equal(
        new BN(GYPSY_TOKEN_AMOUNT_WITH_DECIMALS)
      );

      //check if REIT has the USDG
      let reit_usdg_balance = await usdgToken.balanceOf(reit.address);
      expect(reit_usdg_balance).to.be.bignumber.equal(
        new BN(INVESTMENT_MONEY_WITH_DECIMALS)
      );

      //check if the backing of Gypsy is $100
      let current_backing_per_gypsy = await reit.backingPerShare();
      let expected_backing_per_gypsy =
        100 * Math.pow(10, await gpsyToken.decimals());
      expect(current_backing_per_gypsy).to.be.bignumber.equal(
        new BN(expected_backing_per_gypsy)
      );

      //now the REIT buys a home which empties out the treasury so it has no reserves
      const HOME_VALUE = 10000;
      const HOME_VALUE_WITH_DECIMALS =
        HOME_VALUE * Math.pow(10, await usdgToken.decimals());

      //Now have the REIT purchase a home.
      const RENT_PRICE = 5000 * Math.pow(10, await usdgToken.decimals());

      //buy home
      await reit.addHome(HOME_DATA_URI, RENT_PRICE, HOME_VALUE_WITH_DECIMALS);

      //check we have the home
      let current_home_count = await reit.numberOfProperties();
      expect(current_home_count).to.be.bignumber.equal(new BN(1));

      //the price of the home drops 50% to 5000
      const NEW_HOME_VALUE = 5000;
      const NEW_HOME_VALUE_WITH_DECIMALS =
        NEW_HOME_VALUE * Math.pow(10, await usdgToken.decimals());

      await reit.appraiseHome(1, NEW_HOME_VALUE_WITH_DECIMALS);

      //check if the backing of Gypsy decreased 50%
      let new_current_backing_per_gypsy = await reit.backingPerShare();
      let new_expected_backing_per_gypsy = 50;
      let new_expected_backing_per_gypsy_with_decimals =
        new_expected_backing_per_gypsy *
        Math.pow(10, await usdgToken.decimals());
      expect(new_current_backing_per_gypsy).to.be.bignumber.equal(
        new BN(new_expected_backing_per_gypsy_with_decimals)
      );

      //now the investor buys more gypsy when the backing has changed
      //the investor buys the maximum Gypsy possible
      const NEW_GYPSY_TOKEN_AMOUNT =
        INVESTMENT_MONEY_WITH_DECIMALS / (await reit.backingPerShare());
      const NEW_GYPSY_TOKEN_AMOUNT_WITH_DECIMALS =
        NEW_GYPSY_TOKEN_AMOUNT * Math.pow(10, await gpsyToken.decimals());

      //gives the investor the money to invest
      await usdgToken.mint(investor, new BN(INVESTMENT_MONEY_WITH_DECIMALS), {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.approve(
        reit.address,
        new BN(INVESTMENT_MONEY_WITH_DECIMALS),
        {
          from: investor,
          gas: 5000000,
          gasPrice: 500000000,
        }
      );

      await reit.buy(new BN(NEW_GYPSY_TOKEN_AMOUNT_WITH_DECIMALS), {
        from: investor,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //check if the investor has the Gypsy
      let new_investor_gypsy_balance = await gpsyToken.balanceOf(investor);
      expect(new_investor_gypsy_balance).to.be.bignumber.equal(
        new BN(
          GYPSY_TOKEN_AMOUNT_WITH_DECIMALS +
            NEW_GYPSY_TOKEN_AMOUNT_WITH_DECIMALS
        )
      );

      //check if REIT has the USDG
      let new_reit_usdg_balance = await usdgToken.balanceOf(reit.address);
      expect(new_reit_usdg_balance).to.be.bignumber.equal(
        new BN(INVESTMENT_MONEY_WITH_DECIMALS)
      );
    });

    it("Investor successfully purchases Gypsy when there are 1 house and no cash reserves and the price of the home increased", async () => {
      let before_balance = await usdgToken.balanceOf(reit.address);
      expect(before_balance).to.be.bignumber.equal(new BN(0));

      //make sure there are no homes yet
      let house_count = await homeNft.count();
      expect(house_count).to.be.bignumber.equal(new BN(0));

      //investor buys gypsy
      const INVESTMENT_MONEY = 10000;
      const INVESTMENT_MONEY_WITH_DECIMALS =
        INVESTMENT_MONEY * Math.pow(10, await usdgToken.decimals());

      const GYPSY_TOKEN_AMOUNT = INVESTMENT_MONEY / 100;
      const GYPSY_TOKEN_AMOUNT_WITH_DECIMALS =
        GYPSY_TOKEN_AMOUNT * Math.pow(10, await gpsyToken.decimals());
      //gives the investor the money to invest
      await usdgToken.mint(investor, new BN(INVESTMENT_MONEY_WITH_DECIMALS), {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.approve(
        reit.address,
        new BN(INVESTMENT_MONEY_WITH_DECIMALS),
        {
          from: investor,
          gas: 5000000,
          gasPrice: 500000000,
        }
      );

      await reit.buy(new BN(GYPSY_TOKEN_AMOUNT_WITH_DECIMALS), {
        from: investor,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //check if the investor has the Gypsy
      let investor_gypsy_balance = await gpsyToken.balanceOf(investor);
      expect(investor_gypsy_balance).to.be.bignumber.equal(
        new BN(GYPSY_TOKEN_AMOUNT_WITH_DECIMALS)
      );

      //check if REIT has the USDG
      let reit_usdg_balance = await usdgToken.balanceOf(reit.address);
      expect(reit_usdg_balance).to.be.bignumber.equal(
        new BN(INVESTMENT_MONEY_WITH_DECIMALS)
      );

      //check if the backing of Gypsy is $100
      let current_backing_per_gypsy = await reit.backingPerShare();
      let expected_backing_per_gypsy =
        100 * Math.pow(10, await gpsyToken.decimals());
      expect(current_backing_per_gypsy).to.be.bignumber.equal(
        new BN(expected_backing_per_gypsy)
      );

      //now the REIT buys a home which leaves no reserves in the treasury
      const HOME_VALUE = 10000;
      const HOME_VALUE_WITH_DECIMALS =
        HOME_VALUE * Math.pow(10, await usdgToken.decimals());

      //Now have the REIT purchase a home.
      const RENT_PRICE = 5000 * Math.pow(10, await usdgToken.decimals());

      //buy home
      await reit.addHome(HOME_DATA_URI, RENT_PRICE, HOME_VALUE_WITH_DECIMALS);

      //check if we have the correct remaining USDG in the treasury
      let current_cash_reserves = await usdgToken.balanceOf(reit.address);
      let expected_cash_reserves =
        INVESTMENT_MONEY_WITH_DECIMALS - HOME_VALUE_WITH_DECIMALS;
      expect(current_cash_reserves).to.be.bignumber.equal(
        new BN(expected_cash_reserves)
      );

      //check we have the home
      let current_home_count = await reit.numberOfProperties();
      expect(current_home_count).to.be.bignumber.equal(new BN(1));

      //the price of the home increases
      const NEW_HOME_VALUE = 16000;
      const NEW_HOME_VALUE_WITH_DECIMALS =
        NEW_HOME_VALUE * Math.pow(10, await usdgToken.decimals());

      await reit.appraiseHome(1, NEW_HOME_VALUE_WITH_DECIMALS);

      //check if the backing of Gypsy increased
      let new_current_backing_per_gypsy = await reit.backingPerShare();
      let new_expected_backing_per_gypsy = 160;
      let new_expected_backing_per_gypsy_with_decimals =
        new_expected_backing_per_gypsy *
        Math.pow(10, await usdgToken.decimals());
      expect(new_current_backing_per_gypsy).to.be.bignumber.equal(
        new BN(new_expected_backing_per_gypsy_with_decimals)
      );

      //now the investor buys more gypsy when the backing has changed
      //the investor buys the maximum Gypsy possible
      const NEW_GYPSY_TOKEN_AMOUNT =
        INVESTMENT_MONEY_WITH_DECIMALS / (await reit.backingPerShare());
      const NEW_GYPSY_TOKEN_AMOUNT_WITH_DECIMALS =
        NEW_GYPSY_TOKEN_AMOUNT * Math.pow(10, await gpsyToken.decimals());

      //gives the investor the money to invest
      await usdgToken.mint(investor, new BN(INVESTMENT_MONEY_WITH_DECIMALS), {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.approve(
        reit.address,
        new BN(INVESTMENT_MONEY_WITH_DECIMALS),
        {
          from: investor,
          gas: 5000000,
          gasPrice: 500000000,
        }
      );

      await reit.buy(new BN(NEW_GYPSY_TOKEN_AMOUNT_WITH_DECIMALS), {
        from: investor,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //check if the investor has the Gypsy
      let new_investor_gypsy_balance = await gpsyToken.balanceOf(investor);
      expect(new_investor_gypsy_balance).to.be.bignumber.equal(
        new BN(
          GYPSY_TOKEN_AMOUNT_WITH_DECIMALS +
            NEW_GYPSY_TOKEN_AMOUNT_WITH_DECIMALS
        )
      );
      //check if REIT has the USDG
      let new_reit_usdg_balance = await usdgToken.balanceOf(reit.address);
      let expected_new_reit_usdg_balance =
        parseInt(INVESTMENT_MONEY_WITH_DECIMALS) +
        parseInt(current_cash_reserves);

      expect(new_reit_usdg_balance).to.be.bignumber.equal(
        new BN(expected_new_reit_usdg_balance)
      );
    });

    it("Investor successfully purchases Gypsy when there are 1 house and cash reserves and the price of the home dropped", async () => {
      let before_balance = await usdgToken.balanceOf(reit.address);
      expect(before_balance).to.be.bignumber.equal(new BN(0));

      //make sure there are no homes yet
      let house_count = await homeNft.count();
      expect(house_count).to.be.bignumber.equal(new BN(0));

      //investor buys gypsy
      const INVESTMENT_MONEY = 10000;
      const INVESTMENT_MONEY_WITH_DECIMALS =
        INVESTMENT_MONEY * Math.pow(10, await usdgToken.decimals());

      const GYPSY_TOKEN_AMOUNT = INVESTMENT_MONEY / 100;
      const GYPSY_TOKEN_AMOUNT_WITH_DECIMALS =
        GYPSY_TOKEN_AMOUNT * Math.pow(10, await gpsyToken.decimals());
      //gives the investor the money to invest
      await usdgToken.mint(investor, new BN(INVESTMENT_MONEY_WITH_DECIMALS), {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.approve(
        reit.address,
        new BN(INVESTMENT_MONEY_WITH_DECIMALS),
        {
          from: investor,
          gas: 5000000,
          gasPrice: 500000000,
        }
      );

      await reit.buy(new BN(GYPSY_TOKEN_AMOUNT_WITH_DECIMALS), {
        from: investor,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //check if the investor has the Gypsy
      let investor_gypsy_balance = await gpsyToken.balanceOf(investor);
      expect(investor_gypsy_balance).to.be.bignumber.equal(
        new BN(GYPSY_TOKEN_AMOUNT_WITH_DECIMALS)
      );

      //check if REIT has the USDG
      let reit_usdg_balance = await usdgToken.balanceOf(reit.address);
      expect(reit_usdg_balance).to.be.bignumber.equal(
        new BN(INVESTMENT_MONEY_WITH_DECIMALS)
      );

      //check if the backing of Gypsy is $100
      let current_backing_per_gypsy = await reit.backingPerShare();
      let expected_backing_per_gypsy =
        100 * Math.pow(10, await gpsyToken.decimals());
      expect(current_backing_per_gypsy).to.be.bignumber.equal(
        new BN(expected_backing_per_gypsy)
      );

      //now the REIT buys a home which leaves reserves in the treasury
      const HOME_VALUE = 8000;
      const HOME_VALUE_WITH_DECIMALS =
        HOME_VALUE * Math.pow(10, await usdgToken.decimals());

      //Now have the REIT purchase a home.
      const RENT_PRICE = 5000 * Math.pow(10, await usdgToken.decimals());

      //buy home
      await reit.addHome(HOME_DATA_URI, RENT_PRICE, HOME_VALUE_WITH_DECIMALS);

      //check if we have the correct remaining USDG in the treasury
      let current_cash_reserves = await usdgToken.balanceOf(reit.address);
      let expected_cash_reserves =
        INVESTMENT_MONEY_WITH_DECIMALS - HOME_VALUE_WITH_DECIMALS;
      expect(current_cash_reserves).to.be.bignumber.equal(
        new BN(expected_cash_reserves)
      );

      //check we have the home
      let current_home_count = await reit.numberOfProperties();
      expect(current_home_count).to.be.bignumber.equal(new BN(1));

      //the price of the home drops
      const NEW_HOME_VALUE = 6000;
      const NEW_HOME_VALUE_WITH_DECIMALS =
        NEW_HOME_VALUE * Math.pow(10, await usdgToken.decimals());

      await reit.appraiseHome(1, NEW_HOME_VALUE_WITH_DECIMALS);

      //check if the backing of Gypsy decreased
      let new_current_backing_per_gypsy = await reit.backingPerShare();
      let new_expected_backing_per_gypsy = 80;
      let new_expected_backing_per_gypsy_with_decimals =
        new_expected_backing_per_gypsy *
        Math.pow(10, await usdgToken.decimals());
      expect(new_current_backing_per_gypsy).to.be.bignumber.equal(
        new BN(new_expected_backing_per_gypsy_with_decimals)
      );

      //now the investor buys more gypsy when the backing has changed
      //the investor buys the maximum Gypsy possible
      const NEW_GYPSY_TOKEN_AMOUNT =
        INVESTMENT_MONEY_WITH_DECIMALS / (await reit.backingPerShare());
      const NEW_GYPSY_TOKEN_AMOUNT_WITH_DECIMALS =
        NEW_GYPSY_TOKEN_AMOUNT * Math.pow(10, await gpsyToken.decimals());

      //gives the investor the money to invest
      await usdgToken.mint(investor, new BN(INVESTMENT_MONEY_WITH_DECIMALS), {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.approve(
        reit.address,
        new BN(INVESTMENT_MONEY_WITH_DECIMALS),
        {
          from: investor,
          gas: 5000000,
          gasPrice: 500000000,
        }
      );

      await reit.buy(new BN(NEW_GYPSY_TOKEN_AMOUNT_WITH_DECIMALS), {
        from: investor,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //check if the investor has the Gypsy
      let new_investor_gypsy_balance = await gpsyToken.balanceOf(investor);
      expect(new_investor_gypsy_balance).to.be.bignumber.equal(
        new BN(
          GYPSY_TOKEN_AMOUNT_WITH_DECIMALS +
            NEW_GYPSY_TOKEN_AMOUNT_WITH_DECIMALS
        )
      );

      //check if REIT has the USDG
      let new_reit_usdg_balance = await usdgToken.balanceOf(reit.address);
      let expected_new_reit_usdg_balance =
        parseInt(INVESTMENT_MONEY_WITH_DECIMALS) +
        parseInt(current_cash_reserves);
      expect(new_reit_usdg_balance).to.be.bignumber.equal(
        new BN(expected_new_reit_usdg_balance)
      );
    });

    it("Investor successfully purchases Gypsy when there are 1 house and cash reserves and the price of the home increased", async () => {
      let before_balance = await usdgToken.balanceOf(reit.address);
      expect(before_balance).to.be.bignumber.equal(new BN(0));

      //make sure there are no homes yet
      let house_count = await homeNft.count();
      expect(house_count).to.be.bignumber.equal(new BN(0));

      //investor buys gypsy
      const INVESTMENT_MONEY = 10000;
      const INVESTMENT_MONEY_WITH_DECIMALS =
        INVESTMENT_MONEY * Math.pow(10, await usdgToken.decimals());

      const GYPSY_TOKEN_AMOUNT = INVESTMENT_MONEY / 100;
      const GYPSY_TOKEN_AMOUNT_WITH_DECIMALS =
        GYPSY_TOKEN_AMOUNT * Math.pow(10, await gpsyToken.decimals());
      //gives the investor the money to invest
      await usdgToken.mint(investor, new BN(INVESTMENT_MONEY_WITH_DECIMALS), {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.approve(
        reit.address,
        new BN(INVESTMENT_MONEY_WITH_DECIMALS),
        {
          from: investor,
          gas: 5000000,
          gasPrice: 500000000,
        }
      );

      await reit.buy(new BN(GYPSY_TOKEN_AMOUNT_WITH_DECIMALS), {
        from: investor,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //check if the investor has the Gypsy
      let investor_gypsy_balance = await gpsyToken.balanceOf(investor);
      expect(investor_gypsy_balance).to.be.bignumber.equal(
        new BN(GYPSY_TOKEN_AMOUNT_WITH_DECIMALS)
      );

      //check if REIT has the USDG
      let reit_usdg_balance = await usdgToken.balanceOf(reit.address);
      expect(reit_usdg_balance).to.be.bignumber.equal(
        new BN(INVESTMENT_MONEY_WITH_DECIMALS)
      );

      //check if the backing of Gypsy is $100
      let current_backing_per_gypsy = await reit.backingPerShare();
      let expected_backing_per_gypsy =
        100 * Math.pow(10, await gpsyToken.decimals());
      expect(current_backing_per_gypsy).to.be.bignumber.equal(
        new BN(expected_backing_per_gypsy)
      );

      //now the REIT buys a home which leaves reserves in the treasury
      const HOME_VALUE = 8000;
      const HOME_VALUE_WITH_DECIMALS =
        HOME_VALUE * Math.pow(10, await usdgToken.decimals());

      //Now have the REIT purchase a home.
      const RENT_PRICE = 5000 * Math.pow(10, await usdgToken.decimals());

      //buy home
      await reit.addHome(HOME_DATA_URI, RENT_PRICE, HOME_VALUE_WITH_DECIMALS);

      //check if we have the correct remaining USDG in the treasury
      let current_cash_reserves = await usdgToken.balanceOf(reit.address);
      let expected_cash_reserves =
        INVESTMENT_MONEY_WITH_DECIMALS - HOME_VALUE_WITH_DECIMALS;
      expect(current_cash_reserves).to.be.bignumber.equal(
        new BN(expected_cash_reserves)
      );

      //check we have the home
      let current_home_count = await reit.numberOfProperties();
      expect(current_home_count).to.be.bignumber.equal(new BN(1));

      //the price of the home increases
      const NEW_HOME_VALUE = 14000;
      const NEW_HOME_VALUE_WITH_DECIMALS =
        NEW_HOME_VALUE * Math.pow(10, await usdgToken.decimals());

      await reit.appraiseHome(1, NEW_HOME_VALUE_WITH_DECIMALS);

      //check if the backing of Gypsy increased
      let new_current_backing_per_gypsy = await reit.backingPerShare();
      let new_expected_backing_per_gypsy = 160;
      let new_expected_backing_per_gypsy_with_decimals =
        new_expected_backing_per_gypsy *
        Math.pow(10, await usdgToken.decimals());
      expect(new_current_backing_per_gypsy).to.be.bignumber.equal(
        new BN(new_expected_backing_per_gypsy_with_decimals)
      );

      //now the investor buys more gypsy when the backing has changed
      //the investor buys the maximum Gypsy possible
      const NEW_GYPSY_TOKEN_AMOUNT =
        INVESTMENT_MONEY_WITH_DECIMALS / (await reit.backingPerShare());
      const NEW_GYPSY_TOKEN_AMOUNT_WITH_DECIMALS =
        NEW_GYPSY_TOKEN_AMOUNT * Math.pow(10, await gpsyToken.decimals());

      //gives the investor the money to invest
      await usdgToken.mint(investor, new BN(INVESTMENT_MONEY_WITH_DECIMALS), {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.approve(
        reit.address,
        new BN(INVESTMENT_MONEY_WITH_DECIMALS),
        {
          from: investor,
          gas: 5000000,
          gasPrice: 500000000,
        }
      );

      await reit.buy(new BN(NEW_GYPSY_TOKEN_AMOUNT_WITH_DECIMALS), {
        from: investor,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //check if the investor has the Gypsy
      let new_investor_gypsy_balance = await gpsyToken.balanceOf(investor);
      expect(new_investor_gypsy_balance).to.be.bignumber.equal(
        new BN(
          GYPSY_TOKEN_AMOUNT_WITH_DECIMALS +
            NEW_GYPSY_TOKEN_AMOUNT_WITH_DECIMALS
        )
      );

      //check if REIT has the USDG
      let new_reit_usdg_balance = await usdgToken.balanceOf(reit.address);
      let expected_new_reit_usdg_balance =
        parseInt(INVESTMENT_MONEY_WITH_DECIMALS) +
        parseInt(current_cash_reserves);

      let bn_expected_new_reit_usdg_balance = new BN(
        expected_new_reit_usdg_balance
      );

      expect(new_reit_usdg_balance).to.be.bignumber.equal(
        bn_expected_new_reit_usdg_balance
      );
    });

    it("Investor successfully purchases Gypsy when there are multiple houses and no cash reserves", async () => {
      let before_balance = await usdgToken.balanceOf(reit.address);
      expect(before_balance).to.be.bignumber.equal(new BN(0));

      //make sure there are no homes yet
      let house_count = await homeNft.count();
      expect(house_count).to.be.bignumber.equal(new BN(0));

      //investor buys gypsy
      const INVESTMENT_MONEY = 30000;
      const INVESTMENT_MONEY_WITH_DECIMALS =
        INVESTMENT_MONEY * Math.pow(10, await usdgToken.decimals());

      const GYPSY_TOKEN_AMOUNT = INVESTMENT_MONEY / 100;
      const GYPSY_TOKEN_AMOUNT_WITH_DECIMALS =
        GYPSY_TOKEN_AMOUNT * Math.pow(10, await gpsyToken.decimals());
      //gives the investor the money to invest
      await usdgToken.mint(investor, new BN(INVESTMENT_MONEY_WITH_DECIMALS), {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.approve(
        reit.address,
        new BN(INVESTMENT_MONEY_WITH_DECIMALS),
        {
          from: investor,
          gas: 5000000,
          gasPrice: 500000000,
        }
      );

      await reit.buy(new BN(GYPSY_TOKEN_AMOUNT_WITH_DECIMALS), {
        from: investor,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //check if the investor has the Gypsy
      let investor_gypsy_balance = await gpsyToken.balanceOf(investor);
      expect(investor_gypsy_balance).to.be.bignumber.equal(
        new BN(GYPSY_TOKEN_AMOUNT_WITH_DECIMALS)
      );

      //check if REIT has the USDG
      let reit_usdg_balance = await usdgToken.balanceOf(reit.address);
      expect(reit_usdg_balance).to.be.bignumber.equal(
        new BN(INVESTMENT_MONEY_WITH_DECIMALS)
      );

      //check if the backing of Gypsy is $100
      let current_backing_per_gypsy = await reit.backingPerShare();
      let expected_backing_per_gypsy =
        100 * Math.pow(10, await gpsyToken.decimals());
      expect(current_backing_per_gypsy).to.be.bignumber.equal(
        new BN(expected_backing_per_gypsy)
      );

      //now the REIT buys a home which empties out the treasury so it has no reserves
      const HOME_ONE_VALUE = 10000;
      const HOME_ONE_VALUE_WITH_DECIMALS =
        HOME_ONE_VALUE * Math.pow(10, await usdgToken.decimals());

      const HOME_TWO_VALUE = 15000;
      const HOME_TWO_VALUE_WITH_DECIMALS =
        HOME_TWO_VALUE * Math.pow(10, await usdgToken.decimals());

      const HOME_THREE_VALUE = 5000;
      const HOME_THREE_VALUE_WITH_DECIMALS =
        HOME_THREE_VALUE * Math.pow(10, await usdgToken.decimals());

      //Now have the REIT purchase a home.
      const RENT_PRICE = 5000 * Math.pow(10, await usdgToken.decimals());

      //buy home #1
      await reit.addHome(
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_ONE_VALUE_WITH_DECIMALS
      );

      //buy home #2
      await reit.addHome(
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_TWO_VALUE_WITH_DECIMALS
      );

      //buy home #3
      await reit.addHome(
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_THREE_VALUE_WITH_DECIMALS
      );

      //check we have the home
      let current_home_count = await reit.numberOfProperties();
      expect(current_home_count).to.be.bignumber.equal(new BN(3));

      //now the investor buys more gypsy when the backing hasnt changed

      //gives the investor the money to invest
      await usdgToken.mint(investor, new BN(INVESTMENT_MONEY_WITH_DECIMALS), {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.approve(
        reit.address,
        new BN(INVESTMENT_MONEY_WITH_DECIMALS),
        {
          from: investor,
          gas: 5000000,
          gasPrice: 500000000,
        }
      );

      await reit.buy(new BN(GYPSY_TOKEN_AMOUNT_WITH_DECIMALS), {
        from: investor,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //check if the investor has the Gypsy
      let new_investor_gypsy_balance = await gpsyToken.balanceOf(investor);
      expect(new_investor_gypsy_balance).to.be.bignumber.equal(
        new BN(GYPSY_TOKEN_AMOUNT_WITH_DECIMALS * 2)
      );

      //check if REIT has the USDG
      let new_reit_usdg_balance = await usdgToken.balanceOf(reit.address);
      expect(new_reit_usdg_balance).to.be.bignumber.equal(
        new BN(INVESTMENT_MONEY_WITH_DECIMALS)
      );

      //check if the backing of Gypsy is still $100
      let new_current_backing_per_gypsy = await reit.backingPerShare();
      let new_expected_backing_per_gypsy =
        100 * Math.pow(10, await usdgToken.decimals());
      expect(new_current_backing_per_gypsy).to.be.bignumber.equal(
        new BN(new_expected_backing_per_gypsy)
      );
    });

    it("Investor successfully purchases Gypsy when there are multiple houses and cash reserves", async () => {
      let before_balance = await usdgToken.balanceOf(reit.address);
      expect(before_balance).to.be.bignumber.equal(new BN(0));

      //make sure there are no homes yet
      let house_count = await homeNft.count();
      expect(house_count).to.be.bignumber.equal(new BN(0));

      //investor buys gypsy
      const INVESTMENT_MONEY = 30000;
      const INVESTMENT_MONEY_WITH_DECIMALS =
        INVESTMENT_MONEY * Math.pow(10, await usdgToken.decimals());

      const GYPSY_TOKEN_AMOUNT = INVESTMENT_MONEY / 100;
      const GYPSY_TOKEN_AMOUNT_WITH_DECIMALS =
        GYPSY_TOKEN_AMOUNT * Math.pow(10, await gpsyToken.decimals());
      //gives the investor the money to invest
      await usdgToken.mint(investor, new BN(INVESTMENT_MONEY_WITH_DECIMALS), {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.approve(
        reit.address,
        new BN(INVESTMENT_MONEY_WITH_DECIMALS),
        {
          from: investor,
          gas: 5000000,
          gasPrice: 500000000,
        }
      );

      await reit.buy(new BN(GYPSY_TOKEN_AMOUNT_WITH_DECIMALS), {
        from: investor,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //check if the investor has the Gypsy
      let investor_gypsy_balance = await gpsyToken.balanceOf(investor);
      expect(investor_gypsy_balance).to.be.bignumber.equal(
        new BN(GYPSY_TOKEN_AMOUNT_WITH_DECIMALS)
      );

      //check if REIT has the USDG
      let reit_usdg_balance = await usdgToken.balanceOf(reit.address);
      expect(reit_usdg_balance).to.be.bignumber.equal(
        new BN(INVESTMENT_MONEY_WITH_DECIMALS)
      );

      //check if the backing of Gypsy is $100
      let current_backing_per_gypsy = await reit.backingPerShare();
      let expected_backing_per_gypsy =
        100 * Math.pow(10, await gpsyToken.decimals());
      expect(current_backing_per_gypsy).to.be.bignumber.equal(
        new BN(expected_backing_per_gypsy)
      );

      //now the REIT buys a home which empties out the treasury so it has no reserves
      const HOME_ONE_VALUE = 9000;
      const HOME_ONE_VALUE_WITH_DECIMALS =
        HOME_ONE_VALUE * Math.pow(10, await usdgToken.decimals());

      const HOME_TWO_VALUE = 14000;
      const HOME_TWO_VALUE_WITH_DECIMALS =
        HOME_TWO_VALUE * Math.pow(10, await usdgToken.decimals());

      const HOME_THREE_VALUE = 4000;
      const HOME_THREE_VALUE_WITH_DECIMALS =
        HOME_THREE_VALUE * Math.pow(10, await usdgToken.decimals());

      //Now have the REIT purchase a home.
      const RENT_PRICE = 5000 * Math.pow(10, await usdgToken.decimals());

      //buy home #1
      await reit.addHome(
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_ONE_VALUE_WITH_DECIMALS
      );

      //buy home #2
      await reit.addHome(
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_TWO_VALUE_WITH_DECIMALS
      );

      //buy home #3
      await reit.addHome(
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_THREE_VALUE_WITH_DECIMALS
      );

      //check we have the home
      let current_home_count = await reit.numberOfProperties();
      expect(current_home_count).to.be.bignumber.equal(new BN(3));

      //now the investor buys more gypsy when the backing hasnt changed

      //gives the investor the money to invest
      await usdgToken.mint(investor, new BN(INVESTMENT_MONEY_WITH_DECIMALS), {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.approve(
        reit.address,
        new BN(INVESTMENT_MONEY_WITH_DECIMALS),
        {
          from: investor,
          gas: 5000000,
          gasPrice: 500000000,
        }
      );

      await reit.buy(new BN(GYPSY_TOKEN_AMOUNT_WITH_DECIMALS), {
        from: investor,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //check if the investor has the Gypsy
      let new_investor_gypsy_balance = await gpsyToken.balanceOf(investor);
      expect(new_investor_gypsy_balance).to.be.bignumber.equal(
        new BN(GYPSY_TOKEN_AMOUNT_WITH_DECIMALS * 2)
      );

      //check if REIT has the USDG
      let new_reit_usdg_balance = await usdgToken.balanceOf(reit.address);
      let expected_new_reit_usdg_balance =
        INVESTMENT_MONEY_WITH_DECIMALS +
        3000 * Math.pow(10, await usdgToken.decimals());
      expect(new_reit_usdg_balance).to.be.bignumber.equal(
        new BN(expected_new_reit_usdg_balance)
      );

      //check if the backing of Gypsy is still $100
      let new_current_backing_per_gypsy = await reit.backingPerShare();
      let new_expected_backing_per_gypsy =
        100 * Math.pow(10, await usdgToken.decimals());
      expect(new_current_backing_per_gypsy).to.be.bignumber.equal(
        new BN(new_expected_backing_per_gypsy)
      );
    });

    it("Investor successfully purchases Gypsy when there are multiple houses and no cash reserves", async () => {
      let before_balance = await usdgToken.balanceOf(reit.address);
      expect(before_balance).to.be.bignumber.equal(new BN(0));

      //make sure there are no homes yet
      let house_count = await homeNft.count();
      expect(house_count).to.be.bignumber.equal(new BN(0));

      //investor buys gypsy
      const INVESTMENT_MONEY = 30000;
      const INVESTMENT_MONEY_WITH_DECIMALS =
        INVESTMENT_MONEY * Math.pow(10, await usdgToken.decimals());

      const GYPSY_TOKEN_AMOUNT = INVESTMENT_MONEY / 100;
      const GYPSY_TOKEN_AMOUNT_WITH_DECIMALS =
        GYPSY_TOKEN_AMOUNT * Math.pow(10, await gpsyToken.decimals());
      //gives the investor the money to invest
      await usdgToken.mint(investor, new BN(INVESTMENT_MONEY_WITH_DECIMALS), {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.approve(
        reit.address,
        new BN(INVESTMENT_MONEY_WITH_DECIMALS),
        {
          from: investor,
          gas: 5000000,
          gasPrice: 500000000,
        }
      );

      await reit.buy(new BN(GYPSY_TOKEN_AMOUNT_WITH_DECIMALS), {
        from: investor,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //check if the investor has the Gypsy
      let investor_gypsy_balance = await gpsyToken.balanceOf(investor);
      expect(investor_gypsy_balance).to.be.bignumber.equal(
        new BN(GYPSY_TOKEN_AMOUNT_WITH_DECIMALS)
      );

      //check if REIT has the USDG
      let reit_usdg_balance = await usdgToken.balanceOf(reit.address);
      expect(reit_usdg_balance).to.be.bignumber.equal(
        new BN(INVESTMENT_MONEY_WITH_DECIMALS)
      );

      //check if the backing of Gypsy is $100
      let current_backing_per_gypsy = await reit.backingPerShare();
      let expected_backing_per_gypsy =
        100 * Math.pow(10, await gpsyToken.decimals());
      expect(current_backing_per_gypsy).to.be.bignumber.equal(
        new BN(expected_backing_per_gypsy)
      );

      //now the REIT buys a home which empties out the treasury so it has no reserves
      const HOME_ONE_VALUE = 10000;
      const HOME_ONE_VALUE_WITH_DECIMALS =
        HOME_ONE_VALUE * Math.pow(10, await usdgToken.decimals());

      const HOME_TWO_VALUE = 15000;
      const HOME_TWO_VALUE_WITH_DECIMALS =
        HOME_TWO_VALUE * Math.pow(10, await usdgToken.decimals());

      const HOME_THREE_VALUE = 5000;
      const HOME_THREE_VALUE_WITH_DECIMALS =
        HOME_THREE_VALUE * Math.pow(10, await usdgToken.decimals());

      //Now have the REIT purchase a home.
      const RENT_PRICE = 5000 * Math.pow(10, await usdgToken.decimals());

      //buy home #1
      await reit.addHome(
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_ONE_VALUE_WITH_DECIMALS
      );

      //buy home #2
      await reit.addHome(
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_TWO_VALUE_WITH_DECIMALS
      );

      //buy home #3
      await reit.addHome(
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_THREE_VALUE_WITH_DECIMALS
      );

      //check we have the home
      let current_home_count = await reit.numberOfProperties();
      expect(current_home_count).to.be.bignumber.equal(new BN(3));

      //now the investor buys more gypsy when the backing hasnt changed

      //gives the investor the money to invest
      await usdgToken.mint(investor, new BN(INVESTMENT_MONEY_WITH_DECIMALS), {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.approve(
        reit.address,
        new BN(INVESTMENT_MONEY_WITH_DECIMALS),
        {
          from: investor,
          gas: 5000000,
          gasPrice: 500000000,
        }
      );

      await reit.buy(new BN(GYPSY_TOKEN_AMOUNT_WITH_DECIMALS), {
        from: investor,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //check if the investor has the Gypsy
      let new_investor_gypsy_balance = await gpsyToken.balanceOf(investor);
      expect(new_investor_gypsy_balance).to.be.bignumber.equal(
        new BN(GYPSY_TOKEN_AMOUNT_WITH_DECIMALS * 2)
      );

      //check if REIT has the USDG
      let new_reit_usdg_balance = await usdgToken.balanceOf(reit.address);
      expect(new_reit_usdg_balance).to.be.bignumber.equal(
        new BN(INVESTMENT_MONEY_WITH_DECIMALS)
      );

      //check if the backing of Gypsy is still $100
      let new_current_backing_per_gypsy = await reit.backingPerShare();
      let new_expected_backing_per_gypsy =
        100 * Math.pow(10, await usdgToken.decimals());
      expect(new_current_backing_per_gypsy).to.be.bignumber.equal(
        new BN(new_expected_backing_per_gypsy)
      );
    });

    it("Investor successfully purchases Gypsy when there are multiple houses and cash reserves", async () => {
      let before_balance = await usdgToken.balanceOf(reit.address);
      expect(before_balance).to.be.bignumber.equal(new BN(0));

      //make sure there are no homes yet
      let house_count = await homeNft.count();
      expect(house_count).to.be.bignumber.equal(new BN(0));

      //investor buys gypsy
      const INVESTMENT_MONEY = 30000;
      const INVESTMENT_MONEY_WITH_DECIMALS =
        INVESTMENT_MONEY * Math.pow(10, await usdgToken.decimals());

      const GYPSY_TOKEN_AMOUNT = INVESTMENT_MONEY / 100;
      const GYPSY_TOKEN_AMOUNT_WITH_DECIMALS =
        GYPSY_TOKEN_AMOUNT * Math.pow(10, await gpsyToken.decimals());
      //gives the investor the money to invest
      await usdgToken.mint(investor, new BN(INVESTMENT_MONEY_WITH_DECIMALS), {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.approve(
        reit.address,
        new BN(INVESTMENT_MONEY_WITH_DECIMALS),
        {
          from: investor,
          gas: 5000000,
          gasPrice: 500000000,
        }
      );

      await reit.buy(new BN(GYPSY_TOKEN_AMOUNT_WITH_DECIMALS), {
        from: investor,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //check if the investor has the Gypsy
      let investor_gypsy_balance = await gpsyToken.balanceOf(investor);
      expect(investor_gypsy_balance).to.be.bignumber.equal(
        new BN(GYPSY_TOKEN_AMOUNT_WITH_DECIMALS)
      );

      //check if REIT has the USDG
      let reit_usdg_balance = await usdgToken.balanceOf(reit.address);
      expect(reit_usdg_balance).to.be.bignumber.equal(
        new BN(INVESTMENT_MONEY_WITH_DECIMALS)
      );

      //check if the backing of Gypsy is $100
      let current_backing_per_gypsy = await reit.backingPerShare();
      let expected_backing_per_gypsy =
        100 * Math.pow(10, await gpsyToken.decimals());
      expect(current_backing_per_gypsy).to.be.bignumber.equal(
        new BN(expected_backing_per_gypsy)
      );

      //now the REIT buys a home which empties out the treasury so it has no reserves
      const HOME_ONE_VALUE = 9000;
      const HOME_ONE_VALUE_WITH_DECIMALS =
        HOME_ONE_VALUE * Math.pow(10, await usdgToken.decimals());

      const HOME_TWO_VALUE = 14000;
      const HOME_TWO_VALUE_WITH_DECIMALS =
        HOME_TWO_VALUE * Math.pow(10, await usdgToken.decimals());

      const HOME_THREE_VALUE = 4000;
      const HOME_THREE_VALUE_WITH_DECIMALS =
        HOME_THREE_VALUE * Math.pow(10, await usdgToken.decimals());

      //Now have the REIT purchase a home.
      const RENT_PRICE = 5000 * Math.pow(10, await usdgToken.decimals());

      //buy home #1
      await reit.addHome(
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_ONE_VALUE_WITH_DECIMALS
      );

      //buy home #2
      await reit.addHome(
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_TWO_VALUE_WITH_DECIMALS
      );

      //buy home #3
      await reit.addHome(
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_THREE_VALUE_WITH_DECIMALS
      );

      //check we have the home
      let current_home_count = await reit.numberOfProperties();
      expect(current_home_count).to.be.bignumber.equal(new BN(3));

      //now the investor buys more gypsy when the backing hasnt changed

      //gives the investor the money to invest
      await usdgToken.mint(investor, new BN(INVESTMENT_MONEY_WITH_DECIMALS), {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.approve(
        reit.address,
        new BN(INVESTMENT_MONEY_WITH_DECIMALS),
        {
          from: investor,
          gas: 5000000,
          gasPrice: 500000000,
        }
      );

      await reit.buy(new BN(GYPSY_TOKEN_AMOUNT_WITH_DECIMALS), {
        from: investor,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //check if the investor has the Gypsy
      let new_investor_gypsy_balance = await gpsyToken.balanceOf(investor);
      expect(new_investor_gypsy_balance).to.be.bignumber.equal(
        new BN(GYPSY_TOKEN_AMOUNT_WITH_DECIMALS * 2)
      );

      //check if REIT has the USDG
      let new_reit_usdg_balance = await usdgToken.balanceOf(reit.address);
      let expected_new_reit_usdg_balance =
        INVESTMENT_MONEY_WITH_DECIMALS +
        3000 * Math.pow(10, await usdgToken.decimals());
      expect(new_reit_usdg_balance).to.be.bignumber.equal(
        new BN(expected_new_reit_usdg_balance)
      );

      //check if the backing of Gypsy is still $100
      let new_current_backing_per_gypsy = await reit.backingPerShare();
      let new_expected_backing_per_gypsy =
        100 * Math.pow(10, await usdgToken.decimals());
      expect(new_current_backing_per_gypsy).to.be.bignumber.equal(
        new BN(new_expected_backing_per_gypsy)
      );
    });

    it("Investor successfully purchases Gypsy when there are multiple houses and no cash reserves and the price of all go up", async () => {
      let before_balance = await usdgToken.balanceOf(reit.address);
      expect(before_balance).to.be.bignumber.equal(new BN(0));

      //make sure there are no homes yet
      let house_count = await homeNft.count();
      expect(house_count).to.be.bignumber.equal(new BN(0));

      //investor buys gypsy
      const INVESTMENT_MONEY = 30000;
      const INVESTMENT_MONEY_WITH_DECIMALS =
        INVESTMENT_MONEY * Math.pow(10, await usdgToken.decimals());

      const GYPSY_TOKEN_AMOUNT = INVESTMENT_MONEY / 100;
      const GYPSY_TOKEN_AMOUNT_WITH_DECIMALS =
        GYPSY_TOKEN_AMOUNT * Math.pow(10, await gpsyToken.decimals());
      //gives the investor the money to invest
      await usdgToken.mint(investor, new BN(INVESTMENT_MONEY_WITH_DECIMALS), {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.approve(
        reit.address,
        new BN(INVESTMENT_MONEY_WITH_DECIMALS),
        {
          from: investor,
          gas: 5000000,
          gasPrice: 500000000,
        }
      );

      await reit.buy(new BN(GYPSY_TOKEN_AMOUNT_WITH_DECIMALS), {
        from: investor,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //check if the investor has the Gypsy
      let investor_gypsy_balance = await gpsyToken.balanceOf(investor);
      expect(investor_gypsy_balance).to.be.bignumber.equal(
        new BN(GYPSY_TOKEN_AMOUNT_WITH_DECIMALS)
      );

      //check if REIT has the USDG
      let reit_usdg_balance = await usdgToken.balanceOf(reit.address);
      expect(reit_usdg_balance).to.be.bignumber.equal(
        new BN(INVESTMENT_MONEY_WITH_DECIMALS)
      );

      //check if the backing of Gypsy is $100
      let current_backing_per_gypsy = await reit.backingPerShare();
      let expected_backing_per_gypsy =
        100 * Math.pow(10, await gpsyToken.decimals());
      expect(current_backing_per_gypsy).to.be.bignumber.equal(
        new BN(expected_backing_per_gypsy)
      );

      //now the REIT buys a home which empties out the treasury so it has no reserves
      const HOME_ONE_VALUE = 10000;
      const HOME_ONE_VALUE_WITH_DECIMALS =
        HOME_ONE_VALUE * Math.pow(10, await usdgToken.decimals());

      const HOME_TWO_VALUE = 15000;
      const HOME_TWO_VALUE_WITH_DECIMALS =
        HOME_TWO_VALUE * Math.pow(10, await usdgToken.decimals());

      const HOME_THREE_VALUE = 5000;
      const HOME_THREE_VALUE_WITH_DECIMALS =
        HOME_THREE_VALUE * Math.pow(10, await usdgToken.decimals());

      //Now have the REIT purchase a home.
      const RENT_PRICE = 5000 * Math.pow(10, await usdgToken.decimals());

      //buy home #1
      await reit.addHome(
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_ONE_VALUE_WITH_DECIMALS
      );

      //buy home #2
      await reit.addHome(
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_TWO_VALUE_WITH_DECIMALS
      );

      //buy home #3
      await reit.addHome(
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_THREE_VALUE_WITH_DECIMALS
      );

      //check we have the home
      let current_home_count = await reit.numberOfProperties();
      expect(current_home_count).to.be.bignumber.equal(new BN(3));

      //check if the backing of Gypsy is still $100
      let new_current_backing_per_gypsy = await reit.backingPerShare();
      let new_expected_backing_per_gypsy =
        100 * Math.pow(10, await usdgToken.decimals());
      expect(new_current_backing_per_gypsy).to.be.bignumber.equal(
        new BN(new_expected_backing_per_gypsy)
      );

      //now the price of all three homes goes up
      const NEW_HOME_ONE_PRICE = 12000;
      const NEW_HOME_ONE_PRICE_WITH_DECIMALS =
        NEW_HOME_ONE_PRICE * Math.pow(10, await usdgToken.decimals());

      const NEW_HOME_TWO_PRICE = 20000;
      const NEW_HOME_TWO_PRICE_WITH_DECIMALS =
        NEW_HOME_TWO_PRICE * Math.pow(10, await usdgToken.decimals());

      const NEW_HOME_THREE_PRICE = 10000;
      const NEW_HOME_THREE_PRICE_WITH_DECIMALS =
        NEW_HOME_THREE_PRICE * Math.pow(10, await usdgToken.decimals());

      await reit.appraiseHome(1, NEW_HOME_ONE_PRICE_WITH_DECIMALS);
      await reit.appraiseHome(2, NEW_HOME_TWO_PRICE_WITH_DECIMALS);
      await reit.appraiseHome(3, NEW_HOME_THREE_PRICE_WITH_DECIMALS);

      //check new backing price
      let current_backing_per_share_after_price_went_down =
        await reit.backingPerShare();

      let new_total_home_price =
        NEW_HOME_ONE_PRICE_WITH_DECIMALS +
        NEW_HOME_TWO_PRICE_WITH_DECIMALS +
        NEW_HOME_THREE_PRICE_WITH_DECIMALS;

      let expected_backing_per_share_after_price_went_down =
        new_total_home_price / (await gpsyToken.totalSupply());
      let expected_backing_per_share_after_price_went_down_with_decimals =
        expected_backing_per_share_after_price_went_down *
        Math.pow(10, await usdgToken.decimals());

      expect(
        new BN(current_backing_per_share_after_price_went_down)
      ).to.be.bignumber.equal(
        new BN(expected_backing_per_share_after_price_went_down_with_decimals)
      );

      //check if the price per share is less then the initial
      expect(
        new BN(current_backing_per_share_after_price_went_down)
      ).to.be.bignumber.greaterThan(new BN(new_current_backing_per_gypsy));
    });

    it("Investor successfully purchases Gypsy when there are multiple houses and no cash reserves and the price of all go down", async () => {
      let before_balance = await usdgToken.balanceOf(reit.address);
      expect(before_balance).to.be.bignumber.equal(new BN(0));

      //make sure there are no homes yet
      let house_count = await homeNft.count();
      expect(house_count).to.be.bignumber.equal(new BN(0));

      //investor buys gypsy
      const INVESTMENT_MONEY = 30000;
      const INVESTMENT_MONEY_WITH_DECIMALS =
        INVESTMENT_MONEY * Math.pow(10, await usdgToken.decimals());

      const GYPSY_TOKEN_AMOUNT = INVESTMENT_MONEY / 100;
      const GYPSY_TOKEN_AMOUNT_WITH_DECIMALS =
        GYPSY_TOKEN_AMOUNT * Math.pow(10, await gpsyToken.decimals());
      //gives the investor the money to invest
      await usdgToken.mint(investor, new BN(INVESTMENT_MONEY_WITH_DECIMALS), {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.approve(
        reit.address,
        new BN(INVESTMENT_MONEY_WITH_DECIMALS),
        {
          from: investor,
          gas: 5000000,
          gasPrice: 500000000,
        }
      );

      await reit.buy(new BN(GYPSY_TOKEN_AMOUNT_WITH_DECIMALS), {
        from: investor,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //check if the investor has the Gypsy
      let investor_gypsy_balance = await gpsyToken.balanceOf(investor);
      expect(investor_gypsy_balance).to.be.bignumber.equal(
        new BN(GYPSY_TOKEN_AMOUNT_WITH_DECIMALS)
      );

      //check if REIT has the USDG
      let reit_usdg_balance = await usdgToken.balanceOf(reit.address);
      expect(reit_usdg_balance).to.be.bignumber.equal(
        new BN(INVESTMENT_MONEY_WITH_DECIMALS)
      );

      //check if the backing of Gypsy is $100
      let current_backing_per_gypsy = await reit.backingPerShare();
      let expected_backing_per_gypsy =
        100 * Math.pow(10, await gpsyToken.decimals());
      expect(current_backing_per_gypsy).to.be.bignumber.equal(
        new BN(expected_backing_per_gypsy)
      );

      //now the REIT buys a home which empties out the treasury so it has no reserves
      const HOME_ONE_VALUE = 10000;
      const HOME_ONE_VALUE_WITH_DECIMALS =
        HOME_ONE_VALUE * Math.pow(10, await usdgToken.decimals());

      const HOME_TWO_VALUE = 15000;
      const HOME_TWO_VALUE_WITH_DECIMALS =
        HOME_TWO_VALUE * Math.pow(10, await usdgToken.decimals());

      const HOME_THREE_VALUE = 5000;
      const HOME_THREE_VALUE_WITH_DECIMALS =
        HOME_THREE_VALUE * Math.pow(10, await usdgToken.decimals());

      //Now have the REIT purchase a home.
      const RENT_PRICE = 5000 * Math.pow(10, await usdgToken.decimals());

      //buy home #1
      await reit.addHome(
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_ONE_VALUE_WITH_DECIMALS
      );

      //buy home #2
      await reit.addHome(
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_TWO_VALUE_WITH_DECIMALS
      );

      //buy home #3
      await reit.addHome(
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_THREE_VALUE_WITH_DECIMALS
      );

      //check we have the home
      let current_home_count = await reit.numberOfProperties();
      expect(current_home_count).to.be.bignumber.equal(new BN(3));

      //check if the backing of Gypsy is still $100
      let new_current_backing_per_gypsy = await reit.backingPerShare();
      let new_expected_backing_per_gypsy =
        100 * Math.pow(10, await usdgToken.decimals());
      expect(new_current_backing_per_gypsy).to.be.bignumber.equal(
        new BN(new_expected_backing_per_gypsy)
      );

      //now the price of all three homes goes up
      const NEW_HOME_ONE_PRICE = 8000;
      const NEW_HOME_ONE_PRICE_WITH_DECIMALS =
        NEW_HOME_ONE_PRICE * Math.pow(10, await usdgToken.decimals());

      const NEW_HOME_TWO_PRICE = 5000;
      const NEW_HOME_TWO_PRICE_WITH_DECIMALS =
        NEW_HOME_TWO_PRICE * Math.pow(10, await usdgToken.decimals());

      const NEW_HOME_THREE_PRICE = 3000;
      const NEW_HOME_THREE_PRICE_WITH_DECIMALS =
        NEW_HOME_THREE_PRICE * Math.pow(10, await usdgToken.decimals());

      await reit.appraiseHome(1, NEW_HOME_ONE_PRICE_WITH_DECIMALS);
      await reit.appraiseHome(2, NEW_HOME_TWO_PRICE_WITH_DECIMALS);
      await reit.appraiseHome(3, NEW_HOME_THREE_PRICE_WITH_DECIMALS);

      //check new backing price
      let current_backing_per_share_after_price_went_down =
        await reit.backingPerShare();

      let new_total_home_price =
        NEW_HOME_ONE_PRICE_WITH_DECIMALS +
        NEW_HOME_TWO_PRICE_WITH_DECIMALS +
        NEW_HOME_THREE_PRICE_WITH_DECIMALS;

      let expected_backing_per_share_after_price_went_down =
        new_total_home_price / (await gpsyToken.totalSupply());
      let expected_backing_per_share_after_price_went_down_with_decimals =
        expected_backing_per_share_after_price_went_down *
        Math.pow(10, await usdgToken.decimals());

      expect(
        new BN(current_backing_per_share_after_price_went_down)
      ).to.be.bignumber.equal(
        new BN(expected_backing_per_share_after_price_went_down_with_decimals)
      );

      //check if the price per share is less then the initial
      expect(
        new BN(current_backing_per_share_after_price_went_down)
      ).to.be.bignumber.lessThan(new BN(new_current_backing_per_gypsy));
    });

    it("Investor successfully purchases Gypsy when there are multiple houses and no cash reserves and the price of all change", async () => {
      let before_balance = await usdgToken.balanceOf(reit.address);
      expect(before_balance).to.be.bignumber.equal(new BN(0));

      //make sure there are no homes yet
      let house_count = await homeNft.count();
      expect(house_count).to.be.bignumber.equal(new BN(0));

      //investor buys gypsy
      const INVESTMENT_MONEY = 30000;
      const INVESTMENT_MONEY_WITH_DECIMALS =
        INVESTMENT_MONEY * Math.pow(10, await usdgToken.decimals());

      const GYPSY_TOKEN_AMOUNT = INVESTMENT_MONEY / 100;
      const GYPSY_TOKEN_AMOUNT_WITH_DECIMALS =
        GYPSY_TOKEN_AMOUNT * Math.pow(10, await gpsyToken.decimals());
      //gives the investor the money to invest
      await usdgToken.mint(investor, new BN(INVESTMENT_MONEY_WITH_DECIMALS), {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.approve(
        reit.address,
        new BN(INVESTMENT_MONEY_WITH_DECIMALS),
        {
          from: investor,
          gas: 5000000,
          gasPrice: 500000000,
        }
      );

      await reit.buy(new BN(GYPSY_TOKEN_AMOUNT_WITH_DECIMALS), {
        from: investor,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //check if the investor has the Gypsy
      let investor_gypsy_balance = await gpsyToken.balanceOf(investor);
      expect(investor_gypsy_balance).to.be.bignumber.equal(
        new BN(GYPSY_TOKEN_AMOUNT_WITH_DECIMALS)
      );

      //check if REIT has the USDG
      let reit_usdg_balance = await usdgToken.balanceOf(reit.address);
      expect(reit_usdg_balance).to.be.bignumber.equal(
        new BN(INVESTMENT_MONEY_WITH_DECIMALS)
      );

      //check if the backing of Gypsy is $100
      let current_backing_per_gypsy = await reit.backingPerShare();
      let expected_backing_per_gypsy =
        100 * Math.pow(10, await gpsyToken.decimals());
      expect(current_backing_per_gypsy).to.be.bignumber.equal(
        new BN(expected_backing_per_gypsy)
      );

      //now the REIT buys a home which empties out the treasury so it has no reserves
      const HOME_ONE_VALUE = 10000;
      const HOME_ONE_VALUE_WITH_DECIMALS =
        HOME_ONE_VALUE * Math.pow(10, await usdgToken.decimals());

      const HOME_TWO_VALUE = 15000;
      const HOME_TWO_VALUE_WITH_DECIMALS =
        HOME_TWO_VALUE * Math.pow(10, await usdgToken.decimals());

      const HOME_THREE_VALUE = 5000;
      const HOME_THREE_VALUE_WITH_DECIMALS =
        HOME_THREE_VALUE * Math.pow(10, await usdgToken.decimals());

      //Now have the REIT purchase a home.
      const RENT_PRICE = 5000 * Math.pow(10, await usdgToken.decimals());

      //buy home #1
      await reit.addHome(
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_ONE_VALUE_WITH_DECIMALS
      );

      //buy home #2
      await reit.addHome(
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_TWO_VALUE_WITH_DECIMALS
      );

      //buy home #3
      await reit.addHome(
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_THREE_VALUE_WITH_DECIMALS
      );

      //check we have the home
      let current_home_count = await reit.numberOfProperties();
      expect(current_home_count).to.be.bignumber.equal(new BN(3));

      //check if the backing of Gypsy is still $100
      let new_current_backing_per_gypsy = await reit.backingPerShare();
      let new_expected_backing_per_gypsy =
        100 * Math.pow(10, await usdgToken.decimals());
      expect(new_current_backing_per_gypsy).to.be.bignumber.equal(
        new BN(new_expected_backing_per_gypsy)
      );

      //now the price of all three homes goes up
      const NEW_HOME_ONE_PRICE = 12000;
      const NEW_HOME_ONE_PRICE_WITH_DECIMALS =
        NEW_HOME_ONE_PRICE * Math.pow(10, await usdgToken.decimals());

      const NEW_HOME_TWO_PRICE = 5000;
      const NEW_HOME_TWO_PRICE_WITH_DECIMALS =
        NEW_HOME_TWO_PRICE * Math.pow(10, await usdgToken.decimals());

      const NEW_HOME_THREE_PRICE = 10000;
      const NEW_HOME_THREE_PRICE_WITH_DECIMALS =
        NEW_HOME_THREE_PRICE * Math.pow(10, await usdgToken.decimals());

      await reit.appraiseHome(1, NEW_HOME_ONE_PRICE_WITH_DECIMALS);
      await reit.appraiseHome(2, NEW_HOME_TWO_PRICE_WITH_DECIMALS);
      await reit.appraiseHome(3, NEW_HOME_THREE_PRICE_WITH_DECIMALS);

      //check new backing price
      let current_backing_per_share_after_price_went_down =
        await reit.backingPerShare();

      let new_total_home_price =
        NEW_HOME_ONE_PRICE_WITH_DECIMALS +
        NEW_HOME_TWO_PRICE_WITH_DECIMALS +
        NEW_HOME_THREE_PRICE_WITH_DECIMALS;

      let expected_backing_per_share_after_price_went_down =
        new_total_home_price / (await gpsyToken.totalSupply());
      let expected_backing_per_share_after_price_went_down_with_decimals =
        expected_backing_per_share_after_price_went_down *
        Math.pow(10, await usdgToken.decimals());

      expect(
        new BN(current_backing_per_share_after_price_went_down)
      ).to.be.bignumber.equal(
        new BN(expected_backing_per_share_after_price_went_down_with_decimals)
      );
    });
  });

  describe("Gypsy backing", async () => {
    it("Calculates backing per Gypsy when there are no houses", async () => {
      let before_balance = await usdgToken.balanceOf(reit.address);
      expect(before_balance).to.be.bignumber.equal(new BN(0));

      //make sure there are no homes yet
      let house_count = await homeNft.count();
      expect(house_count).to.be.bignumber.equal(new BN(0));

      const INVESTMENT_MONEY = 10000;
      const INVESTMENT_MONEY_WITH_DECIMALS =
        INVESTMENT_MONEY * Math.pow(10, await usdgToken.decimals());

      const GYPSY_TOKEN_AMOUNT = INVESTMENT_MONEY / 100;
      //gives the investor the money to invest
      await usdgToken.mint(investor, new BN(INVESTMENT_MONEY_WITH_DECIMALS), {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.approve(
        reit.address,
        new BN(INVESTMENT_MONEY_WITH_DECIMALS),
        {
          from: investor,
          gas: 5000000,
          gasPrice: 500000000,
        }
      );

      await reit.buy(new BN(GYPSY_TOKEN_AMOUNT), {
        from: investor,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //check if the investor has the Gypsy
      let investor_gypsy_balance = await gpsyToken.balanceOf(investor);

      expect(investor_gypsy_balance).to.be.bignumber.equal(
        new BN(GYPSY_TOKEN_AMOUNT)
      );

      //check if REIT has the USDG
      let reit_usdg_balance = await usdgToken.balanceOf(reit.address);
      expect(reit_usdg_balance).to.be.bignumber.equal(new BN(INVESTMENT_MONEY));

      //CHECK BACKING PER TOKEN is correct @ 100 a token
      let current_backing_per_share = await reit.backingPerShare();
      let expected_backing_per_share = INVESTMENT_MONEY / GYPSY_TOKEN_AMOUNT;
      expected_backing_per_share *= Math.pow(10, await usdgToken.decimals());

      expect(current_backing_per_share).to.be.bignumber.equal(
        new BN(expected_backing_per_share)
      );
    });

    it("Calculates backing per Gypsy when there is 1 house and no cash reserves", async () => {
      let before_balance = await usdgToken.balanceOf(reit.address);
      expect(before_balance).to.be.bignumber.equal(new BN(0));

      //make sure there are no homes yet
      let house_count = await homeNft.count();
      expect(house_count).to.be.bignumber.equal(new BN(0));

      const INVESTMENT_MONEY = 10000;
      const INVESTMENT_MONEY_WITH_DECIMALS =
        INVESTMENT_MONEY * Math.pow(10, await usdgToken.decimals());

      const GYPSY_TOKEN_AMOUNT = INVESTMENT_MONEY / 100;
      const GYPSY_TOKEN_AMOUNT_WITH_DECIMALS =
        GYPSY_TOKEN_AMOUNT * Math.pow(10, await gpsyToken.decimals());

      //gives the investor the money to invest
      await usdgToken.mint(investor, new BN(INVESTMENT_MONEY_WITH_DECIMALS), {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.approve(
        reit.address,
        new BN(INVESTMENT_MONEY_WITH_DECIMALS),
        {
          from: investor,
          gas: 5000000,
          gasPrice: 500000000,
        }
      );

      await reit.buy(new BN(GYPSY_TOKEN_AMOUNT_WITH_DECIMALS), {
        from: investor,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //check if the investor has the Gypsy
      let investor_gypsy_balance = await gpsyToken.balanceOf(investor);

      expect(investor_gypsy_balance).to.be.bignumber.equal(
        new BN(GYPSY_TOKEN_AMOUNT_WITH_DECIMALS)
      );

      //check if REIT has the USDG
      let reit_usdg_balance = await usdgToken.balanceOf(reit.address);
      expect(reit_usdg_balance).to.be.bignumber.equal(
        new BN(INVESTMENT_MONEY_WITH_DECIMALS)
      );

      //Now have the REIT purchase a home.
      const RENT_PRICE = 5000 * Math.pow(10, await usdgToken.decimals());
      await reit.addHome(
        HOME_DATA_URI,
        RENT_PRICE,
        INVESTMENT_MONEY_WITH_DECIMALS
      );

      //check added home
      let num_properties = await reit.numberOfProperties();
      expect(num_properties).to.be.bignumber.equal(new BN(1));

      //CHECK BACKING PER TOKEN is correct @ 100 a token
      let current_backing_per_share = await reit.backingPerShare();
      //each has 6 decimals
      let expected_backing_per_share = INVESTMENT_MONEY / GYPSY_TOKEN_AMOUNT;
      let expected_backing_per_share_with_decimals =
        expected_backing_per_share * Math.pow(10, await usdgToken.decimals());
      expect(new BN(current_backing_per_share)).to.be.bignumber.equal(
        new BN(expected_backing_per_share_with_decimals)
      );
    });

    it("Calculates backing per Gypsy when there is 1 house and cash reserves", async () => {
      let before_balance = await usdgToken.balanceOf(reit.address);
      expect(before_balance).to.be.bignumber.equal(new BN(0));

      //make sure there are no homes yet
      let house_count = await homeNft.count();
      expect(house_count).to.be.bignumber.equal(new BN(0));
      const INVESTMENT_MONEY = 10000;
      const INVESTMENT_MONEY_WITH_DECIMALS =
        INVESTMENT_MONEY * Math.pow(10, await usdgToken.decimals());

      const GYPSY_TOKEN_AMOUNT = INVESTMENT_MONEY / 100;
      const GYPSY_TOKEN_AMOUNT_WITH_DECIMALS =
        GYPSY_TOKEN_AMOUNT * Math.pow(10, await gpsyToken.decimals());

      //gives the investor the money to invest
      await usdgToken.mint(investor, new BN(INVESTMENT_MONEY_WITH_DECIMALS), {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.approve(
        reit.address,
        new BN(INVESTMENT_MONEY_WITH_DECIMALS),
        {
          from: investor,
          gas: 5000000,
          gasPrice: 500000000,
        }
      );

      await reit.buy(new BN(GYPSY_TOKEN_AMOUNT_WITH_DECIMALS), {
        from: investor,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //check if the investor has the Gypsy
      let investor_gypsy_balance = await gpsyToken.balanceOf(investor);

      expect(investor_gypsy_balance).to.be.bignumber.equal(
        new BN(GYPSY_TOKEN_AMOUNT_WITH_DECIMALS)
      );

      //check if REIT has the USDG
      let reit_usdg_balance = await usdgToken.balanceOf(reit.address);
      expect(reit_usdg_balance).to.be.bignumber.equal(
        new BN(INVESTMENT_MONEY_WITH_DECIMALS)
      );

      const HOME_PRICE = 8000;
      const HOME_PRICE_WITH_DECIMALS =
        HOME_PRICE * Math.pow(10, await usdgToken.decimals());

      //Now have the REIT purchase a home.
      const RENT_PRICE = 5000 * Math.pow(10, await usdgToken.decimals());
      await reit.addHome(HOME_DATA_URI, RENT_PRICE, HOME_PRICE_WITH_DECIMALS);

      //check added home
      let num_properties = await reit.numberOfProperties();
      expect(num_properties).to.be.bignumber.equal(new BN(1));

      //CHECK BACKING PER TOKEN is correct @ 100 a token
      let current_backing_per_share = await reit.backingPerShare();
      //each has 6 decimals
      let expected_backing_per_share = INVESTMENT_MONEY / GYPSY_TOKEN_AMOUNT;
      let expected_backing_per_share_with_decimals =
        expected_backing_per_share * Math.pow(10, await usdgToken.decimals());
      expect(new BN(current_backing_per_share)).to.be.bignumber.equal(
        new BN(expected_backing_per_share_with_decimals)
      );
    });

    it("Calculates backing per Gypsy when there is 1 house and no cash reserves and the price of the home goes down", async () => {
      let before_balance = await usdgToken.balanceOf(reit.address);
      expect(before_balance).to.be.bignumber.equal(new BN(0));

      //make sure there are no homes yet
      let house_count = await homeNft.count();
      expect(house_count).to.be.bignumber.equal(new BN(0));

      const INVESTMENT_MONEY = 10000;
      const INVESTMENT_MONEY_WITH_DECIMALS =
        INVESTMENT_MONEY * Math.pow(10, await usdgToken.decimals());

      const GYPSY_TOKEN_AMOUNT = INVESTMENT_MONEY / 100;
      const GYPSY_TOKEN_AMOUNT_WITH_DECIMALS =
        GYPSY_TOKEN_AMOUNT * Math.pow(10, await gpsyToken.decimals());

      //gives the investor the money to invest
      await usdgToken.mint(investor, new BN(INVESTMENT_MONEY_WITH_DECIMALS), {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.approve(
        reit.address,
        new BN(INVESTMENT_MONEY_WITH_DECIMALS),
        {
          from: investor,
          gas: 5000000,
          gasPrice: 500000000,
        }
      );

      await reit.buy(new BN(GYPSY_TOKEN_AMOUNT_WITH_DECIMALS), {
        from: investor,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //check if the investor has the Gypsy
      let investor_gypsy_balance = await gpsyToken.balanceOf(investor);

      expect(investor_gypsy_balance).to.be.bignumber.equal(
        new BN(GYPSY_TOKEN_AMOUNT_WITH_DECIMALS)
      );

      //check if REIT has the USDG
      let reit_usdg_balance = await usdgToken.balanceOf(reit.address);
      expect(reit_usdg_balance).to.be.bignumber.equal(
        new BN(INVESTMENT_MONEY_WITH_DECIMALS)
      );

      //Now have the REIT purchase a home.
      const RENT_PRICE = 5000 * Math.pow(10, await usdgToken.decimals());
      await reit.addHome(
        HOME_DATA_URI,
        RENT_PRICE,
        INVESTMENT_MONEY_WITH_DECIMALS
      );

      //check added home
      let num_properties = await reit.numberOfProperties();
      expect(num_properties).to.be.bignumber.equal(new BN(1));

      //CHECK BACKING PER TOKEN is correct @ 100 a token
      let current_backing_per_share = await reit.backingPerShare();
      //each has 6 decimals
      let expected_backing_per_share = INVESTMENT_MONEY / GYPSY_TOKEN_AMOUNT;
      let expected_backing_per_share_with_decimals =
        expected_backing_per_share * Math.pow(10, await usdgToken.decimals());
      expect(new BN(current_backing_per_share)).to.be.bignumber.equal(
        new BN(expected_backing_per_share_with_decimals)
      );

      //the house gets appraised and is now worth $9000 instead of $10000
      //the backing per gypsy drops from 100 to 90 as a result

      const NEW_HOME_PRICE = 9000;
      const NEW_HOME_PRICE_WITH_DECIMALS =
        NEW_HOME_PRICE * Math.pow(10, await usdgToken.decimals());

      await reit.appraiseHome(1, NEW_HOME_PRICE_WITH_DECIMALS);

      //check new backing price

      let current_backing_per_share_after_price_went_down =
        await reit.backingPerShare();
      //each has 6 decimals
      let expected_backing_per_share_after_price_went_down =
        NEW_HOME_PRICE_WITH_DECIMALS / (await gpsyToken.totalSupply());

      let expected_backing_per_share_after_price_went_down_with_decimals =
        expected_backing_per_share_after_price_went_down *
        Math.pow(10, await usdgToken.decimals());

      expect(
        new BN(current_backing_per_share_after_price_went_down)
      ).to.be.bignumber.equal(
        new BN(expected_backing_per_share_after_price_went_down_with_decimals)
      );
    });

    it("Calculates backing per Gypsy when there is 1 house and cash reserves and the price of the home goes down", async () => {
      let before_balance = await usdgToken.balanceOf(reit.address);
      expect(before_balance).to.be.bignumber.equal(new BN(0));

      //make sure there are no homes yet
      let house_count = await homeNft.count();
      expect(house_count).to.be.bignumber.equal(new BN(0));

      const INVESTMENT_MONEY = 10000;
      const INVESTMENT_MONEY_WITH_DECIMALS =
        INVESTMENT_MONEY * Math.pow(10, await usdgToken.decimals());

      const GYPSY_TOKEN_AMOUNT = INVESTMENT_MONEY / 100;
      const GYPSY_TOKEN_AMOUNT_WITH_DECIMALS =
        GYPSY_TOKEN_AMOUNT * Math.pow(10, await gpsyToken.decimals());

      //gives the investor the money to invest
      await usdgToken.mint(investor, new BN(INVESTMENT_MONEY_WITH_DECIMALS), {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.approve(
        reit.address,
        new BN(INVESTMENT_MONEY_WITH_DECIMALS),
        {
          from: investor,
          gas: 5000000,
          gasPrice: 500000000,
        }
      );

      await reit.buy(new BN(GYPSY_TOKEN_AMOUNT_WITH_DECIMALS), {
        from: investor,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //check if the investor has the Gypsy
      let investor_gypsy_balance = await gpsyToken.balanceOf(investor);

      expect(investor_gypsy_balance).to.be.bignumber.equal(
        new BN(GYPSY_TOKEN_AMOUNT_WITH_DECIMALS)
      );

      //check if REIT has the USDG
      let reit_usdg_balance = await usdgToken.balanceOf(reit.address);
      expect(reit_usdg_balance).to.be.bignumber.equal(
        new BN(INVESTMENT_MONEY_WITH_DECIMALS)
      );

      const HOME_PRICE = 8000;
      const HOME_PRICE_WITH_DECIMALS =
        HOME_PRICE * Math.pow(10, await usdgToken.decimals());

      //Now have the REIT purchase a home.
      const RENT_PRICE = 5000 * Math.pow(10, await usdgToken.decimals());
      await reit.addHome(HOME_DATA_URI, RENT_PRICE, HOME_PRICE_WITH_DECIMALS);

      //check added home
      let num_properties = await reit.numberOfProperties();
      expect(num_properties).to.be.bignumber.equal(new BN(1));

      //CHECK BACKING PER TOKEN is correct @ 100 a token
      let current_backing_per_share = await reit.backingPerShare();
      //each has 6 decimals
      let expected_backing_per_share = INVESTMENT_MONEY / GYPSY_TOKEN_AMOUNT;
      let expected_backing_per_share_with_decimals =
        expected_backing_per_share * Math.pow(10, await usdgToken.decimals());

      expect(new BN(current_backing_per_share)).to.be.bignumber.equal(
        new BN(expected_backing_per_share_with_decimals)
      );

      //the house gets appraised and is now worth $7000 instead of $8000
      //the backing per gypsy drops but the cash reserves are included in the backing

      const NEW_HOME_PRICE = 7000;
      const NEW_HOME_PRICE_WITH_DECIMALS =
        NEW_HOME_PRICE * Math.pow(10, await usdgToken.decimals());

      await reit.appraiseHome(1, NEW_HOME_PRICE_WITH_DECIMALS);

      //check new backing price

      let current_backing_per_share_after_price_went_down =
        await reit.backingPerShare();
      //each has 6 decimals
      let expected_cash_reserves =
        INVESTMENT_MONEY_WITH_DECIMALS - HOME_PRICE_WITH_DECIMALS;
      let expected_backing_per_share_after_price_went_down =
        (NEW_HOME_PRICE_WITH_DECIMALS + expected_cash_reserves) /
        (await gpsyToken.totalSupply());

      let expected_backing_per_share_after_price_went_down_with_decimals =
        expected_backing_per_share_after_price_went_down *
        Math.pow(10, await usdgToken.decimals());

      expect(
        new BN(current_backing_per_share_after_price_went_down)
      ).to.be.bignumber.equal(
        new BN(expected_backing_per_share_after_price_went_down_with_decimals)
      );
    });

    it("Calculates backing per Gypsy when there is 1 house and no cash reserves and the price of the home goes up", async () => {
      let before_balance = await usdgToken.balanceOf(reit.address);
      expect(before_balance).to.be.bignumber.equal(new BN(0));

      //make sure there are no homes yet
      let house_count = await homeNft.count();
      expect(house_count).to.be.bignumber.equal(new BN(0));

      const INVESTMENT_MONEY = 10000;
      const INVESTMENT_MONEY_WITH_DECIMALS =
        INVESTMENT_MONEY * Math.pow(10, await usdgToken.decimals());

      const GYPSY_TOKEN_AMOUNT = INVESTMENT_MONEY / 100;
      const GYPSY_TOKEN_AMOUNT_WITH_DECIMALS =
        GYPSY_TOKEN_AMOUNT * Math.pow(10, await gpsyToken.decimals());

      //gives the investor the money to invest
      await usdgToken.mint(investor, new BN(INVESTMENT_MONEY_WITH_DECIMALS), {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.approve(
        reit.address,
        new BN(INVESTMENT_MONEY_WITH_DECIMALS),
        {
          from: investor,
          gas: 5000000,
          gasPrice: 500000000,
        }
      );

      await reit.buy(new BN(GYPSY_TOKEN_AMOUNT_WITH_DECIMALS), {
        from: investor,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //check if the investor has the Gypsy
      let investor_gypsy_balance = await gpsyToken.balanceOf(investor);

      expect(investor_gypsy_balance).to.be.bignumber.equal(
        new BN(GYPSY_TOKEN_AMOUNT_WITH_DECIMALS)
      );

      //check if REIT has the USDG
      let reit_usdg_balance = await usdgToken.balanceOf(reit.address);
      expect(reit_usdg_balance).to.be.bignumber.equal(
        new BN(INVESTMENT_MONEY_WITH_DECIMALS)
      );

      //Now have the REIT purchase a home.
      const RENT_PRICE = 5000 * Math.pow(10, await usdgToken.decimals());
      await reit.addHome(
        HOME_DATA_URI,
        RENT_PRICE,
        INVESTMENT_MONEY_WITH_DECIMALS
      );

      //check added home
      let num_properties = await reit.numberOfProperties();
      expect(num_properties).to.be.bignumber.equal(new BN(1));

      //CHECK BACKING PER TOKEN is correct @ 100 a token
      let current_backing_per_share = await reit.backingPerShare();
      //each has 6 decimals
      let expected_backing_per_share = INVESTMENT_MONEY / GYPSY_TOKEN_AMOUNT;
      let expected_backing_per_share_with_decimals =
        expected_backing_per_share * Math.pow(10, await usdgToken.decimals());
      expect(new BN(current_backing_per_share)).to.be.bignumber.equal(
        new BN(expected_backing_per_share_with_decimals)
      );
      //the house gets appraised and is now worth $11000 instead of $10000
      //the backing per gypsy increases from 100 to 110 as a result

      const NEW_HOME_PRICE = 11000;
      const NEW_HOME_PRICE_WITH_DECIMALS =
        NEW_HOME_PRICE * Math.pow(10, await usdgToken.decimals());

      await reit.appraiseHome(1, NEW_HOME_PRICE_WITH_DECIMALS);

      //check new backing price

      let current_backing_per_share_after_price_went_down =
        await reit.backingPerShare();
      //each has 6 decimals
      let expected_backing_per_share_after_price_went_down =
        NEW_HOME_PRICE_WITH_DECIMALS / (await gpsyToken.totalSupply());

      let expected_backing_per_share_after_price_went_down_with_decimals =
        expected_backing_per_share_after_price_went_down *
        Math.pow(10, await usdgToken.decimals());

      expect(
        new BN(current_backing_per_share_after_price_went_down)
      ).to.be.bignumber.equal(
        new BN(expected_backing_per_share_after_price_went_down_with_decimals)
      );
    });

    it("Calculates backing per Gypsy when there is 1 house and cash reserves and the price of the home goes up", async () => {
      let before_balance = await usdgToken.balanceOf(reit.address);
      expect(before_balance).to.be.bignumber.equal(new BN(0));

      //make sure there are no homes yet
      let house_count = await homeNft.count();
      expect(house_count).to.be.bignumber.equal(new BN(0));

      const INVESTMENT_MONEY = 10000;
      const INVESTMENT_MONEY_WITH_DECIMALS =
        INVESTMENT_MONEY * Math.pow(10, await usdgToken.decimals());

      const GYPSY_TOKEN_AMOUNT = INVESTMENT_MONEY / 100;
      const GYPSY_TOKEN_AMOUNT_WITH_DECIMALS =
        GYPSY_TOKEN_AMOUNT * Math.pow(10, await gpsyToken.decimals());

      //gives the investor the money to invest
      await usdgToken.mint(investor, new BN(INVESTMENT_MONEY_WITH_DECIMALS), {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.approve(
        reit.address,
        new BN(INVESTMENT_MONEY_WITH_DECIMALS),
        {
          from: investor,
          gas: 5000000,
          gasPrice: 500000000,
        }
      );

      await reit.buy(new BN(GYPSY_TOKEN_AMOUNT_WITH_DECIMALS), {
        from: investor,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //check if the investor has the Gypsy
      let investor_gypsy_balance = await gpsyToken.balanceOf(investor);

      expect(investor_gypsy_balance).to.be.bignumber.equal(
        new BN(GYPSY_TOKEN_AMOUNT_WITH_DECIMALS)
      );

      //check if REIT has the USDG
      let reit_usdg_balance = await usdgToken.balanceOf(reit.address);
      expect(reit_usdg_balance).to.be.bignumber.equal(
        new BN(INVESTMENT_MONEY_WITH_DECIMALS)
      );

      //Now have the REIT purchase a home.
      const HOME_PRICE = 8000;
      const HOME_PRICE_WITH_DECIMALS =
        HOME_PRICE * Math.pow(10, await usdgToken.decimals());

      //Now have the REIT purchase a home.
      const RENT_PRICE = 5000 * Math.pow(10, await usdgToken.decimals());
      await reit.addHome(HOME_DATA_URI, RENT_PRICE, HOME_PRICE_WITH_DECIMALS);

      //check added home
      let num_properties = await reit.numberOfProperties();
      expect(num_properties).to.be.bignumber.equal(new BN(1));

      //CHECK BACKING PER TOKEN is correct @ 100 a token
      let current_backing_per_share = await reit.backingPerShare();
      //each has 6 decimals
      let expected_backing_per_share = INVESTMENT_MONEY / GYPSY_TOKEN_AMOUNT;
      let expected_backing_per_share_with_decimals =
        expected_backing_per_share * Math.pow(10, await usdgToken.decimals());
      expect(new BN(current_backing_per_share)).to.be.bignumber.equal(
        new BN(expected_backing_per_share_with_decimals)
      );

      //the house gets appraised and is now worth $7000 instead of $8000
      //the backing per gypsy drops but the cash reserves are included in the backing

      const NEW_HOME_PRICE = 9000;
      const NEW_HOME_PRICE_WITH_DECIMALS =
        NEW_HOME_PRICE * Math.pow(10, await usdgToken.decimals());

      await reit.appraiseHome(1, NEW_HOME_PRICE_WITH_DECIMALS);

      //check new backing price
      let current_backing_per_share_after_price_went_down =
        await reit.backingPerShare();
      //each has 6 decimals
      let expected_cash_reserves =
        INVESTMENT_MONEY_WITH_DECIMALS - HOME_PRICE_WITH_DECIMALS;
      let expected_backing_per_share_after_price_went_down =
        (NEW_HOME_PRICE_WITH_DECIMALS + expected_cash_reserves) /
        (await gpsyToken.totalSupply());

      let expected_backing_per_share_after_price_went_down_with_decimals =
        expected_backing_per_share_after_price_went_down *
        Math.pow(10, await usdgToken.decimals());

      expect(
        new BN(current_backing_per_share_after_price_went_down)
      ).to.be.bignumber.equal(
        new BN(expected_backing_per_share_after_price_went_down_with_decimals)
      );
    });

    it("Calculates backing per Gypsy when there are multiple houses and no cash reserves", async () => {
      let before_balance = await usdgToken.balanceOf(reit.address);
      expect(before_balance).to.be.bignumber.equal(new BN(0));

      //make sure there are no homes yet
      let house_count = await homeNft.count();
      expect(house_count).to.be.bignumber.equal(new BN(0));

      const INVESTMENT_MONEY = 20000;
      const INVESTMENT_MONEY_WITH_DECIMALS =
        INVESTMENT_MONEY * Math.pow(10, await usdgToken.decimals());

      const GYPSY_TOKEN_AMOUNT = INVESTMENT_MONEY / 100;
      const GYPSY_TOKEN_AMOUNT_WITH_DECIMALS =
        GYPSY_TOKEN_AMOUNT * Math.pow(10, await gpsyToken.decimals());

      //gives the investor the money to invest
      await usdgToken.mint(investor, new BN(INVESTMENT_MONEY_WITH_DECIMALS), {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.approve(
        reit.address,
        new BN(INVESTMENT_MONEY_WITH_DECIMALS),
        {
          from: investor,
          gas: 5000000,
          gasPrice: 500000000,
        }
      );

      await reit.buy(new BN(GYPSY_TOKEN_AMOUNT_WITH_DECIMALS), {
        from: investor,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //check if the investor has the Gypsy
      let investor_gypsy_balance = await gpsyToken.balanceOf(investor);

      expect(investor_gypsy_balance).to.be.bignumber.equal(
        new BN(GYPSY_TOKEN_AMOUNT_WITH_DECIMALS)
      );

      //check if REIT has the USDG
      let reit_usdg_balance = await usdgToken.balanceOf(reit.address);
      expect(reit_usdg_balance).to.be.bignumber.equal(
        new BN(INVESTMENT_MONEY_WITH_DECIMALS)
      );

      //Now have the REIT purchase the homes.
      const RENT_PRICE = 5000 * Math.pow(10, await usdgToken.decimals());

      const HOME_ONE_PRICE = 10000;
      const HOME_ONE_PRICE_WITH_DECIMALS =
        HOME_ONE_PRICE * Math.pow(10, await usdgToken.decimals());

      const HOME_TWO_PRICE = 5000;
      const HOME_TWO_PRICE_WITH_DECIMALS =
        HOME_TWO_PRICE * Math.pow(10, await usdgToken.decimals());

      const HOME_THREE_PRICE = 5000;
      const HOME_THREE_PRICE_WITH_DECIMALS =
        HOME_THREE_PRICE * Math.pow(10, await usdgToken.decimals());

      //buy home #1
      await reit.addHome(
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_ONE_PRICE_WITH_DECIMALS
      );

      //buy home #2
      await reit.addHome(
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_TWO_PRICE_WITH_DECIMALS
      );

      //buy home #3
      await reit.addHome(
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_THREE_PRICE_WITH_DECIMALS
      );

      //check added homes
      let num_properties = await reit.numberOfProperties();
      expect(num_properties).to.be.bignumber.equal(new BN(3));

      //CHECK BACKING PER TOKEN is correct @ 100 a token
      let current_backing_per_share = await reit.backingPerShare();
      //each has 6 decimals
      let expected_backing_per_share = INVESTMENT_MONEY / GYPSY_TOKEN_AMOUNT;
      let expected_backing_per_share_with_decimals =
        expected_backing_per_share * Math.pow(10, await usdgToken.decimals());
      expect(new BN(current_backing_per_share)).to.be.bignumber.equal(
        new BN(expected_backing_per_share_with_decimals)
      );
    });

    it("Calculates backing per Gypsy when there are multiple houses and cash reserves", async () => {
      let before_balance = await usdgToken.balanceOf(reit.address);
      expect(before_balance).to.be.bignumber.equal(new BN(0));

      //make sure there are no homes yet
      let house_count = await homeNft.count();
      expect(house_count).to.be.bignumber.equal(new BN(0));

      const INVESTMENT_MONEY = 20000;
      const INVESTMENT_MONEY_WITH_DECIMALS =
        INVESTMENT_MONEY * Math.pow(10, await usdgToken.decimals());

      const GYPSY_TOKEN_AMOUNT = INVESTMENT_MONEY / 100;
      const GYPSY_TOKEN_AMOUNT_WITH_DECIMALS =
        GYPSY_TOKEN_AMOUNT * Math.pow(10, await gpsyToken.decimals());

      //gives the investor the money to invest
      await usdgToken.mint(investor, new BN(INVESTMENT_MONEY_WITH_DECIMALS), {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.approve(
        reit.address,
        new BN(INVESTMENT_MONEY_WITH_DECIMALS),
        {
          from: investor,
          gas: 5000000,
          gasPrice: 500000000,
        }
      );

      await reit.buy(new BN(GYPSY_TOKEN_AMOUNT_WITH_DECIMALS), {
        from: investor,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //check if the investor has the Gypsy
      let investor_gypsy_balance = await gpsyToken.balanceOf(investor);
      expect(investor_gypsy_balance).to.be.bignumber.equal(
        new BN(GYPSY_TOKEN_AMOUNT_WITH_DECIMALS)
      );

      //check if REIT has the USDG
      let reit_usdg_balance = await usdgToken.balanceOf(reit.address);
      expect(reit_usdg_balance).to.be.bignumber.equal(
        new BN(INVESTMENT_MONEY_WITH_DECIMALS)
      );

      //Now have the REIT purchase the homes.
      const RENT_PRICE = 5000 * Math.pow(10, await usdgToken.decimals());

      const HOME_ONE_PRICE = 10000;
      const HOME_ONE_PRICE_WITH_DECIMALS =
        HOME_ONE_PRICE * Math.pow(10, await usdgToken.decimals());

      const HOME_TWO_PRICE = 5000;
      const HOME_TWO_PRICE_WITH_DECIMALS =
        HOME_TWO_PRICE * Math.pow(10, await usdgToken.decimals());

      const HOME_THREE_PRICE = 3000;
      const HOME_THREE_PRICE_WITH_DECIMALS =
        HOME_THREE_PRICE * Math.pow(10, await usdgToken.decimals());

      //buy home #1
      await reit.addHome(
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_ONE_PRICE_WITH_DECIMALS
      );

      //buy home #2
      await reit.addHome(
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_TWO_PRICE_WITH_DECIMALS
      );

      //buy home #3
      await reit.addHome(
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_THREE_PRICE_WITH_DECIMALS
      );

      //check added homes
      let num_properties = await reit.numberOfProperties();
      expect(num_properties).to.be.bignumber.equal(new BN(3));

      //CHECK BACKING PER TOKEN is correct @ 100 a token
      let current_backing_per_share = await reit.backingPerShare();
      //each has 6 decimals
      let expected_backing_per_share = INVESTMENT_MONEY / GYPSY_TOKEN_AMOUNT;
      let expected_backing_per_share_with_decimals =
        expected_backing_per_share * Math.pow(10, await usdgToken.decimals());
      expect(new BN(current_backing_per_share)).to.be.bignumber.equal(
        new BN(expected_backing_per_share_with_decimals)
      );
    });

    it("Calculates backing per Gypsy when there are multiple houses and no cash reserves and the price of all of the homes goes down", async () => {
      let before_balance = await usdgToken.balanceOf(reit.address);
      expect(before_balance).to.be.bignumber.equal(new BN(0));

      //make sure there are no homes yet
      let house_count = await homeNft.count();
      expect(house_count).to.be.bignumber.equal(new BN(0));

      const INVESTMENT_MONEY = 20000;
      const INVESTMENT_MONEY_WITH_DECIMALS =
        INVESTMENT_MONEY * Math.pow(10, await usdgToken.decimals());

      const GYPSY_TOKEN_AMOUNT = INVESTMENT_MONEY / 100;
      const GYPSY_TOKEN_AMOUNT_WITH_DECIMALS =
        GYPSY_TOKEN_AMOUNT * Math.pow(10, await gpsyToken.decimals());

      //gives the investor the money to invest
      await usdgToken.mint(investor, new BN(INVESTMENT_MONEY_WITH_DECIMALS), {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.approve(
        reit.address,
        new BN(INVESTMENT_MONEY_WITH_DECIMALS),
        {
          from: investor,
          gas: 5000000,
          gasPrice: 500000000,
        }
      );

      await reit.buy(new BN(GYPSY_TOKEN_AMOUNT_WITH_DECIMALS), {
        from: investor,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //check if the investor has the Gypsy
      let investor_gypsy_balance = await gpsyToken.balanceOf(investor);
      expect(investor_gypsy_balance).to.be.bignumber.equal(
        new BN(GYPSY_TOKEN_AMOUNT_WITH_DECIMALS)
      );

      //check if REIT has the USDG
      let reit_usdg_balance = await usdgToken.balanceOf(reit.address);
      expect(reit_usdg_balance).to.be.bignumber.equal(
        new BN(INVESTMENT_MONEY_WITH_DECIMALS)
      );

      //Now have the REIT purchase the homes.
      const RENT_PRICE = 5000 * Math.pow(10, await usdgToken.decimals());

      const HOME_ONE_PRICE = 10000;
      const HOME_ONE_PRICE_WITH_DECIMALS =
        HOME_ONE_PRICE * Math.pow(10, await usdgToken.decimals());

      const HOME_TWO_PRICE = 5000;
      const HOME_TWO_PRICE_WITH_DECIMALS =
        HOME_TWO_PRICE * Math.pow(10, await usdgToken.decimals());

      const HOME_THREE_PRICE = 5000;
      const HOME_THREE_PRICE_WITH_DECIMALS =
        HOME_THREE_PRICE * Math.pow(10, await usdgToken.decimals());

      //buy home #1
      await reit.addHome(
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_ONE_PRICE_WITH_DECIMALS
      );

      //buy home #2
      await reit.addHome(
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_TWO_PRICE_WITH_DECIMALS
      );

      //buy home #3
      await reit.addHome(
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_THREE_PRICE_WITH_DECIMALS
      );

      //check added homes
      let num_properties = await reit.numberOfProperties();
      expect(num_properties).to.be.bignumber.equal(new BN(3));

      //CHECK BACKING PER TOKEN is correct @ 100 a token
      let current_backing_per_share = await reit.backingPerShare();
      //each has 6 decimals
      let expected_backing_per_share = INVESTMENT_MONEY / GYPSY_TOKEN_AMOUNT;
      let expected_backing_per_share_with_decimals =
        expected_backing_per_share * Math.pow(10, await usdgToken.decimals());

      expect(new BN(current_backing_per_share)).to.be.bignumber.equal(
        new BN(expected_backing_per_share_with_decimals)
      );

      //now the price of all three homes goes down

      const NEW_HOME_ONE_PRICE = 9000;
      const NEW_HOME_ONE_PRICE_WITH_DECIMALS =
        NEW_HOME_ONE_PRICE * Math.pow(10, await usdgToken.decimals());

      const NEW_HOME_TWO_PRICE = 4000;
      const NEW_HOME_TWO_PRICE_WITH_DECIMALS =
        NEW_HOME_TWO_PRICE * Math.pow(10, await usdgToken.decimals());

      const NEW_HOME_THREE_PRICE = 2000;
      const NEW_HOME_THREE_PRICE_WITH_DECIMALS =
        NEW_HOME_THREE_PRICE * Math.pow(10, await usdgToken.decimals());

      await reit.appraiseHome(1, NEW_HOME_ONE_PRICE_WITH_DECIMALS);
      await reit.appraiseHome(2, NEW_HOME_TWO_PRICE_WITH_DECIMALS);
      await reit.appraiseHome(3, NEW_HOME_THREE_PRICE_WITH_DECIMALS);

      //check the new backing per token

      //check new backing price
      let current_backing_per_share_after_price_went_down =
        await reit.backingPerShare();
      //each has 6 decimals
      let expected_cash_reserves =
        INVESTMENT_MONEY_WITH_DECIMALS -
        (HOME_ONE_PRICE_WITH_DECIMALS +
          HOME_TWO_PRICE_WITH_DECIMALS +
          HOME_THREE_PRICE_WITH_DECIMALS);

      let new_total_home_price =
        NEW_HOME_ONE_PRICE_WITH_DECIMALS +
        NEW_HOME_TWO_PRICE_WITH_DECIMALS +
        NEW_HOME_THREE_PRICE_WITH_DECIMALS;

      let expected_backing_per_share_after_price_went_down =
        (new_total_home_price + expected_cash_reserves) /
        (await gpsyToken.totalSupply());
      let expected_backing_per_share_after_price_went_down_with_decimals =
        expected_backing_per_share_after_price_went_down *
        Math.pow(10, await usdgToken.decimals());

      expect(
        new BN(current_backing_per_share_after_price_went_down)
      ).to.be.bignumber.equal(
        new BN(expected_backing_per_share_after_price_went_down_with_decimals)
      );

      //check if the price per share is less then the initial
      expect(
        new BN(current_backing_per_share_after_price_went_down)
      ).to.be.bignumber.lessThan(new BN(current_backing_per_share));
    });

    it("Calculates backing per Gypsy when there are multiple houses and cash reserves and the price of all of the homes goes down", async () => {
      let before_balance = await usdgToken.balanceOf(reit.address);
      expect(before_balance).to.be.bignumber.equal(new BN(0));

      //make sure there are no homes yet
      let house_count = await homeNft.count();
      expect(house_count).to.be.bignumber.equal(new BN(0));

      const INVESTMENT_MONEY = 20000;
      const INVESTMENT_MONEY_WITH_DECIMALS =
        INVESTMENT_MONEY * Math.pow(10, await usdgToken.decimals());

      const GYPSY_TOKEN_AMOUNT = INVESTMENT_MONEY / 100;
      const GYPSY_TOKEN_AMOUNT_WITH_DECIMALS =
        GYPSY_TOKEN_AMOUNT * Math.pow(10, await gpsyToken.decimals());

      //gives the investor the money to invest
      await usdgToken.mint(investor, new BN(INVESTMENT_MONEY_WITH_DECIMALS), {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.approve(
        reit.address,
        new BN(INVESTMENT_MONEY_WITH_DECIMALS),
        {
          from: investor,
          gas: 5000000,
          gasPrice: 500000000,
        }
      );

      await reit.buy(new BN(GYPSY_TOKEN_AMOUNT_WITH_DECIMALS), {
        from: investor,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //check if the investor has the Gypsy
      let investor_gypsy_balance = await gpsyToken.balanceOf(investor);
      expect(investor_gypsy_balance).to.be.bignumber.equal(
        new BN(GYPSY_TOKEN_AMOUNT_WITH_DECIMALS)
      );

      //check if REIT has the USDG
      let reit_usdg_balance = await usdgToken.balanceOf(reit.address);
      expect(reit_usdg_balance).to.be.bignumber.equal(
        new BN(INVESTMENT_MONEY_WITH_DECIMALS)
      );

      //Now have the REIT purchase the homes.
      const RENT_PRICE = 5000 * Math.pow(10, await usdgToken.decimals());

      const HOME_ONE_PRICE = 9000;
      const HOME_ONE_PRICE_WITH_DECIMALS =
        HOME_ONE_PRICE * Math.pow(10, await usdgToken.decimals());

      const HOME_TWO_PRICE = 4000;
      const HOME_TWO_PRICE_WITH_DECIMALS =
        HOME_TWO_PRICE * Math.pow(10, await usdgToken.decimals());

      const HOME_THREE_PRICE = 3000;
      const HOME_THREE_PRICE_WITH_DECIMALS =
        HOME_THREE_PRICE * Math.pow(10, await usdgToken.decimals());

      //buy home #1
      await reit.addHome(
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_ONE_PRICE_WITH_DECIMALS
      );

      //buy home #2
      await reit.addHome(
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_TWO_PRICE_WITH_DECIMALS
      );

      //buy home #3
      await reit.addHome(
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_THREE_PRICE_WITH_DECIMALS
      );

      //check added homes
      let num_properties = await reit.numberOfProperties();
      expect(num_properties).to.be.bignumber.equal(new BN(3));

      //CHECK BACKING PER TOKEN is correct @ 100 a token
      let current_backing_per_share = await reit.backingPerShare();
      //each has 6 decimals
      let expected_backing_per_share = INVESTMENT_MONEY / GYPSY_TOKEN_AMOUNT;
      let expected_backing_per_share_with_decimals =
        expected_backing_per_share * Math.pow(10, await usdgToken.decimals());
      expect(new BN(current_backing_per_share)).to.be.bignumber.equal(
        new BN(expected_backing_per_share_with_decimals)
      );

      //now the price of all three homes goes down

      const NEW_HOME_ONE_PRICE = 8000;
      const NEW_HOME_ONE_PRICE_WITH_DECIMALS =
        NEW_HOME_ONE_PRICE * Math.pow(10, await usdgToken.decimals());

      const NEW_HOME_TWO_PRICE = 3000;
      const NEW_HOME_TWO_PRICE_WITH_DECIMALS =
        NEW_HOME_TWO_PRICE * Math.pow(10, await usdgToken.decimals());

      const NEW_HOME_THREE_PRICE = 2000;
      const NEW_HOME_THREE_PRICE_WITH_DECIMALS =
        NEW_HOME_THREE_PRICE * Math.pow(10, await usdgToken.decimals());

      await reit.appraiseHome(1, NEW_HOME_ONE_PRICE_WITH_DECIMALS);
      await reit.appraiseHome(2, NEW_HOME_TWO_PRICE_WITH_DECIMALS);
      await reit.appraiseHome(3, NEW_HOME_THREE_PRICE_WITH_DECIMALS);

      //check the new backing per token

      //check new backing price
      let current_backing_per_share_after_price_went_down =
        await reit.backingPerShare();
      //each has 6 decimals
      let expected_cash_reserves =
        INVESTMENT_MONEY_WITH_DECIMALS -
        (HOME_ONE_PRICE_WITH_DECIMALS +
          HOME_TWO_PRICE_WITH_DECIMALS +
          HOME_THREE_PRICE_WITH_DECIMALS);

      let new_total_home_price =
        NEW_HOME_ONE_PRICE_WITH_DECIMALS +
        NEW_HOME_TWO_PRICE_WITH_DECIMALS +
        NEW_HOME_THREE_PRICE_WITH_DECIMALS;

      let expected_backing_per_share_after_price_went_down =
        (new_total_home_price + expected_cash_reserves) /
        (await gpsyToken.totalSupply());

      let expected_backing_per_share_after_price_went_down_with_decimals =
        expected_backing_per_share_after_price_went_down *
        Math.pow(10, await usdgToken.decimals());

      expect(
        new BN(current_backing_per_share_after_price_went_down)
      ).to.be.bignumber.equal(
        new BN(expected_backing_per_share_after_price_went_down_with_decimals)
      );

      //check if the price per share is less then the initial
      expect(
        new BN(current_backing_per_share_after_price_went_down)
      ).to.be.bignumber.lessThan(new BN(current_backing_per_share));

      //check if the price per share is less then the initial
      expect(
        new BN(current_backing_per_share_after_price_went_down)
      ).to.be.bignumber.lessThan(new BN(current_backing_per_share));
    });

    it("Calculates backing per Gypsy when there are multiple houses and no cash reserves and the price of all of the homes goes up", async () => {
      let before_balance = await usdgToken.balanceOf(reit.address);
      expect(before_balance).to.be.bignumber.equal(new BN(0));

      //make sure there are no homes yet
      let house_count = await homeNft.count();
      expect(house_count).to.be.bignumber.equal(new BN(0));

      const INVESTMENT_MONEY = 20000;
      const INVESTMENT_MONEY_WITH_DECIMALS =
        INVESTMENT_MONEY * Math.pow(10, await usdgToken.decimals());

      const GYPSY_TOKEN_AMOUNT = INVESTMENT_MONEY / 100;
      const GYPSY_TOKEN_AMOUNT_WITH_DECIMALS =
        GYPSY_TOKEN_AMOUNT * Math.pow(10, await gpsyToken.decimals());

      //gives the investor the money to invest
      await usdgToken.mint(investor, new BN(INVESTMENT_MONEY_WITH_DECIMALS), {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.approve(
        reit.address,
        new BN(INVESTMENT_MONEY_WITH_DECIMALS),
        {
          from: investor,
          gas: 5000000,
          gasPrice: 500000000,
        }
      );

      await reit.buy(new BN(GYPSY_TOKEN_AMOUNT_WITH_DECIMALS), {
        from: investor,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //check if the investor has the Gypsy
      let investor_gypsy_balance = await gpsyToken.balanceOf(investor);
      expect(investor_gypsy_balance).to.be.bignumber.equal(
        new BN(GYPSY_TOKEN_AMOUNT_WITH_DECIMALS)
      );

      //check if REIT has the USDG
      let reit_usdg_balance = await usdgToken.balanceOf(reit.address);
      expect(reit_usdg_balance).to.be.bignumber.equal(
        new BN(INVESTMENT_MONEY_WITH_DECIMALS)
      );

      //Now have the REIT purchase the homes.
      const RENT_PRICE = 5000 * Math.pow(10, await usdgToken.decimals());

      const HOME_ONE_PRICE = 10000;
      const HOME_ONE_PRICE_WITH_DECIMALS =
        HOME_ONE_PRICE * Math.pow(10, await usdgToken.decimals());

      const HOME_TWO_PRICE = 5000;
      const HOME_TWO_PRICE_WITH_DECIMALS =
        HOME_TWO_PRICE * Math.pow(10, await usdgToken.decimals());

      const HOME_THREE_PRICE = 5000;
      const HOME_THREE_PRICE_WITH_DECIMALS =
        HOME_THREE_PRICE * Math.pow(10, await usdgToken.decimals());

      //buy home #1
      await reit.addHome(
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_ONE_PRICE_WITH_DECIMALS
      );

      //buy home #2
      await reit.addHome(
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_TWO_PRICE_WITH_DECIMALS
      );

      //buy home #3
      await reit.addHome(
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_THREE_PRICE_WITH_DECIMALS
      );

      //check added homes
      let num_properties = await reit.numberOfProperties();
      expect(num_properties).to.be.bignumber.equal(new BN(3));

      //CHECK BACKING PER TOKEN is correct @ 100 a token
      let current_backing_per_share = await reit.backingPerShare();
      //each has 6 decimals
      let expected_backing_per_share = INVESTMENT_MONEY / GYPSY_TOKEN_AMOUNT;
      let expected_backing_per_share_with_decimals =
        expected_backing_per_share * Math.pow(10, await usdgToken.decimals());

      expect(new BN(current_backing_per_share)).to.be.bignumber.equal(
        new BN(expected_backing_per_share_with_decimals)
      );

      //now the price of all three homes goes up
      const NEW_HOME_ONE_PRICE = 12000;
      const NEW_HOME_ONE_PRICE_WITH_DECIMALS =
        NEW_HOME_ONE_PRICE * Math.pow(10, await usdgToken.decimals());

      const NEW_HOME_TWO_PRICE = 7000;
      const NEW_HOME_TWO_PRICE_WITH_DECIMALS =
        NEW_HOME_TWO_PRICE * Math.pow(10, await usdgToken.decimals());

      const NEW_HOME_THREE_PRICE = 8000;
      const NEW_HOME_THREE_PRICE_WITH_DECIMALS =
        NEW_HOME_THREE_PRICE * Math.pow(10, await usdgToken.decimals());

      await reit.appraiseHome(1, NEW_HOME_ONE_PRICE_WITH_DECIMALS);
      await reit.appraiseHome(2, NEW_HOME_TWO_PRICE_WITH_DECIMALS);
      await reit.appraiseHome(3, NEW_HOME_THREE_PRICE_WITH_DECIMALS);

      //check the new backing per token

      //check new backing price
      let current_backing_per_share_after_price_went_down =
        await reit.backingPerShare();
      //each has 6 decimals
      let expected_cash_reserves =
        INVESTMENT_MONEY_WITH_DECIMALS -
        (HOME_ONE_PRICE_WITH_DECIMALS +
          HOME_TWO_PRICE_WITH_DECIMALS +
          HOME_THREE_PRICE_WITH_DECIMALS);

      let new_total_home_price =
        NEW_HOME_ONE_PRICE_WITH_DECIMALS +
        NEW_HOME_TWO_PRICE_WITH_DECIMALS +
        NEW_HOME_THREE_PRICE_WITH_DECIMALS;

      let expected_backing_per_share_after_price_went_down =
        (new_total_home_price + expected_cash_reserves) /
        (await gpsyToken.totalSupply());
      let expected_backing_per_share_after_price_went_down_with_decimals =
        expected_backing_per_share_after_price_went_down *
        Math.pow(10, await usdgToken.decimals());

      expect(
        new BN(current_backing_per_share_after_price_went_down)
      ).to.be.bignumber.equal(
        new BN(expected_backing_per_share_after_price_went_down_with_decimals)
      );

      //check if the price per share is less then the initial
      expect(
        new BN(current_backing_per_share_after_price_went_down)
      ).to.be.bignumber.greaterThan(new BN(current_backing_per_share));
    });

    it("Calculates backing per Gypsy when there are multiple houses and cash reserves and the price of all of the homes goes up", async () => {
      let before_balance = await usdgToken.balanceOf(reit.address);
      expect(before_balance).to.be.bignumber.equal(new BN(0));

      //make sure there are no homes yet
      let house_count = await homeNft.count();
      expect(house_count).to.be.bignumber.equal(new BN(0));

      const INVESTMENT_MONEY = 20000;
      const INVESTMENT_MONEY_WITH_DECIMALS =
        INVESTMENT_MONEY * Math.pow(10, await usdgToken.decimals());

      const GYPSY_TOKEN_AMOUNT = INVESTMENT_MONEY / 100;
      const GYPSY_TOKEN_AMOUNT_WITH_DECIMALS =
        GYPSY_TOKEN_AMOUNT * Math.pow(10, await gpsyToken.decimals());

      //gives the investor the money to invest
      await usdgToken.mint(investor, new BN(INVESTMENT_MONEY_WITH_DECIMALS), {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.approve(
        reit.address,
        new BN(INVESTMENT_MONEY_WITH_DECIMALS),
        {
          from: investor,
          gas: 5000000,
          gasPrice: 500000000,
        }
      );

      await reit.buy(new BN(GYPSY_TOKEN_AMOUNT_WITH_DECIMALS), {
        from: investor,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //check if the investor has the Gypsy
      let investor_gypsy_balance = await gpsyToken.balanceOf(investor);
      expect(investor_gypsy_balance).to.be.bignumber.equal(
        new BN(GYPSY_TOKEN_AMOUNT_WITH_DECIMALS)
      );

      //check if REIT has the USDG
      let reit_usdg_balance = await usdgToken.balanceOf(reit.address);
      expect(reit_usdg_balance).to.be.bignumber.equal(
        new BN(INVESTMENT_MONEY_WITH_DECIMALS)
      );

      //Now have the REIT purchase the homes.
      const RENT_PRICE = 5000 * Math.pow(10, await usdgToken.decimals());

      const HOME_ONE_PRICE = 8000;
      const HOME_ONE_PRICE_WITH_DECIMALS =
        HOME_ONE_PRICE * Math.pow(10, await usdgToken.decimals());

      const HOME_TWO_PRICE = 4000;
      const HOME_TWO_PRICE_WITH_DECIMALS =
        HOME_TWO_PRICE * Math.pow(10, await usdgToken.decimals());

      const HOME_THREE_PRICE = 3000;
      const HOME_THREE_PRICE_WITH_DECIMALS =
        HOME_THREE_PRICE * Math.pow(10, await usdgToken.decimals());

      //buy home #1
      await reit.addHome(
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_ONE_PRICE_WITH_DECIMALS
      );

      //buy home #2
      await reit.addHome(
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_TWO_PRICE_WITH_DECIMALS
      );

      //buy home #3
      await reit.addHome(
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_THREE_PRICE_WITH_DECIMALS
      );

      //check added homes
      let num_properties = await reit.numberOfProperties();
      expect(num_properties).to.be.bignumber.equal(new BN(3));

      //CHECK BACKING PER TOKEN is correct @ 100 a token
      let current_backing_per_share = await reit.backingPerShare();
      //each has 6 decimals
      let expected_backing_per_share = INVESTMENT_MONEY / GYPSY_TOKEN_AMOUNT;
      let expected_backing_per_share_with_decimals =
        expected_backing_per_share * Math.pow(10, await usdgToken.decimals());
      expect(new BN(current_backing_per_share)).to.be.bignumber.equal(
        new BN(expected_backing_per_share_with_decimals)
      );

      //now the price of all three homes goes down

      const NEW_HOME_ONE_PRICE = 10000;
      const NEW_HOME_ONE_PRICE_WITH_DECIMALS =
        NEW_HOME_ONE_PRICE * Math.pow(10, await usdgToken.decimals());

      const NEW_HOME_TWO_PRICE = 7000;
      const NEW_HOME_TWO_PRICE_WITH_DECIMALS =
        NEW_HOME_TWO_PRICE * Math.pow(10, await usdgToken.decimals());

      const NEW_HOME_THREE_PRICE = 8000;
      const NEW_HOME_THREE_PRICE_WITH_DECIMALS =
        NEW_HOME_THREE_PRICE * Math.pow(10, await usdgToken.decimals());

      await reit.appraiseHome(1, NEW_HOME_ONE_PRICE_WITH_DECIMALS);
      await reit.appraiseHome(2, NEW_HOME_TWO_PRICE_WITH_DECIMALS);
      await reit.appraiseHome(3, NEW_HOME_THREE_PRICE_WITH_DECIMALS);

      //check the new backing per token

      //check new backing price
      let current_backing_per_share_after_price_went_down =
        await reit.backingPerShare();
      //each has 6 decimals
      let expected_cash_reserves =
        INVESTMENT_MONEY_WITH_DECIMALS -
        (HOME_ONE_PRICE_WITH_DECIMALS +
          HOME_TWO_PRICE_WITH_DECIMALS +
          HOME_THREE_PRICE_WITH_DECIMALS);

      let new_total_home_price =
        NEW_HOME_ONE_PRICE_WITH_DECIMALS +
        NEW_HOME_TWO_PRICE_WITH_DECIMALS +
        NEW_HOME_THREE_PRICE_WITH_DECIMALS;

      let expected_backing_per_share_after_price_went_down =
        (new_total_home_price + expected_cash_reserves) /
        (await gpsyToken.totalSupply());
      let expected_backing_per_share_after_price_went_down_with_decimals =
        expected_backing_per_share_after_price_went_down *
        Math.pow(10, await usdgToken.decimals());

      expect(
        new BN(current_backing_per_share_after_price_went_down)
      ).to.be.bignumber.equal(
        new BN(expected_backing_per_share_after_price_went_down_with_decimals)
      );

      //check if the price per share is less then the initial
      expect(
        new BN(current_backing_per_share_after_price_went_down)
      ).to.be.bignumber.greaterThan(new BN(current_backing_per_share));
    });

    it("Calculates backing per Gypsy when there are multiple houses and no cash reserves and the price of all of the homes changes", async () => {
      let before_balance = await usdgToken.balanceOf(reit.address);
      expect(before_balance).to.be.bignumber.equal(new BN(0));

      //make sure there are no homes yet
      let house_count = await homeNft.count();
      expect(house_count).to.be.bignumber.equal(new BN(0));

      const INVESTMENT_MONEY = 20000;
      const INVESTMENT_MONEY_WITH_DECIMALS =
        INVESTMENT_MONEY * Math.pow(10, await usdgToken.decimals());

      const GYPSY_TOKEN_AMOUNT = INVESTMENT_MONEY / 100;
      const GYPSY_TOKEN_AMOUNT_WITH_DECIMALS =
        GYPSY_TOKEN_AMOUNT * Math.pow(10, await gpsyToken.decimals());

      //gives the investor the money to invest
      await usdgToken.mint(investor, new BN(INVESTMENT_MONEY_WITH_DECIMALS), {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.approve(
        reit.address,
        new BN(INVESTMENT_MONEY_WITH_DECIMALS),
        {
          from: investor,
          gas: 5000000,
          gasPrice: 500000000,
        }
      );

      await reit.buy(new BN(GYPSY_TOKEN_AMOUNT_WITH_DECIMALS), {
        from: investor,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //check if the investor has the Gypsy
      let investor_gypsy_balance = await gpsyToken.balanceOf(investor);
      expect(investor_gypsy_balance).to.be.bignumber.equal(
        new BN(GYPSY_TOKEN_AMOUNT_WITH_DECIMALS)
      );

      //check if REIT has the USDG
      let reit_usdg_balance = await usdgToken.balanceOf(reit.address);
      expect(reit_usdg_balance).to.be.bignumber.equal(
        new BN(INVESTMENT_MONEY_WITH_DECIMALS)
      );

      //Now have the REIT purchase the homes.
      const RENT_PRICE = 5000 * Math.pow(10, await usdgToken.decimals());

      const HOME_ONE_PRICE = 10000;
      const HOME_ONE_PRICE_WITH_DECIMALS =
        HOME_ONE_PRICE * Math.pow(10, await usdgToken.decimals());

      const HOME_TWO_PRICE = 6000;
      const HOME_TWO_PRICE_WITH_DECIMALS =
        HOME_TWO_PRICE * Math.pow(10, await usdgToken.decimals());

      const HOME_THREE_PRICE = 4000;
      const HOME_THREE_PRICE_WITH_DECIMALS =
        HOME_THREE_PRICE * Math.pow(10, await usdgToken.decimals());

      //buy home #1
      await reit.addHome(
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_ONE_PRICE_WITH_DECIMALS
      );

      //buy home #2
      await reit.addHome(
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_TWO_PRICE_WITH_DECIMALS
      );

      //buy home #3
      await reit.addHome(
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_THREE_PRICE_WITH_DECIMALS
      );

      //check added homes
      let num_properties = await reit.numberOfProperties();
      expect(num_properties).to.be.bignumber.equal(new BN(3));

      //CHECK BACKING PER TOKEN is correct @ 100 a token
      let current_backing_per_share = await reit.backingPerShare();
      //each has 6 decimals
      let expected_backing_per_share = INVESTMENT_MONEY / GYPSY_TOKEN_AMOUNT;
      let expected_backing_per_share_with_decimals =
        expected_backing_per_share * Math.pow(10, await usdgToken.decimals());
      expect(new BN(current_backing_per_share)).to.be.bignumber.equal(
        new BN(expected_backing_per_share_with_decimals)
      );

      //now the price of all three homes goes down

      const NEW_HOME_ONE_PRICE = 11000;
      const NEW_HOME_ONE_PRICE_WITH_DECIMALS =
        NEW_HOME_ONE_PRICE * Math.pow(10, await usdgToken.decimals());

      const NEW_HOME_TWO_PRICE = 6000;
      const NEW_HOME_TWO_PRICE_WITH_DECIMALS =
        NEW_HOME_TWO_PRICE * Math.pow(10, await usdgToken.decimals());

      const NEW_HOME_THREE_PRICE = 3000;
      const NEW_HOME_THREE_PRICE_WITH_DECIMALS =
        NEW_HOME_THREE_PRICE * Math.pow(10, await usdgToken.decimals());

      await reit.appraiseHome(1, NEW_HOME_ONE_PRICE_WITH_DECIMALS);
      await reit.appraiseHome(2, NEW_HOME_TWO_PRICE_WITH_DECIMALS);
      await reit.appraiseHome(3, NEW_HOME_THREE_PRICE_WITH_DECIMALS);

      //check the new backing per token

      //check new backing price
      let current_backing_per_share_after_price_went_down =
        await reit.backingPerShare();
      //each has 6 decimals
      let expected_cash_reserves =
        INVESTMENT_MONEY_WITH_DECIMALS -
        (HOME_ONE_PRICE_WITH_DECIMALS +
          HOME_TWO_PRICE_WITH_DECIMALS +
          HOME_THREE_PRICE_WITH_DECIMALS);

      let new_total_home_price =
        NEW_HOME_ONE_PRICE_WITH_DECIMALS +
        NEW_HOME_TWO_PRICE_WITH_DECIMALS +
        NEW_HOME_THREE_PRICE_WITH_DECIMALS;

      let expected_backing_per_share_after_price_went_down =
        (new_total_home_price + expected_cash_reserves) /
        (await gpsyToken.totalSupply());

      let expected_backing_per_share_after_price_went_down_with_decimals =
        expected_backing_per_share_after_price_went_down *
        Math.pow(10, await usdgToken.decimals());

      expect(
        new BN(current_backing_per_share_after_price_went_down)
      ).to.be.bignumber.equal(
        new BN(expected_backing_per_share_after_price_went_down_with_decimals)
      );
    });

    it("Calculates backing per Gypsy when there are multiple houses and cash reserves and the price of all of the homes changes", async () => {
      let before_balance = await usdgToken.balanceOf(reit.address);
      expect(before_balance).to.be.bignumber.equal(new BN(0));

      //make sure there are no homes yet
      let house_count = await homeNft.count();
      expect(house_count).to.be.bignumber.equal(new BN(0));

      const INVESTMENT_MONEY = 20000;
      const INVESTMENT_MONEY_WITH_DECIMALS =
        INVESTMENT_MONEY * Math.pow(10, await usdgToken.decimals());

      const GYPSY_TOKEN_AMOUNT = INVESTMENT_MONEY / 100;
      const GYPSY_TOKEN_AMOUNT_WITH_DECIMALS =
        GYPSY_TOKEN_AMOUNT * Math.pow(10, await gpsyToken.decimals());

      //gives the investor the money to invest
      await usdgToken.mint(investor, new BN(INVESTMENT_MONEY_WITH_DECIMALS), {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.approve(
        reit.address,
        new BN(INVESTMENT_MONEY_WITH_DECIMALS),
        {
          from: investor,
          gas: 5000000,
          gasPrice: 500000000,
        }
      );

      await reit.buy(new BN(GYPSY_TOKEN_AMOUNT_WITH_DECIMALS), {
        from: investor,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //check if the investor has the Gypsy
      let investor_gypsy_balance = await gpsyToken.balanceOf(investor);
      expect(investor_gypsy_balance).to.be.bignumber.equal(
        new BN(GYPSY_TOKEN_AMOUNT_WITH_DECIMALS)
      );

      //check if REIT has the USDG
      let reit_usdg_balance = await usdgToken.balanceOf(reit.address);
      expect(reit_usdg_balance).to.be.bignumber.equal(
        new BN(INVESTMENT_MONEY_WITH_DECIMALS)
      );

      //Now have the REIT purchase the homes.
      const RENT_PRICE = 5000 * Math.pow(10, await usdgToken.decimals());

      const HOME_ONE_PRICE = 10000;
      const HOME_ONE_PRICE_WITH_DECIMALS =
        HOME_ONE_PRICE * Math.pow(10, await usdgToken.decimals());

      const HOME_TWO_PRICE = 5000;
      const HOME_TWO_PRICE_WITH_DECIMALS =
        HOME_TWO_PRICE * Math.pow(10, await usdgToken.decimals());

      const HOME_THREE_PRICE = 3000;
      const HOME_THREE_PRICE_WITH_DECIMALS =
        HOME_THREE_PRICE * Math.pow(10, await usdgToken.decimals());

      //buy home #1
      await reit.addHome(
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_ONE_PRICE_WITH_DECIMALS
      );

      //buy home #2
      await reit.addHome(
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_TWO_PRICE_WITH_DECIMALS
      );

      //buy home #3
      await reit.addHome(
        HOME_DATA_URI,
        RENT_PRICE,
        HOME_THREE_PRICE_WITH_DECIMALS
      );

      //check added homes
      let num_properties = await reit.numberOfProperties();
      expect(num_properties).to.be.bignumber.equal(new BN(3));

      //CHECK BACKING PER TOKEN is correct @ 100 a token
      let current_backing_per_share = await reit.backingPerShare();
      //each has 6 decimals
      let expected_backing_per_share = INVESTMENT_MONEY / GYPSY_TOKEN_AMOUNT;
      let expected_backing_per_share_with_decimals =
        expected_backing_per_share * Math.pow(10, await usdgToken.decimals());
      expect(new BN(current_backing_per_share)).to.be.bignumber.equal(
        new BN(expected_backing_per_share_with_decimals)
      );

      //now the price of all three homes goes down

      const NEW_HOME_ONE_PRICE = 11000;
      const NEW_HOME_ONE_PRICE_WITH_DECIMALS =
        NEW_HOME_ONE_PRICE * Math.pow(10, await usdgToken.decimals());

      const NEW_HOME_TWO_PRICE = 6000;
      const NEW_HOME_TWO_PRICE_WITH_DECIMALS =
        NEW_HOME_TWO_PRICE * Math.pow(10, await usdgToken.decimals());

      const NEW_HOME_THREE_PRICE = 2500;
      const NEW_HOME_THREE_PRICE_WITH_DECIMALS =
        NEW_HOME_THREE_PRICE * Math.pow(10, await usdgToken.decimals());

      await reit.appraiseHome(1, NEW_HOME_ONE_PRICE_WITH_DECIMALS);
      await reit.appraiseHome(2, NEW_HOME_TWO_PRICE_WITH_DECIMALS);
      await reit.appraiseHome(3, NEW_HOME_THREE_PRICE_WITH_DECIMALS);

      //check the new backing per token

      //check new backing price
      let current_backing_per_share_after_price_went_down =
        await reit.backingPerShare();

      let expected_cash_reserves =
        INVESTMENT_MONEY_WITH_DECIMALS -
        (HOME_ONE_PRICE_WITH_DECIMALS +
          HOME_TWO_PRICE_WITH_DECIMALS +
          HOME_THREE_PRICE_WITH_DECIMALS);

      let new_total_home_price =
        NEW_HOME_ONE_PRICE_WITH_DECIMALS +
        NEW_HOME_TWO_PRICE_WITH_DECIMALS +
        NEW_HOME_THREE_PRICE_WITH_DECIMALS;

      let expected_backing_per_share_after_price_went_down =
        (new_total_home_price + expected_cash_reserves) /
        (await gpsyToken.totalSupply());

      let expected_backing_per_share_after_price_went_down_with_decimals =
        expected_backing_per_share_after_price_went_down *
        Math.pow(10, await usdgToken.decimals());

      expect(
        new BN(current_backing_per_share_after_price_went_down)
      ).to.be.bignumber.equal(
        new BN(expected_backing_per_share_after_price_went_down_with_decimals)
      );
    });
  });

  describe("Financials", async () => {
    it("Calculates NAV when there are no houses and only cash reserves", async () => {
      const INVESTMENT_MONEY = 100000000;
      const GYPSY_TOKEN_AMOUNT = INVESTMENT_MONEY / 100;
      //gives the investor the money to invest
      await usdgToken.mint(investor, new BN(INVESTMENT_MONEY), {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await usdgToken.approve(reit.address, new BN(INVESTMENT_MONEY), {
        from: investor,
        gas: 5000000,
        gasPrice: 500000000,
      });

      await reit.buy(new BN(GYPSY_TOKEN_AMOUNT), {
        from: investor,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //check if the investor has the Gypsy
      let investor_gypsy_balance = await gpsyToken.balanceOf(investor);

      expect(investor_gypsy_balance).to.be.bignumber.equal(
        new BN(GYPSY_TOKEN_AMOUNT)
      );

      //check if REIT has the USDG
      let reit_usdg_balance = await usdgToken.balanceOf(reit.address);
      expect(reit_usdg_balance).to.be.bignumber.equal(new BN(INVESTMENT_MONEY));

      //NOW WE CHECK NAV
      let current_nav = await reit.nav();
      expect(current_nav).to.be.bignumber.equal(new BN(INVESTMENT_MONEY));
    });

    it("Calculates NAV when there are 1 house and no cash reserves", async () => {
      //give the reit the money for the home
      await usdgToken.mint(reit.address, new BN(HOME_PURCHASE_PRICE), {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //buy home
      await reit.addHome(HOME_DATA_URI, RENT_PRICE, HOME_PURCHASE_PRICE, {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //NOW WE CHECK NAV
      let current_nav = await reit.nav();
      expect(current_nav).to.be.bignumber.equal(new BN(HOME_PURCHASE_PRICE));
    });

    it("Calculates NAV when there are 1 house and cash reserves", async () => {
      //gives the reit 2 times the Home pruchase price
      const AMNT_USDG_TO_GIVE_REIT = HOME_PURCHASE_PRICE * 2;
      const CASH_RESERVES = AMNT_USDG_TO_GIVE_REIT - HOME_PURCHASE_PRICE;
      //give the reit the money for the home
      await usdgToken.mint(reit.address, new BN(AMNT_USDG_TO_GIVE_REIT), {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //buy home
      await reit.addHome(HOME_DATA_URI, RENT_PRICE, HOME_PURCHASE_PRICE, {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //Check the NAV
      let current_nav = await reit.nav();
      expect(current_nav).to.be.bignumber.equal(
        new BN(CASH_RESERVES + HOME_PURCHASE_PRICE)
      );
    });

    it("Calculates total assets value when there are no houses", async () => {
      let current_total_assets = await reit.totalAssets();
      expect(current_total_assets).to.be.bignumber.equal(new BN(0));
    });

    it("Calculates total assets value when there are 1 house", async () => {
      //give the reit the money for the home
      await usdgToken.mint(reit.address, new BN(HOME_PURCHASE_PRICE), {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //buy home
      await reit.addHome(HOME_DATA_URI, RENT_PRICE, HOME_PURCHASE_PRICE, {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //NOW WE CHECK total assets
      let current_total_assets = await reit.totalAssets();
      expect(current_total_assets).to.be.bignumber.equal(
        new BN(HOME_PURCHASE_PRICE)
      );
    });

    it("Calculates total assets value when there are multiple houses", async () => {
      //give the reit the money for the home
      await usdgToken.mint(reit.address, new BN(HOME_PURCHASE_PRICE * 2), {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //buy home #1
      await reit.addHome(HOME_DATA_URI, RENT_PRICE, HOME_PURCHASE_PRICE, {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //buy home #2
      await reit.addHome(HOME_DATA_URI, RENT_PRICE, HOME_PURCHASE_PRICE, {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //NOW WE CHECK total assets
      let current_total_assets = await reit.totalAssets();
      expect(current_total_assets).to.be.bignumber.equal(
        new BN(HOME_PURCHASE_PRICE * 2)
      );
    });

    it("Calculates total assets value when there are no houses", async () => {
      let current_total_rent = await reit.totalRent();
      expect(current_total_rent).to.be.bignumber.equal(new BN(0));
    });

    it("Calculates total monthly rent value when there are 1 house", async () => {
      //give the reit the money for the home
      await usdgToken.mint(reit.address, new BN(HOME_PURCHASE_PRICE), {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //add home
      await reit.addHome(HOME_DATA_URI, RENT_PRICE, HOME_PURCHASE_PRICE, {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //check total monthly rent
      let current_total_rent = await reit.totalRent();
      expect(current_total_rent).to.be.bignumber.equal(new BN(RENT_PRICE));
    });

    it("Calculates total monthly rent value when there are multiple houses", async () => {
      //give the reit the money for the home
      await usdgToken.mint(reit.address, new BN(HOME_PURCHASE_PRICE * 3), {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //add home #1
      await reit.addHome(HOME_DATA_URI, RENT_PRICE, HOME_PURCHASE_PRICE, {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //add home #2
      await reit.addHome(HOME_DATA_URI, RENT_PRICE, HOME_PURCHASE_PRICE, {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //add home #3
      await reit.addHome(HOME_DATA_URI, RENT_PRICE, HOME_PURCHASE_PRICE, {
        from: currentOwner,
        gas: 5000000,
        gasPrice: 500000000,
      });

      //check total monthly rent
      let current_total_rent = await reit.totalRent();
      expect(current_total_rent).to.be.bignumber.equal(new BN(RENT_PRICE * 3));
    });
  });
});
