const { BN, expectEvent, expectRevert } = require("@openzeppelin/test-helpers");

function convertToBNDecimals(number, decimals) {
  let bn_a = new BN(number.toString());
  let bn_b = new BN(10);
  bn_b = bn_b.pow(decimals);

  return bn_a.mul(bn_b);
}

module.exports = {
  convertToBNDecimals,
};
