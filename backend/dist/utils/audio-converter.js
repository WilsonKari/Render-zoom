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
        // Si el archivo está en Cloud Storage, descargarlo primero
        if (inputPath.startsWith('gs://')) {
            console.log('☁️ Descargando archivo desde Cloud Storage...');
            const fileName = inputPath.split('/').pop();
            if (!fileName)
                throw new Error('Nombre de archivo inválido');
            localInputPath = path.join(config_1.config.tempDir, fileName);
            await storage_service_1.StorageService.downloadFile(fileName, config_1.config.tempDir);
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
                // Limpiar archivo local después de subir
                if (localInputPath !== inputPath) {
                    await fs_1.promises.unlink(localInputPath);
                }
                await fs_1.promises.unlink(outputPath);
                return cloudPath;
            }
            return outputPath;
        }
        catch (error) {
            // Limpiar archivo local en caso de error
            if (localInputPath !== inputPath) {
                try {
                    await fs_1.promises.unlink(localInputPath);
                }
                catch (e) {
                    console.warn('Error al limpiar archivo temporal:', e);
                }
            }
            throw error;
        }
    }
}
exports.AudioConverter = AudioConverter;
