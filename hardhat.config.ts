import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "solidity-coverage";

const config: HardhatUserConfig = {
  solidity: {
    compilers: [{ version: "0.8.21" }],
  },
  etherscan: {
    apiKey: "M35XT4VJ5KA54GMCYXE4J8J26SKVT1AT72",
  },
  networks: {
    ganache: {
      url: "http://127.0.0.1:8545",
      chainId: 1337,
      accounts: [
        `0xa97c31ee1e4c16b99ad2db59a72ae3712cbda97410fa01a0b43dcb7fa8272116`,
      ],
    },
    mumbai: {
      url: "https://polygon-mumbai.g.alchemy.com/v2/D3rlXfbqP3PgNg449a_43sQpr6IDtp8m",
      chainId: 80001,
      accounts: [
        "98123401202c2e9d743e715c62af6b44e59d3b0726372cb6f2f18b922c67ed6a",
      ],
    },
  },  
};

export default config;
