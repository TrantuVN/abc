const hre = require("hardhat");

async function main() {
    // Deploy the EntryPoint contract
    const af = await hre.ethers.deployContract("AccountFactory");

    // Wait for the deployment transaction to be mined
    await af.waitForDeployment();

    // Log the deployed address of the EntryPoint contract
    console.log(`AF deployed to ${af.target}`);
}

// Handle errors during deployment
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});