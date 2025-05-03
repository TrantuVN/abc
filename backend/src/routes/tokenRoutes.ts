import express from 'express';
import {
  stakeTokens,
  unstakeTokens,
  getValidatorInfo,
  getAllValidators,
  distributeRewards
} from '../controllers/tokenController';

const router = express.Router();

router.post('/stake', stakeTokens);
router.post('/unstake', unstakeTokens);
router.get('/validator/:address', getValidatorInfo);
router.get('/validators', getAllValidators);
router.post('/rewards/distribute', distributeRewards);

export default router;
