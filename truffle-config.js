module.exports = {
  // The React app imports the compiled ABI from here
  contracts_build_directory: './client/src/artifacts',

  networks: {
    // Ganache GUI defaults; change host/port to match your workspace
    development: {
      host: "127.0.0.1",
      port: 7545,
      network_id: "5777",
    },
  },

  compilers: {
    solc: {
      version: "0.8.19",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200,
        },
      },
    },
  },

  db: {
    enabled: false
  }
};
