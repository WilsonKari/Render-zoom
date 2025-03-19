"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioConverter = void 0;
const ffmpeg_1 = require("./ffmpeg");
const path = __importStar(require("path"));
const config_1 = require("../config/config");
const fs_1 = require("fs");
const storage_service_1 = require("../services/storage.service");
class AudioConverter {
    /**
     * Convierte un archivo de video o audio a formato FLAC
     * @param inputPath Ruta completa del archivo (local o gs://)
     * @returns Ruta completa del archivo FLAC resultante
     */
    static async convertToFlac(inputPath) {
        let localInputPath = inputPath;
        let downloadedFromCloud = false;
        // Si el archivo está en Cloud Storage, descargarlo primero
        if (inputPath.startsWith('gs://')) {
            console.log('☁️ Descargando archivo desde Cloud Storage...');
            const fileName = inputPath.split('/').pop();
            if (!fileName)
                throw new Error('Nombre de archivo inválido');
            localInputPath = path.join(config_1.config.tempDir, fileName);
            await storage_service_1.StorageService.downloadFile(fileName, config_1.config.tempDir);
            downloadedFromCloud = true;
        }
        const fileExt = path.extname(localInputPath).toLowerCase();
        let outputPath;
        try {
            // La función convertToFlac ahora retorna la ruta completa
            outputPath = await ffmpeg_1.FFmpegService.convertVideoToFlac(localInputPath);
            // Si estamos en Render, subir el resultado a Cloud Storage
            if (config_1.config.useCloudStorage) {
                console.log('☁️ Subiendo archivo FLAC a Cloud Storage...');
                const cloudPath = await storage_service_1.StorageService.handleTempFile(outputPath);
                // CORRECIÓN: Solo intentar eliminar el archivo local si realmente existe
                // y si fue uno que descargamos de Cloud Storage
                if (downloadedFromCloud && localInputPath !== inputPath) {
                    try {
                        // Verificar si el archivo existe antes de intentar eliminarlo
                        const fileExists = await this.fileExists(localInputPath);
                        if (fileExists) {
                            console.log(`🗑️ Eliminando archivo temporal descargado: ${localInputPath}`);
                            await fs_1.promises.unlink(localInputPath);
                        }
                        else {
                            console.log(`⚠️ Archivo temporal ya no existe, posiblemente eliminado por FFmpegService: ${localInputPath}`);
                        }
                    }
                    catch (e) {
                        console.warn('Advertencia al limpiar archivo temporal descargado:', e);
                    }
                }
                // Limpiar archivo de salida después de subir a Cloud Storage
                try {
                    const outputFileExists = await this.fileExists(outputPath);
                    if (outputFileExists) {
                        console.log(`🗑️ Eliminando archivo temporal de salida: ${outputPath}`);
                        await fs_1.promises.unlink(outputPath);
                    }
                    else {
                        console.log(`⚠️ Archivo de salida ya no existe: ${outputPath}`);
                    }
                }
                catch (e) {
                    console.warn('Advertencia al limpiar archivo de salida:', e);
                }
                return cloudPath;
            }
            return outputPath;
        }
        catch (error) {
            // Limpiar archivo local en caso de error
            if (downloadedFromCloud && localInputPath !== inputPath) {
                try {
                    const fileExists = await this.fileExists(localInputPath);
                    if (fileExists) {
                        console.log(`🗑️ [ERROR] Eliminando archivo temporal: ${localInputPath}`);
                        await fs_1.promises.unlink(localInputPath);
                    }
                }
                catch (e) {
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
    static async fileExists(filePath) {
        try {
            await fs_1.promises.access(filePath);
            return true;
        }
        catch (_a) {
            return false;
        }
    }
}
exports.AudioConverter = AudioConverter;
