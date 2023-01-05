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

//Data
const HOME_ONE_URI = require("./data/home_one.json");

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

  describe("Gypsy backing", async () => {
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
      const HOME_ONE_VALUE = 8000;
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

      //check if the price per share is greater then the initial
      expect(
        new BN(current_backing_per_share_after_price_went_down)
      ).to.be.bignumber.greaterThan(new BN(new_current_backing_per_gypsy));

      //check if the REIT has the reserves
      let new_reit_usdg_balance = await usdgToken.balanceOf(reit.address);
      let expected_cash_reserves =
        2000 * Math.pow(10, await usdgToken.decimals()) +
        INVESTMENT_MONEY_WITH_DECIMALS;
      //check if REIT has the USDG

      expect(new_reit_usdg_balance).to.be.bignumber.equal(
        new BN(expected_cash_reserves)
      );
    });
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

    //now the REIT buys a home which leaves reserves
    const HOME_ONE_VALUE = 8000;
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
    await reit.addHome(HOME_DATA_URI, RENT_PRICE, HOME_ONE_VALUE_WITH_DECIMALS);

    //buy home #2
    await reit.addHome(HOME_DATA_URI, RENT_PRICE, HOME_TWO_VALUE_WITH_DECIMALS);

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

    //check if the price per share is greater then the initial
    expect(
      new BN(current_backing_per_share_after_price_went_down)
    ).to.be.bignumber.greaterThan(new BN(new_current_backing_per_gypsy));

    //check if the REIT has the reserves
    let new_reit_usdg_balance = await usdgToken.balanceOf(reit.address);
    let expected_cash_reserves =
      2000 * Math.pow(10, await usdgToken.decimals()) +
      INVESTMENT_MONEY_WITH_DECIMALS;
    //check if REIT has the USDG

    expect(new_reit_usdg_balance).to.be.bignumber.equal(
      new BN(expected_cash_reserves)
    );
  });
});
