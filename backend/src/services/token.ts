import { ethers } from "ethers";
import ScoinABI from "../abi/scoin.json";

const SCOIN_ADDRESS = "0xYourScoinContract";
const provider = new ethers.JsonRpcProvider("https://sepolia.infura.io/v3/YOUR_INFURA_KEY");
const signer = new ethers.Wallet(process.env.SIGNER_PRIVATE_KEY!, provider);
const scoin = new ethers.Contract(SCOIN_ADDRESS, ScoinABI, signer);

export async function recordUserLike(userAddress: string) {
  const tx = await scoin.recordLike(userAddress);
  await tx.wait();
}

export async function updateModeration(userAddress: string, score: number) {
  const scaledScore = ethers.parseUnits(score.toString(), 18); // score ∈ [0,1] scaled to 1e18
  const tx = await scoin.updateModerationScore(userAddress, scaledScore);
  await tx.wait();
}
export default updateModeration;