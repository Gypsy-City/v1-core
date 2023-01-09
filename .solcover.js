const accounts = require(`./test-wallets.js`).accounts;

module.exports = {
  configureYulOptimizer: true,
  skipFiles: ["./mocks", "./interfaces", "./dependencies"],
  mocha: {
    enableTimeouts: false,
  },
  providerOptions: {
    accounts,
  },
  onCompileComplete: function () {
    console.log("onCompileComplete hook");
  },
};
