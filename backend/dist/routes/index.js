"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const converter_controller_1 = require("../controllers/converter.controller");
const transcription_controller_1 = require("../controllers/transcription.controller");
const zoom_transcription_controller_1 = require("../controllers/zoom-transcription.controller");
const upload_middleware_1 = require("../middlewares/upload.middleware");
const router = (0, express_1.Router)();
// Legacy route for video conversion
router.post('/convert', upload_middleware_1.upload.single('video'), converter_controller_1.ConverterController.convertToMp3);
// Whisper API compatible routes
router.post('/whisper/transcriptions', upload_middleware_1.upload.single('file'), transcription_controller_1.TranscriptionController.transcribe);
router.post('/v1/audio/transcriptions', upload_middleware_1.upload.single('file'), transcription_controller_1.TranscriptionController.transcribe);
// Zoom transcription routes
router.post('/zoom/transcribe', zoom_transcription_controller_1.ZoomTranscriptionController.transcribeZoom);
router.post('/v1/zoom/transcriptions', zoom_transcription_controller_1.ZoomTranscriptionController.transcribeZoom);
router.get('/zoom/tasks/:taskId', zoom_transcription_controller_1.ZoomTranscriptionController.getTaskProgress);
router.get('/v1/zoom/tasks/:taskId', zoom_transcription_controller_1.ZoomTranscriptionController.getTaskProgress);
// Nuevas rutas para aceptar progreso mediante POST (mayor compatibilidad con clientes)
router.post('/zoom/tasks', zoom_transcription_controller_1.ZoomTranscriptionController.getTaskProgress);
router.post('/v1/zoom/tasks', zoom_transcription_controller_1.ZoomTranscriptionController.getTaskProgress);
exports.default = router;
