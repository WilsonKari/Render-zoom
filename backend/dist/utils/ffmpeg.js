"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FFmpegService = void 0;
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const ffmpeg_1 = __importDefault(require("@ffmpeg-installer/ffmpeg"));
const ffprobe_1 = __importDefault(require("@ffprobe-installer/ffprobe"));
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const config_1 = require("../config/config");
const os_1 = __importDefault(require("os"));
// Configurar el path de ffmpeg y ffprobe
fluent_ffmpeg_1.default.setFfmpegPath(ffmpeg_1.default.path);
fluent_ffmpeg_1.default.setFfprobePath(ffprobe_1.default.path);
// Detectar núcleos disponibles para FFmpeg
const cpuCount = os_1.default.cpus().length;
const recommendedThreads = Math.max(2, Math.min(cpuCount - 1, 8)); // Dejar al menos 1 núcleo libre, máximo 8
console.log('📍 FFmpeg path:', ffmpeg_1.default.path);
console.log('📍 FFprobe path:', ffprobe_1.default.path);
console.log(`💻 CPU cores disponibles: ${cpuCount}`);
console.log(`🧵 Threads recomendados para FFmpeg: ${recommendedThreads}`);
class FFmpegService {
    static async convertVideoToFlac(inputPath) {
        try {
            console.log('\n🎬 Iniciando conversión de video a formato de audio...');
            console.log(`📂 Archivo de entrada: ${inputPath}`);
            // Verificar que el archivo existe y su tamaño
            const stats = await fs_1.promises.stat(inputPath);
            const fileSizeMB = stats.size / (1024 * 1024);
            console.log(`📊 Tamaño del archivo de entrada: ${fileSizeMB.toFixed(2)} MB`);
            if (stats.size === 0) {
                throw new Error('El archivo está vacío');
            }
            if (stats.size > config_1.config.maxFileSize) {
                throw new Error(`El archivo excede el tamaño máximo permitido de ${(config_1.config.maxFileSize / (1024 * 1024 * 1024)).toFixed(1)}GB`);
            }
            // Verificar recursos del sistema
            const totalMemory = os_1.default.totalmem();
            const freeMemory = os_1.default.freemem();
            console.log('\n💻 Recursos del sistema:');
            console.log(`• Memoria total: ${(totalMemory / 1024 / 1024 / 1024).toFixed(2)} GB`);
            console.log(`• Memoria libre: ${(freeMemory / 1024 / 1024 / 1024).toFixed(2)} GB`);
            // Verificar la duración del video
            const duration = await this.getVideoDuration(inputPath);
            const durationInHours = duration / 3600;
            console.log(`⏱️ Duración del video: ${durationInHours.toFixed(2)} horas (${Math.floor(duration / 60)} minutos)`);
            if (duration * 1000 > config_1.config.maxVideoDuration) {
                throw new Error(`El video excede la duración máxima permitida de ${config_1.config.maxVideoDuration / (3600 * 1000)} horas`);
            }
            // Calcular tiempo estimado y timeout más corto debido a optimizaciones
            const estimatedTimeInMinutes = Math.ceil((duration / 60) * 0.5); // 0.5x el tiempo del video (más rápido)
            const timeoutInMinutes = Math.max(10, estimatedTimeInMinutes); // Mínimo 10 minutos
            console.log(`⏳ Tiempo estimado de conversión: ${estimatedTimeInMinutes} minutos`);
            console.log(`⏰ Timeout configurado: ${timeoutInMinutes} minutos`);
            // Nombres de archivos
            const baseName = path_1.default.parse(inputPath).name;
            const tempAudioPath = path_1.default.join(config_1.config.tempDir, `${baseName}_temp.wav`);
            const outputFileName = `${baseName}.wav`;
            const outputPath = path_1.default.join(config_1.config.tempDir, outputFileName);
            console.log(`📂 Archivo temporal: ${tempAudioPath}`);
            console.log(`📂 Archivo de salida final: ${outputPath}`);
            // PASO 1: Extraer sólo el audio (mucho más rápido)
            await this.extractAudioOnly(inputPath, tempAudioPath);
            console.log('\n✅ Extracción de audio completada');
            // PASO 2: Convertir el audio al formato LINEAR16 (WAV) optimizado para transcripción
            const result = await this.convertToLinear16(tempAudioPath, outputPath);
            console.log('\n✅ Conversión a LINEAR16 (WAV) completada');
            // Limpiar archivos temporales
            try {
                // Eliminar el archivo de video original
                await fs_1.promises.unlink(inputPath);
                console.log('🗑️ Archivo de video original eliminado');
                // Eliminar el audio temporal
                await fs_1.promises.unlink(tempAudioPath);
                console.log('🗑️ Archivo de audio temporal eliminado');
            }
            catch (error) {
                console.warn(`⚠️ Error al eliminar archivos temporales: ${error}`);
            }
            // Retornar la ruta completa en lugar de solo el nombre
            return outputPath;
        }
        catch (error) {
            console.error('❌ Error en FFmpegService:', error);
            throw error;
        }
    }
    /**
     * PASO 1: Extrae rápidamente solo el audio del video
     */
    static async extractAudioOnly(inputPath, outputPath) {
        return new Promise((resolve, reject) => {
            console.log('\n🎬 PASO 1: Extrayendo audio del video...');
            let errorOutput = '';
            let lastProgressUpdate = Date.now();
            let hasProgress = false;
            const command = (0, fluent_ffmpeg_1.default)(inputPath);
            command
                .noVideo() // Ignorar video, procesar solo audio
                .audioCodec('pcm_s16le') // Códec de audio sin comprimir
                .audioChannels(1) // Mono (1 canal)
                .audioFrequency(16000) // 16kHz (ideal para voz)
                .addOptions([
                `-threads ${recommendedThreads}`,
                '-y', // Sobrescribir archivo si existe
                '-nostdin', // Deshabilitar entrada estándar
                '-loglevel warning' // Solo mostrar warnings y errores
            ])
                .on('start', (commandLine) => {
                console.log('🔧 Comando FFmpeg (Paso 1):', commandLine);
            })
                .on('progress', (progress) => {
                hasProgress = true;
                const now = Date.now();
                if (now - lastProgressUpdate > 10000) { // Log cada 10 segundos
                    console.log(`⏳ Extrayendo audio... ${progress.timemark}`);
                    lastProgressUpdate = now;
                }
            })
                .on('stderr', (stderrLine) => {
                errorOutput += stderrLine + '\n';
            })
                .on('error', (error) => {
                console.error('❌ Error en la extracción de audio:', error.message);
                if (errorOutput) {
                    console.error('📝 Log de errores de FFmpeg:', errorOutput);
                }
                if (!hasProgress) {
                    console.error('⚠️ La extracción falló antes de comenzar el progreso');
                }
                reject(new Error(`Error en la extracción de audio: ${error.message}`));
            })
                .on('end', () => {
                resolve();
            });
            // Timeout para este paso (mucho más corto)
            const timeout = setTimeout(() => {
                command.kill('SIGTERM');
                reject(new Error('La extracción de audio excedió el tiempo límite'));
            }, 10 * 60 * 1000); // 10 minutos max
            command.save(outputPath)
                .on('end', () => clearTimeout(timeout))
                .on('error', () => clearTimeout(timeout));
        });
    }
    /**
     * PASO 2: Convierte el audio extraído a LINEAR16 (WAV) optimizado para Google Speech
     */
    static async convertToLinear16(inputPath, outputPath) {
        return new Promise((resolve, reject) => {
            console.log('\n🎬 PASO 2: Optimizando audio para transcripción...');
            let errorOutput = '';
            let lastProgressUpdate = Date.now();
            let hasProgress = false;
            const command = (0, fluent_ffmpeg_1.default)(inputPath);
            command
                .format('wav') // Formato WAV (LINEAR16)
                .audioCodec('pcm_s16le') // Códec LINEAR16
                .audioChannels(1) // Mono
                .audioFrequency(16000) // 16kHz (ideal para Speech-to-Text)
                .addOptions([
                `-threads ${recommendedThreads}`,
                '-y', // Sobrescribir
                '-nostdin', // No stdin
                '-loglevel warning' // Solo warnings y errores
            ])
                .on('start', (commandLine) => {
                console.log('🔧 Comando FFmpeg (Paso 2):', commandLine);
                console.log('⚙️ Configuración de audio:');
                console.log('• Formato: WAV (LINEAR16)');
                console.log('• Frecuencia: 16000 Hz');
                console.log('• Canales: 1 (mono)');
                console.log('• Códec: pcm_s16le (sin comprimir)');
            })
                .on('progress', (progress) => {
                hasProgress = true;
                const now = Date.now();
                if (now - lastProgressUpdate > 5000) { // Log cada 5 segundos
                    console.log(`⏳ Optimizando audio... ${progress.timemark}`);
                    lastProgressUpdate = now;
                }
            })
                .on('stderr', (stderrLine) => {
                errorOutput += stderrLine + '\n';
            })
                .on('error', (error) => {
                console.error('❌ Error en la optimización de audio:', error.message);
                if (errorOutput) {
                    console.error('📝 Log de errores de FFmpeg:', errorOutput);
                }
                reject(new Error(`Error en la optimización de audio: ${error.message}`));
            })
                .on('end', async () => {
                try {
                    // Verificar archivo de salida
                    const outputStats = await fs_1.promises.stat(outputPath);
                    console.log(`📊 Tamaño del archivo WAV: ${(outputStats.size / 1024 / 1024).toFixed(2)} MB`);
                    if (outputStats.size === 0) {
                        reject(new Error('El archivo de audio generado está vacío'));
                        return;
                    }
                    resolve();
                }
                catch (error) {
                    reject(error);
                }
            });
            // Timeout más corto para este paso
            const timeout = setTimeout(() => {
                command.kill('SIGTERM');
                reject(new Error('La optimización de audio excedió el tiempo límite'));
            }, 5 * 60 * 1000); // 5 minutos max
            command.save(outputPath)
                .on('end', () => clearTimeout(timeout))
                .on('error', () => clearTimeout(timeout));
        });
    }
    static getVideoDuration(filePath) {
        return new Promise((resolve, reject) => {
            fluent_ffmpeg_1.default.ffprobe(filePath, (err, metadata) => {
                if (err) {
                    reject(new Error(`Error obteniendo duración del video: ${err.message}`));
                    return;
                }
                if (!metadata.format || typeof metadata.format.duration !== 'number') {
                    reject(new Error('No se pudo determinar la duración del video'));
                    return;
                }
                resolve(metadata.format.duration); // Duración en segundos
            });
        });
    }
}
exports.FFmpegService = FFmpegService;
