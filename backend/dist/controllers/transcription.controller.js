"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TranscriptionController = void 0;
const audio_converter_1 = require("../utils/audio-converter");
const speech_service_1 = require("../services/speech.service");
class TranscriptionController {
    static async transcribe(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'No se proporcionó ningún archivo' });
            }
            const inputPath = req.file.path;
            const language = req.body.language || 'es';
            const responseFormat = req.body.response_format || 'json';
            // Convertir el archivo a FLAC
            const audioFileName = await audio_converter_1.AudioConverter.convertToFlac(inputPath);
            // Procesar el audio y obtener la transcripción
            const result = await speech_service_1.AudioService.processAndTranscribeAudio(audioFileName);
            // Si es formato texto, reemplazar espacios con saltos de línea para mejor legibilidad
            if (responseFormat === 'text') {
                // Dividir por puntos y agregar saltos de línea
                const formattedText = result.transcription
                    .split('. ')
                    .join('.\n');
                res.setHeader('Content-Type', 'text/plain');
                res.send(formattedText);
            }
            else {
                // Para JSON, usar el texto sin saltos de línea (como ya viene del servicio)
                res.json({
                    text: result.transcription
                });
            }
        }
        catch (error) {
            console.error('Error en transcripción:', error);
            res.status(500).json({
                error: {
                    message: error.message,
                    type: 'processing_error'
                }
            });
        }
    }
}
exports.TranscriptionController = TranscriptionController;
