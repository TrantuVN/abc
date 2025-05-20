import { Request, Response } from 'express';
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import ScoinABI from '../abi/token.json';
import multer from 'multer';
const upload = multer();
dotenv.config();

const { ETH_RPC_URL, PRIVATE_KEY, SCOIN_ADDRESS } = process.env;

if (!PRIVATE_KEY || !SCOIN_ADDRESS) {
  console.error('Environment variables PRIVATE_KEY and SCOIN_ADDRESS must be set.');
  process.exit(1);
}

const provider = new ethers.providers.JsonRpcProvider(ETH_RPC_URL);
const signer = new ethers.Wallet(PRIVATE_KEY, provider);
const scoin = new ethers.Contract(SCOIN_ADDRESS, ScoinABI, signer);

// Stake tokens and render result
export const stakeTokens = async (req: Request, res: Response): Promise<void> => {
  const { validator, amount } = req.body;

  if (!validator || !amount) {
    res.status(400).render('token/stakeTokens', {
      message: 'Validator address and amount are required.',
    });
    return;
  }

  const tx = await scoin.stake(validator, ethers.utils.parseUnits(amount.toString(), 18));
  await tx.wait();

  res.status(200).render('token/staketx', {
    message: ` Staked! TxHash: ${tx.hash}`,
  });
  return;
};

//  Unstake tokens and render result
export const unstakeTokens = async (req: Request, res: Response): Promise<void> => {
  const { validator } = req.body;

  if (!validator) {
    res.status(400).render('token/unstakeTokens', {
      message: 'Validator address is required.',
    });
    return;
  }

  const tx = await scoin.unstake(validator);
  await tx.wait();

  res.status(200).render('token/unstaketx', {
    message: ` Unstaked! TxHash: ${tx.hash}`,
  });
  return;
};

// Get a validator's info
export const getValidatorInfo = async (req: Request, res: Response): Promise<void> => {
  const { address } = req.params;
  const info = await scoin.getValidatorInfo(address);

  res.status(200).render('token/info', { info });
  return;
};

//  Get all validators
export const getAllValidators = async (_req: Request, res: Response): Promise<void> => {
  const validators = await scoin.getValidators();

  res.status(200).render('token/validators', { validators });
  return;
};

//  Distribute rewards
export const distributeRewards = async (_req: Request, res: Response): Promise<void> => {
  const tx = await scoin.distributeRewards();
  await tx.wait();

  res.status(200).render('token/rewards', {
    message: `🎉 Rewards Distributed! TxHash: ${tx.hash}`,
  });
  return;
};