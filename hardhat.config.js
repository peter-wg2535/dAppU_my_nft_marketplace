require("@nomiclabs/hardhat-waffle");
require('dotenv').config()


module.exports = {
  solidity: "0.8.4",
  // defaultNetwork: "localhost",
  networks: {
    kovan: {
      url: process.env.API_URL,
      accounts: ["0x"+process.env.PRIVATE_KEY]
    }
  },
  paths: {
    artifacts: "./src/backend/artifacts",
    sources: "./src/backend/contracts",
    cache: "./src/backend/cache",
    tests: "./src/backend/test"
  },
};
