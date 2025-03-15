import { Request, Response } from 'express';
import { FFmpegService } from '../utils/ffmpeg';
import { AudioService } from '../services/speech.service';
import path from 'path';
import { config } from '../config/config';

export class ConverterController {
    static async convertToMp3(req: Request, res: Response) {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'No se proporcionó ningún archivo' });
            }

            const inputPath = req.file.path;
            // Convertir directamente a FLAC con las especificaciones correctas para Speech-to-Text
            const audioFileName = await FFmpegService.convertVideoToFlac(inputPath);

            // Procesar el audio y obtener la transcripción
            const result = await AudioService.processAndTranscribeAudio(audioFileName);
            
            res.status(200).json({
                message: 'Procesamiento exitoso',
                transcription: result.transcription,
                gcsUri: result.gcsUri
            });
        } catch (error: any) {
            res.status(500).json({
                error: 'Error en el procesamiento',
                details: error.message
            });
        }
    }
}