const USDGToken = artifacts.require("../contracts/USDGToken.sol");
const GPSYToken = artifacts.require("../contracts/TestGPSY.sol");
const HomeNFT = artifacts.require("../contracts/HomeNFT.sol");
const LGPSYToken = artifacts.require("../contracts/LGPSYToken.sol");

module.exports = async function (deployer, network, accounts) {
  console.log("======Starting deployment======");
  let USDGTokenContract = await deployer.deploy(USDGToken, {
    from: accounts[0],
  });

  console.log("Deployed USDG:", USDGToken.address);

  let GPSYTokenContract = await deployer.deploy(GPSYToken, {
    from: accounts[0],
  });

  console.log("Deployed GPSY:", GPSYToken.address);

  let HomeNFTContract = await deployer.deploy(
    HomeNFT,
    GPSYToken.address,
    USDGToken.address,
    { from: accounts[0] }
  );
  console.log("Deployed HomeNFT:", HomeNFT.address);
  //string memory name_, string memory symbol_, address owner_, address asset_, uint256 precision_

  let LGPSYTokenContract = await deployer.deploy(
    LGPSYToken,
    "Staked Gypsy",
    "sGPSY",
    accounts[0],
    GPSYTokenContract.address,
    18,
    {
      from: accounts[0],
    }
  );

  console.log("Deployed LGPSY:", LGPSYTokenContract.address);

  console.log("======Finished deployment======");
};
