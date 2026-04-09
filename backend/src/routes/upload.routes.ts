import { Router } from 'express';
import multer from 'multer';
import cloudinary from '../lib/cloudinary';

const router = Router();

// Configura o multer para usar memória (não salva no disco do servidor)
const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post('/', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhuma imagem enviada' });
    }

    // Converte o buffer para base64 para o Cloudinary
    const fileBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

    const result = await cloudinary.uploader.upload(fileBase64, {
      folder: 'go-city/posts',
      resource_type: 'auto',
    });

    return res.json({
      url: result.secure_url,
      public_id: result.public_id,
    });
  } catch (error) {
    console.error('Erro no upload Cloudinary:', error);
    return res.status(500).json({ error: 'Erro ao fazer upload da imagem' });
  }
});

export default router;
