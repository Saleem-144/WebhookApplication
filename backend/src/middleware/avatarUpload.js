import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const avatarsDir = path.join(__dirname, '../../uploads/avatars');

fs.mkdirSync(avatarsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, avatarsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const safeExt = allowed.includes(ext) ? ext : '.jpg';
    cb(null, `${randomUUID()}${safeExt}`);
  },
});

const avatarMulter = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|gif|webp)$/i.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, GIF, or WebP images are allowed'));
    }
  },
});

/**
 * Multer middleware with JSON error response on failure
 */
export const uploadAvatarMiddleware = (req, res, next) => {
  avatarMulter.single('avatar')(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        error: err.message || 'Invalid file upload',
        code: 'INVALID_UPLOAD',
      });
    }
    next();
  });
};
