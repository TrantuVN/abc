import { Request, Response } from 'express';
import HiveModeration from '../services/HiveModeration';

const hive = new HiveModeration();

export const moderateContent = async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'File is required' });

    const { buffer, mimetype } = req.file;
    const metadata = { cid: 'temp-placeholder' };

    const result = await hive.moderateFile(buffer, mimetype, metadata);

    res.status(200).json({
      isAllowed: result.isAccepted,
      confidence: result.confidence,
      categories: result.categories,
      details: result.moderationDetails
    });
  } catch (err: any) {
    console.error('Moderation failed:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
};