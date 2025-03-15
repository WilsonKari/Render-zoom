import { Router } from 'express';
import { ConverterController } from '../controllers/converter.controller';
import { TranscriptionController } from '../controllers/transcription.controller';
import { ZoomTranscriptionController } from '../controllers/zoom-transcription.controller';
import { upload } from '../middlewares/upload.middleware';

const router = Router();

// Legacy route for video conversion
router.post('/convert', upload.single('video'), ConverterController.convertToMp3);

// Whisper API compatible routes
router.post('/whisper/transcriptions', upload.single('file'), TranscriptionController.transcribe);
router.post('/v1/audio/transcriptions', upload.single('file'), TranscriptionController.transcribe);

// Zoom transcription routes
router.post('/zoom/transcribe', ZoomTranscriptionController.transcribeZoom);
router.post('/v1/zoom/transcriptions', ZoomTranscriptionController.transcribeZoom);
router.get('/zoom/tasks/:taskId', ZoomTranscriptionController.getTaskProgress);
router.get('/v1/zoom/tasks/:taskId', ZoomTranscriptionController.getTaskProgress);
// Nuevas rutas para aceptar progreso mediante POST (mayor compatibilidad con clientes)
router.post('/zoom/tasks', ZoomTranscriptionController.getTaskProgress);
router.post('/v1/zoom/tasks', ZoomTranscriptionController.getTaskProgress);

export default router;