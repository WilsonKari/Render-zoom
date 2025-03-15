import { Request, Response } from 'express';
import { AudioConverter } from '../utils/audio-converter';
import { AudioService } from '../services/speech.service';

export class TranscriptionController {
    static async transcribe(req: Request, res: Response) {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'No se proporcionó ningún archivo' });
            }

            const inputPath = req.file.path;
            const language = req.body.language || 'es';
            const responseFormat = req.body.response_format || 'json';

            // Convertir el archivo a FLAC
            const audioFileName = await AudioConverter.convertToFlac(inputPath);

            // Procesar el audio y obtener la transcripción
            const result = await AudioService.processAndTranscribeAudio(audioFileName);

            // Si es formato texto, reemplazar espacios con saltos de línea para mejor legibilidad
            if (responseFormat === 'text') {
                // Dividir por puntos y agregar saltos de línea
                const formattedText = result.transcription
                    .split('. ')
                    .join('.\n');
                res.setHeader('Content-Type', 'text/plain');
                res.send(formattedText);
            } else {
                // Para JSON, usar el texto sin saltos de línea (como ya viene del servicio)
                res.json({
                    text: result.transcription
                });
            }
        } catch (error: any) {
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