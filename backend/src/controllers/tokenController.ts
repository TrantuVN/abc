import { Request, Response } from 'express';
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import ScoinABI from '../abi/Scoin.json';


dotenv.config();

const {
  ETH_RPC_URL,
  PRIVATE_KEY,
  SCOIN_ADDRESS
} = process.env;

if (!PRIVATE_KEY || !SCOIN_ADDRESS) {
  console.error('Environment variables PRIVATE_KEY and SCOIN_ADDRESS must be set.');
  process.exit(1);
}

const provider = new ethers.providers.JsonRpcProvider(ETH_RPC_URL); // ✅
;
const signer = new ethers.Wallet(PRIVATE_KEY!, provider);
const scoin = new ethers.Contract(SCOIN_ADDRESS!, ScoinABI, signer);

export const stakeTokens = async (req: Request, res: Response) => {
  const { validator, amount } = req.body;

  if (!validator || !amount) {
    return res.status(400).json({ error: 'Validator address and amount are required.' });
  }

  try {
    const tx = await scoin.stake(validator, ethers.utils.parseUnits(amount.toString(), 18));
    await tx.wait();
    res.json({ success: true, txHash: tx.hash });
  } catch (err: any) {
    console.error('Staking failed:', err);
    res.status(500).json({ error: err.message });
  }
};

export const unstakeTokens = async (req: Request, res: Response) => {
  const { validator } = req.body;

  if (!validator) {
    return res.status(400).json({ error: 'Validator address is required.' });
  }

  try {
    const tx = await scoin.unstake(validator);
    await tx.wait();
    res.json({ success: true, txHash: tx.hash });
  } catch (err: any) {
    console.error('Unstaking failed:', err);
    res.status(500).json({ error: err.message });
  }
};

export const getValidatorInfo = async (req: Request, res: Response) => {
  const { address } = req.params;

  try {
    const info = await scoin.getValidatorInfo(address);
    res.json(info);
  } catch (err: any) {
    console.error('Fetching validator info failed:', err);
    res.status(500).json({ error: err.message });
  }
};

export const getAllValidators = async (_req: Request, res: Response) => {
  try {
    const validators = await scoin.getValidators();
    res.json(validators);
  } catch (err: any) {
    console.error('Fetching validators failed:', err);
    res.status(500).json({ error: err.message });
  }
};

export const distributeRewards = async (_req: Request, res: Response) => {
  try {
    const tx = await scoin.distributeRewards();
    await tx.wait();
    res.json({ success: true, txHash: tx.hash });
  } catch (err: any) {
    console.error('Reward distribution failed:', err);
    res.status(500).json({ error: err.message });
  }
};
