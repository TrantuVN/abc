import { Request, Response, NextFunction } from 'express';
import { moderate } from '../services/HiveModeration';

export const moderatescore = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.file) {
    res.status(200).render('moderatescore/score', {});
    return;
  }

  const  score  = await moderate(req.file.path);
  res.status(200).send({ score: score });
};
