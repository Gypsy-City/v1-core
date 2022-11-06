const USDGToken = artifacts.require("USDGToken");

contract("USDGToken", function (accounts) {
  it("USDG Contract is deployed", async function () {
    await USDGToken.deployed();
    return assert.isTrue(true);
  });
  it("Mint tokens", async function () {
    const instance = await USDGToken.deployed();
    const to = accounts[1];
    const amount = 100;
    const newAmount = amount * 10 ** 18;
    await instance.mint(to, amount);
    const balance = await instance.balanceOf(to);
    assert.equal(balance, newAmount);
  });
});
