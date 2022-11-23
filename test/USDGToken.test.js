const { expect } = require("chai");
const log = require("./helpers/logger");
const { calculateETH } = require("./helpers/gasAverage");
const { BN, expectEvent, expectRevert } = require("@openzeppelin/test-helpers");

const USDGToken = artifacts.require("USDGToken");

contract("USDGToken", async (accounts) => {
  const tokenName = "USDGContract";
  const tokenSymbol = "USDG";
  const tokenDecimals = 6;
  let token;

  beforeEach(async () => {
    gasAverage = await fetch("https://ethgasstation.info/json/ethgasAPI.json")
      .then((resp) => resp.json())
      .then((data) => data.average);
    token = await USDGToken.new();
    //give the owner 10k tokens
    await token.mint(accounts[0], 10000, { from: accounts[0] });
  });

  describe("constructor", async () => {
    it("test correct setting of vanity information", async () => {
      const name = await token.name.call();
      assert.strictEqual(name, tokenName);

      const decimals = await token.decimals.call();
      assert.strictEqual(decimals.toNumber(), tokenDecimals);

      const symbol = await token.symbol.call();
      assert.strictEqual(symbol, tokenSymbol);
    });
  });

  describe("transfers", async () => {
    it("should transfer 10000 to accounts[1] with accounts[0] having 10000", async () => {
      await token.transfer(accounts[1], 10000, { from: accounts[0] });
      const balance = await token.balanceOf.call(accounts[1]);
      assert.strictEqual(balance.toNumber(), 10000);
    });

    it("should fail when trying to transfer 10001 to accounts[1] with accounts[0] having 10000", async () => {
      let threw = false;
      try {
        await token.transfer.call(accounts[1], 10001, { from: accounts[0] });
      } catch (e) {
        threw = true;
      }
      assert.equal(threw, true);
    });

    it("should handle zero-transfers normally", async () => {
      assert(
        await token.transfer.call(accounts[1], 0, { from: accounts[0] }),
        "zero-transfer has failed"
      );
    });
  });

  // NOTE: testing uint256 wrapping is impossible since you can't supply > 2^256 -1
  // todo: transfer max amounts

  // APPROVALS
  describe("approvals", async () => {
    it("approvals: msg.sender should approve 100 to accounts[1]", async () => {
      await token.approve(accounts[1], 100, { from: accounts[0] });
      const allowance = await token.allowance.call(accounts[0], accounts[1]);
      assert.strictEqual(allowance.toNumber(), 100);
    });

    // bit overkill. But is for testing a bug
    it("msg.sender approves accounts[1] of 100 & withdraws 20 once.", async () => {
      const balance0 = await token.balanceOf.call(accounts[0]);
      assert.strictEqual(balance0.toNumber(), 10000);

      await token.approve(accounts[1], 100, { from: accounts[0] }); // 100
      const balance2 = await token.balanceOf.call(accounts[2]);
      assert.strictEqual(balance2.toNumber(), 0, "balance2 not correct");

      await token.transferFrom.call(accounts[0], accounts[2], 20, {
        from: accounts[1],
      });
      await token.allowance.call(accounts[0], accounts[1]);
      await token.transferFrom(accounts[0], accounts[2], 20, {
        from: accounts[1],
      }); // -20
      const allowance01 = await token.allowance.call(accounts[0], accounts[1]);
      assert.strictEqual(allowance01.toNumber(), 80); // =80

      const balance22 = await token.balanceOf.call(accounts[2]);
      assert.strictEqual(balance22.toNumber(), 20);

      const balance02 = await token.balanceOf.call(accounts[0]);
      assert.strictEqual(balance02.toNumber(), 9980);
    });

    // should approve 100 of msg.sender & withdraw 50, twice. (should succeed)
    it("msg.sender approves accounts[1] of 100 & withdraws 20 twice.", async () => {
      await token.approve(accounts[1], 100, { from: accounts[0] });
      const allowance01 = await token.allowance.call(accounts[0], accounts[1]);
      assert.strictEqual(allowance01.toNumber(), 100);

      await token.transferFrom(accounts[0], accounts[2], 20, {
        from: accounts[1],
      });
      const allowance012 = await token.allowance.call(accounts[0], accounts[1]);
      assert.strictEqual(allowance012.toNumber(), 80);

      const balance2 = await token.balanceOf.call(accounts[2]);
      assert.strictEqual(balance2.toNumber(), 20);

      const balance0 = await token.balanceOf.call(accounts[0]);
      assert.strictEqual(balance0.toNumber(), 9980);

      // FIRST tx done.
      // onto next.
      await token.transferFrom(accounts[0], accounts[2], 20, {
        from: accounts[1],
      });
      const allowance013 = await token.allowance.call(accounts[0], accounts[1]);
      assert.strictEqual(allowance013.toNumber(), 60);

      const balance22 = await token.balanceOf.call(accounts[2]);
      assert.strictEqual(balance22.toNumber(), 40);

      const balance02 = await token.balanceOf.call(accounts[0]);
      assert.strictEqual(balance02.toNumber(), 9960);
    });

    // should approve 100 of msg.sender & withdraw 50 & 60 (should fail).
    it("msg.sender approves accounts[1] of 100 & withdraws 50 & 60 (2nd tx should fail)", async () => {
      await token.approve(accounts[1], 100, { from: accounts[0] });
      const allowance01 = await token.allowance.call(accounts[0], accounts[1]);
      assert.strictEqual(allowance01.toNumber(), 100);

      await token.transferFrom(accounts[0], accounts[2], 50, {
        from: accounts[1],
      });
      const allowance012 = await token.allowance.call(accounts[0], accounts[1]);
      assert.strictEqual(allowance012.toNumber(), 50);

      const balance2 = await token.balanceOf.call(accounts[2]);
      assert.strictEqual(balance2.toNumber(), 50);

      const balance0 = await token.balanceOf.call(accounts[0]);
      assert.strictEqual(balance0.toNumber(), 9950);

      // FIRST tx done.
      // onto next.
      let threw = false;
      try {
        await token.transferFrom.call(accounts[0], accounts[2], 60, {
          from: accounts[1],
        });
      } catch (e) {
        threw = true;
      }
      assert.equal(threw, true);
    });

    it("attempt withdrawal from account with no allowance (should fail)", async () => {
      let threw = false;
      try {
        await token.transferFrom.call(accounts[0], accounts[2], 60, {
          from: accounts[1],
        });
      } catch (e) {
        threw = true;
      }
      assert.equal(threw, true);
    });

    it("allow accounts[1] 100 to withdraw from accounts[0]. Withdraw 60 and then approve 0 & attempt transfer.", async () => {
      await token.approve(accounts[1], 100, { from: accounts[0] });
      await token.transferFrom(accounts[0], accounts[2], 60, {
        from: accounts[1],
      });
      await token.approve(accounts[1], 0, { from: accounts[0] });
      let threw = false;
      try {
        await token.transferFrom.call(accounts[0], accounts[2], 10, {
          from: accounts[1],
        });
      } catch (e) {
        threw = true;
      }
      assert.equal(threw, true);
    });

    it("approve max (2^256 - 1)", async () => {
      await token.approve(
        accounts[1],
        "115792089237316195423570985008687907853269984665640564039457584007913129639935",
        { from: accounts[0] }
      );
      const allowance = await token.allowance(accounts[0], accounts[1]);
      assert.strictEqual(
        allowance.toString(),
        "115792089237316195423570985008687907853269984665640564039457584007913129639935"
      );
    });

    // should approve max of msg.sender & withdraw 20 without changing allowance (should succeed).
    it("msg.sender approves accounts[1] of max (2^256 - 1) & withdraws 20", async () => {
      const balance0 = await token.balanceOf.call(accounts[0]);
      assert.strictEqual(balance0.toNumber(), 10000);

      const max =
        "115792089237316195423570985008687907853269984665640564039457584007913129639935";
      await token.approve(accounts[1], max, { from: accounts[0] });
      const balance2 = await token.balanceOf.call(accounts[2]);
      assert.strictEqual(balance2.toNumber(), 0, "balance2 not correct");

      await token.transferFrom(accounts[0], accounts[2], 20, {
        from: accounts[1],
      });
      const allowance01 = await token.allowance.call(accounts[0], accounts[1]);
      assert.strictEqual(allowance01.toString(), max);

      const balance22 = await token.balanceOf.call(accounts[2]);
      assert.strictEqual(balance22.toNumber(), 20);

      const balance02 = await token.balanceOf.call(accounts[0]);
      assert.strictEqual(balance02.toNumber(), 9980);
    });
  });

  /*
  describe("events", async () => {
    it("events: should fire Transfer event properly", async () => {
      const res = await token.transfer(accounts[1], "2666", {
        from: accounts[0],
      });
      const transferLog = res.logs.find(
        (element) =>
          element.event.match("Transfer") &&
          element.address.match(token.address)
      );
      assert.strictEqual(transferLog.args._from, accounts[0]);
      // L2 ETH transfer also emits a transfer event
      assert.strictEqual(transferLog.args._to, accounts[1]);
      assert.strictEqual(transferLog.args._value.toString(), "2666");
    });

    it("events: should fire Transfer event normally on a zero transfer", async () => {
      const res = await token.transfer(accounts[1], "0", { from: accounts[0] });
      const transferLog = res.logs.find(
        (element) =>
          element.event.match("Transfer") &&
          element.address.match(token.address)
      );
      assert.strictEqual(transferLog.args._from, accounts[0]);
      assert.strictEqual(transferLog.args._to, accounts[1]);
      assert.strictEqual(transferLog.args._value.toString(), "0");
    });

    it("events: should fire Approval event properly", async () => {
      const res = await token.approve(accounts[1], "2666", {
        from: accounts[0],
      });
      const approvalLog = res.logs.find((element) =>
        element.event.match("Approval")
      );
      assert.strictEqual(approvalLog.args._owner, accounts[0]);
      assert.strictEqual(approvalLog.args._spender, accounts[1]);
      assert.strictEqual(approvalLog.args._value.toString(), "2666");
    });
  });
  */
});
