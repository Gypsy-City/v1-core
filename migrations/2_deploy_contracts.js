const USDGToken = artifacts.require("../contracts/USDGToken.sol");

module.exports = async function (deployer) {
  await deployer.deploy(USDGToken);

  if (deployer.options.network_id == 42) {
    console.log("deploying on kovan");
  } else if (deployer.options.network_id == 1) {
    console.log("deploying on eth");
  } else {
    console.log("deployed on ganache");
  }
};
