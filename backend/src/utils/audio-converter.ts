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
        let downloadedFromCloud = false;
        
        // Si el archivo está en Cloud Storage, descargarlo primero
        if (inputPath.startsWith('gs://')) {
            console.log('☁️ Descargando archivo desde Cloud Storage...');
            const fileName = inputPath.split('/').pop();
            if (!fileName) throw new Error('Nombre de archivo inválido');
            localInputPath = path.join(config.tempDir, fileName);
            await StorageService.downloadFile(fileName, config.tempDir);
            downloadedFromCloud = true;
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
                
                // CORRECIÓN: Solo intentar eliminar el archivo local si realmente existe
                // y si fue uno que descargamos de Cloud Storage
                if (downloadedFromCloud && localInputPath !== inputPath) {
                    try {
                        // Verificar si el archivo existe antes de intentar eliminarlo
                        const fileExists = await this.fileExists(localInputPath);
                        if (fileExists) {
                            console.log(`🗑️ Eliminando archivo temporal descargado: ${localInputPath}`);
                            await fs.unlink(localInputPath);
                        } else {
                            console.log(`⚠️ Archivo temporal ya no existe, posiblemente eliminado por FFmpegService: ${localInputPath}`);
                        }
                    } catch (e) {
                        console.warn('Advertencia al limpiar archivo temporal descargado:', e);
                    }
                }
                
                // Limpiar archivo de salida después de subir a Cloud Storage
                try {
                    const outputFileExists = await this.fileExists(outputPath);
                    if (outputFileExists) {
                        console.log(`🗑️ Eliminando archivo temporal de salida: ${outputPath}`);
                        await fs.unlink(outputPath);
                    } else {
                        console.log(`⚠️ Archivo de salida ya no existe: ${outputPath}`);
                    }
                } catch (e) {
                    console.warn('Advertencia al limpiar archivo de salida:', e);
                }
                
                return cloudPath;
            }

            return outputPath;
        } catch (error) {
            // Limpiar archivo local en caso de error
            if (downloadedFromCloud && localInputPath !== inputPath) {
                try {
                    const fileExists = await this.fileExists(localInputPath);
                    if (fileExists) {
                        console.log(`🗑️ [ERROR] Eliminando archivo temporal: ${localInputPath}`);
                        await fs.unlink(localInputPath);
                    }
                } catch (e) {
                    console.warn('Error al limpiar archivo temporal:', e);
                }
            }
            throw error;
        }
    }
    
    /**
     * Comprueba si un archivo existe
     * @param filePath Ruta del archivo a comprobar
     * @returns true si existe, false si no
     */
    private static async fileExists(filePath: string): Promise<boolean> {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }
}