const accounts = require(`./test-wallets.js`).accounts;

module.exports = {
  configureYulOptimizer: true,
  skipFiles: ["./ERC20", "./interfaces", "./utils"],
  mocha: {
    enableTimeouts: false,
  },
  providerOptions: {
    accounts,
  },
  onCompileComplete: function () {
    console.log("Done Generating Coverage!");
  },
};
