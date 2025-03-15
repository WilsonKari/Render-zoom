"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConverterController = void 0;
const ffmpeg_1 = require("../utils/ffmpeg");
const speech_service_1 = require("../services/speech.service");
class ConverterController {
    static async convertToMp3(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'No se proporcionó ningún archivo' });
            }
            const inputPath = req.file.path;
            // Convertir directamente a FLAC con las especificaciones correctas para Speech-to-Text
            const audioFileName = await ffmpeg_1.FFmpegService.convertVideoToFlac(inputPath);
            // Procesar el audio y obtener la transcripción
            const result = await speech_service_1.AudioService.processAndTranscribeAudio(audioFileName);
            res.status(200).json({
                message: 'Procesamiento exitoso',
                transcription: result.transcription,
                gcsUri: result.gcsUri
            });
        }
        catch (error) {
            res.status(500).json({
                error: 'Error en el procesamiento',
                details: error.message
            });
        }
    }
}
exports.ConverterController = ConverterController;
