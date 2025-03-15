import { FFmpegService } from './ffmpeg';
import * as path from 'path';
import { config } from '../config/config';
import { promises as fs } from 'fs';
import { StorageService } from '../services/storage.service';

export class AudioConverter {
    /**
     * Convierte un archivo de video o audio a formato FLAC
     * @param inputPath Ruta completa del archivo (local o gs://)
     * @returns Ruta completa del archivo FLAC resultante
     */
    static async convertToFlac(inputPath: string): Promise<string> {
        let localInputPath = inputPath;
        
        // Si el archivo está en Cloud Storage, descargarlo primero
        if (inputPath.startsWith('gs://')) {
            console.log('☁️ Descargando archivo desde Cloud Storage...');
            const fileName = inputPath.split('/').pop();
            if (!fileName) throw new Error('Nombre de archivo inválido');
            localInputPath = path.join(config.tempDir, fileName);
            await StorageService.downloadFile(fileName, config.tempDir);
        }

        const fileExt = path.extname(localInputPath).toLowerCase();
        let outputPath: string;
        
        try {
            // La función convertToFlac ahora retorna la ruta completa
            outputPath = await FFmpegService.convertVideoToFlac(localInputPath);

            // Si estamos en Render, subir el resultado a Cloud Storage
            if (config.useCloudStorage) {
                console.log('☁️ Subiendo archivo FLAC a Cloud Storage...');
                const cloudPath = await StorageService.handleTempFile(outputPath);
                
                // Limpiar archivo local después de subir
                if (localInputPath !== inputPath) {
                    await fs.unlink(localInputPath);
                }
                await fs.unlink(outputPath);
                
                return cloudPath;
            }

            return outputPath;
        } catch (error) {
            // Limpiar archivo local en caso de error
            if (localInputPath !== inputPath) {
                try {
                    await fs.unlink(localInputPath);
                } catch (e) {
                    console.warn('Error al limpiar archivo temporal:', e);
                }
            }
            throw error;
        }
    }
}