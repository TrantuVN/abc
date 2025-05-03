const { ethers } = require('hardhat');
const fs = require('fs');
require('dotenv').config();

async function main() {
  console.log('Starting deployment process...');

  // Get the contract factories
  const ContentManager = await ethers.getContractFactory('ContentManager');
  const BandwidthMarket = await ethers.getContractFactory('BandwidthMarket');
  const Scoin = await ethers.getContractFactory('Scoin');

  console.log('Deploying Scoin token...');
  const scoin = await Scoin.deploy();
  await scoin.deployed();
  console.log('Scoin deployed to:', scoin.address);

  console.log('Deploying BandwidthMarket...');
  const bandwidthMarket = await BandwidthMarket.deploy(scoin.address);
  await bandwidthMarket.deployed();
  console.log('BandwidthMarket deployed to:', bandwidthMarket.address);

  console.log('Deploying ContentManager...');
  const contentManager = await ContentManager.deploy(bandwidthMarket.address);
  await contentManager.deployed();
  console.log('ContentManager deployed to:', contentManager.address);

  // Update environment files with contract addresses
  const backendEnv = `
# Contract Addresses
CONTENT_MANAGER_ADDRESS=${contentManager.address}
BANDWIDTH_MARKET_ADDRESS=${bandwidthMarket.address}
SCOIN_TOKEN_ADDRESS=${scoin.address}
`;

  const frontendEnv = `
# Contract Addresses
VITE_CONTENT_MANAGER_ADDRESS=${contentManager.address}
VITE_BANDWIDTH_MARKET_ADDRESS=${bandwidthMarket.address}
VITE_SCOIN_TOKEN_ADDRESS=${scoin.address}
`;

  // Append contract addresses to .env files
  fs.appendFileSync('./backend/.env', backendEnv);
  fs.appendFileSync('./frontend/.env', frontendEnv);

  console.log('Deployment completed successfully!');
  console.log('Contract addresses have been updated in .env files');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });