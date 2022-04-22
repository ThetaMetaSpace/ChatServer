  const Web3 = require("web3");
  const web3 = new Web3("https://eth-rpc-api-testnet.thetatoken.org/rpc");

  exports.getUserAddress = function (raw, signed) {
    return web3.eth.accounts.recover(raw, signed);
  };
