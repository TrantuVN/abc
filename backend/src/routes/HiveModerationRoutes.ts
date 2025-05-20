// backend/src/routes/HiveModerationRoutes.ts
import express from 'express';
import multer from 'multer';
import { moderatescore } from '../controllers/HiveModerationController';

const router = express.Router();

// Setup multer (memory storage,  { dest: 'uploads/' } memory storage temporarrily)
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif|mp4|avi|mkv|pdf|doc|docx|xls|xlsx/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(file.originalname.split('.').pop() || '');
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('File type not supported'));
  }
});

// Route: POST /api/moderate

router.get('/moderate-score', moderatescore);
router.post('/moderate-score', upload.single('file'), moderatescore);
export default router;
