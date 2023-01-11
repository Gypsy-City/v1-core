const {
  BN,
  expectEvent,
  expectRevert,
  time,
} = require("@openzeppelin/test-helpers");

//calls the main function in the home NFT contract everyday
//returns the most recent transaction
async function upkeepSimulateDays(days, homeNft, currentOwner) {
  let latest_tx;
  for (let day = 0; day <= days; day++) {
    latest_tx = await homeNft.main({
      from: currentOwner,
      gas: 5000000,
      gasPrice: 500000000,
    });

    const blockNumBefore = await ethers.provider.getBlockNumber();
    const blockBefore = await ethers.provider.getBlock(blockNumBefore);
    const timestampBefore = blockBefore.timestamp;

    //wait a day to pass
    await time.increase(time.duration.days(1));
  }
  return latest_tx;
}

module.exports = {
  upkeepSimulateDays,
};
