// routes/HiveModerationRoutes.ts

import express from 'express';
import multer from 'multer';
import { moderateContent } from '../controllers/HiveModerationController';

const router = express.Router();
const upload = multer();

// POST /api/moderate
router.post('/moderate', upload.single('file'), moderateContent);

export { router as HiveModerationRoutes };
