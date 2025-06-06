const hre = require("hardhat");
const { getCreateAddress, parseEther, parseUnits } = require("ethers");

const FACTORY_NONCE = 1;
const FACTORY_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"; // AccountFactory address
const EP_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";     // EntryPoint address

async function main() {
    const entryPoint = await hre.ethers.getContractAt("EntryPoint", EP_ADDRESS);
    const AccountFactory = await hre.ethers.getContractFactory("AccountFactory");
    const Account = await hre.ethers.getContractFactory("Account");
    const [signer0] = await hre.ethers.getSigners();
    const address0 = await signer0.getAddress();

    // Predict smart account address from factory
    const sender = getCreateAddress({
        from: FACTORY_ADDRESS,
        nonce: FACTORY_NONCE,
    });
    console.log("Predicted sender:", sender);

    // Build initCode to deploy smart account using factory
    const initCode = FACTORY_ADDRESS + AccountFactory.interface
        .encodeFunctionData("createAccount", [address0])
        .slice(2);

    // Check if contract already deployed
    const code = await hre.ethers.provider.getCode(sender);
    console.log("Sender code:", code.length > 2 ? "Exists " : "Not Deployed ");

    // Fund sender for EntryPoint
    console.log(" Depositing ETH to EntryPoint...");
    await entryPoint.depositTo(sender, {
        value: parseEther("0.1"),
    });

    // Build user operation
    const userOp = {
        sender,
        nonce: await entryPoint.getNonce(sender, 0),
        initCode,
        callData: Account.interface.encodeFunctionData("execute"),
        callGasLimit: 200_000,
        verificationGasLimit: 200_000,
        preVerificationGas: 50_000,
        maxFeePerGas: parseUnits("10", "gwei"),
        maxPriorityFeePerGas: parseUnits("5", "gwei"),
        paymasterAndData: "0x",
        signature: "0x", // dummy signature
    };

    console.log("Sending userOp...");
    try {
        const tx = await entryPoint.handleOps([userOp], address0);
        const receipt = await tx.wait();
        console.log("Tx success:", receipt.hash);
        console.log("Gas used:", receipt.gasUsed.toString());
    } catch (err) {
        console.error("handleOps reverted:");
        console.error(err);
    }
}

main().catch((error) => {
    console.error("Script failed:", error);
    process.exitCode = 1;
});
