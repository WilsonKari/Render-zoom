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
exports.ZoomTranscriptionController = void 0;
const zoom_service_1 = require("../services/zoom.service");
const audio_converter_1 = require("../utils/audio-converter");
const speech_service_1 = require("../services/speech.service");
const task_service_1 = require("../services/task.service");
const storage_service_1 = require("../services/storage.service");
const fs = __importStar(require("fs"));
const config_1 = require("../config/config");
class ZoomTranscriptionController {
    /**
     * Descarga un video de Zoom a partir de su URL y lo transcribe (versión asíncrona)
     * @param req Request con la URL de Zoom y parámetros opcionales
     * @param res Response con el ID de la tarea creada
     */
    static async transcribeZoom(req, res) {
        try {
            // Verificar que se proporciona una URL de Zoom
            const { zoom_url } = req.body;
            console.log('\n📹 Petición START: /api/zoom/transcribe');
            console.log('📝 Body recibido:', JSON.stringify(req.body));
            if (!zoom_url) {
                console.warn('❌ No se proporcionó URL de Zoom');
                // Configurar headers explícitos para Postman y otros clientes
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                res.setHeader('Cache-Control', 'no-cache');
                res.setHeader('Access-Control-Allow-Origin', '*');
                // Construir objeto de respuesta de error
                const errorResponse = {
                    error: {
                        message: 'No se proporcionó ninguna URL de Zoom',
                        type: 'invalid_request_error'
                    }
                };
                console.log('🚨 Enviando respuesta de error:', JSON.stringify(errorResponse));
                return res.status(400).send(JSON.stringify(errorResponse));
            }
            // Obtener los parámetros opcionales
            const language = req.body.language || 'es';
            const responseFormat = req.body.response_format || 'json';
            console.log(`\n🎬 Iniciando procesamiento de video de Zoom`);
            console.log(`🔗 URL de Zoom: ${zoom_url}`);
            console.log(`🌐 Idioma: ${language}`);
            console.log(`📄 Formato de respuesta: ${responseFormat}`);
            // Crear directorio temporal si no existe
            if (!fs.existsSync(config_1.config.tempDir)) {
                fs.mkdirSync(config_1.config.tempDir, { recursive: true });
            }
            // Crear una nueva tarea y obtener su ID
            const taskId = task_service_1.TaskService.createTask({
                zoom_url,
                language,
                response_format: responseFormat
            });
            console.log(`\n📝 Tarea creada con ID: ${taskId}, preparando respuesta...`);
            // Construir objeto de respuesta exitosa
            const successResponse = {
                task_id: taskId,
                status: 'pending',
                message: 'Tarea de transcripción iniciada',
                check_progress_url: `/api/zoom/tasks/${taskId}`
            };
            // Configurar headers explícitos para evitar problemas de interpretación
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Connection', 'keep-alive');
            // Convertir a JSON
            const jsonResponse = JSON.stringify(successResponse);
            // Log detallado para debug
            console.log(`📝 RESPONDIENDO al cliente con:`, jsonResponse);
            console.log(`📝 Headers configurados:`, JSON.stringify({
                'Content-Type': res.getHeader('Content-Type'),
                'Cache-Control': res.getHeader('Cache-Control'),
                'Access-Control-Allow-Origin': res.getHeader('Access-Control-Allow-Origin'),
                'Connection': res.getHeader('Connection')
            }));
            // ENFOQUE MÁS DIRECTO: Usar res.end() para asegurar que la respuesta se envíe
            res.writeHead(202);
            res.write(jsonResponse);
            res.end();
            console.log(`\n📝 Respuesta enviada con res.end(), iniciando procesamiento asíncrono...`);
            // Iniciar el proceso en segundo plano (DESPUÉS de enviar la respuesta)
            ZoomTranscriptionController.processZoomTranscription(taskId, zoom_url, language, responseFormat)
                .catch(error => {
                console.error(`\n🚨 Error en procesamiento en segundo plano:`, error);
                task_service_1.TaskService.updateTask(taskId, {
                    status: 'failed',
                    progress: 0,
                    message: 'Error interno del servidor',
                    error: error.message || 'Error desconocido'
                });
            });
            // Retornar para finalizar el handler
            return;
        }
        catch (error) {
            console.error('\n❌ Error en el proceso de transcripción de Zoom:', error);
            // Mensaje de error detallado
            const errorMessage = error.message || 'Error desconocido';
            const errorDetails = error.stack ? `\n${error.stack}` : '';
            console.error(`Detalles del error: ${errorMessage}${errorDetails}`);
            // Configurar headers explícitos para Postman
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Access-Control-Allow-Origin', '*');
            // Construir objeto de respuesta de error
            const serverErrorResponse = {
                error: {
                    message: errorMessage,
                    type: 'server_error'
                }
            };
            console.log('🚨 Enviando respuesta de error de servidor:', JSON.stringify(serverErrorResponse));
            // Usar el enfoque directo también para errores
            res.writeHead(500);
            res.write(JSON.stringify(serverErrorResponse));
            res.end();
            return;
        }
    }
    /**
     * Obtiene el estado actual de una tarea de transcripción
     * @param req Request con el ID de la tarea
     * @param res Response con el estado actual
     */
    static async getTaskProgress(req, res) {
        try {
            // Obtener taskId de múltiples fuentes posibles (URL params, body, o headers)
            let taskId = req.params.taskId;
            // Si no hay taskId en params, intentar obtenerlo del body o headers
            if (!taskId) {
                if (req.body && req.body.task_id) {
                    taskId = req.body.task_id;
                }
                else if (req.headers['x-task-id']) {
                    taskId = req.headers['x-task-id'];
                }
            }
            console.log(`👉 Consultando progreso de tarea con ID: ${taskId}`);
            if (!taskId) {
                console.warn('❌ Solicitud sin ID de tarea');
                // Configurar headers explícitos para Postman y otros clientes
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                res.setHeader('Cache-Control', 'no-cache');
                res.setHeader('Access-Control-Allow-Origin', '*');
                return res.status(400).send(JSON.stringify({
                    error: {
                        message: 'Se requiere un ID de tarea',
                        type: 'invalid_request_error'
                    }
                }));
            }
            const task = task_service_1.TaskService.getTask(taskId);
            if (!task) {
                console.warn(`❌ Tarea no encontrada: ${taskId}`);
                // Configurar headers explícitos para Postman y otros clientes
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                res.setHeader('Cache-Control', 'no-cache');
                res.setHeader('Access-Control-Allow-Origin', '*');
                return res.status(404).send(JSON.stringify({
                    error: {
                        message: 'Tarea no encontrada',
                        type: 'not_found_error'
                    }
                }));
            }
            // Calcular tiempo transcurrido
            const elapsedTime = Math.floor((new Date().getTime() - task.startTime.getTime()) / 1000);
            // Construir respuesta base
            const response = {
                task_id: task.id,
                status: task.status,
                progress: task.progress,
                message: task.message,
                elapsed_time_seconds: elapsedTime
            };
            // Incluir resultado si está completo
            if (task.status === 'completed' && task.result) {
                response.result = task.result;
            }
            // Incluir error si falló
            if (task.status === 'failed' && task.error) {
                response.error = task.error;
            }
            console.log(`✅ Enviando respuesta para tarea ${taskId}:`, JSON.stringify(response));
            // Configurar headers explícitos para evitar problemas de interpretación
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Connection', 'keep-alive');
            // Usar send en lugar de json para más control
            return res.status(200).send(JSON.stringify(response));
        }
        catch (error) {
            console.error('❌ Error al obtener progreso de la tarea:', error);
            // Mensaje de error detallado
            const errorMessage = error.message || 'Error interno del servidor';
            const errorDetails = error.stack ? `\n${error.stack}` : '';
            console.error(`Detalles del error: ${errorMessage}${errorDetails}`);
            // Configurar headers explícitos para Postman
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Access-Control-Allow-Origin', '*');
            return res.status(500).send(JSON.stringify({
                error: {
                    message: errorMessage,
                    type: 'server_error'
                }
            }));
        }
    }
    /**
     * Método privado para procesar la transcripción en segundo plano
     * @param taskId ID de la tarea
     * @param zoomUrl URL del video de Zoom
     * @param language Idioma para la transcripción
     * @param responseFormat Formato de respuesta (json o text)
     */
    static async processZoomTranscription(taskId, zoomUrl, language = 'es', responseFormat = 'json') {
        const tempFiles = new Set();
        const deletedFiles = new Set();
        const safeDeleteFile = async (filePath) => {
            if (deletedFiles.has(filePath)) {
                return; // El archivo ya fue eliminado
            }
            try {
                if (filePath.startsWith('gs://')) {
                    const fileName = filePath.split('/').pop();
                    if (fileName) {
                        await storage_service_1.StorageService.deleteFile(fileName);
                        console.log(`🗑️ Archivo eliminado de Cloud Storage: ${fileName}`);
                    }
                }
                else if (fs.existsSync(filePath)) {
                    await fs.promises.unlink(filePath);
                    console.log(`🗑️ Archivo local eliminado: ${filePath}`);
                }
                deletedFiles.add(filePath);
            }
            catch (error) { // Especificar el tipo como 'any' para acceder a .code
                // Solo logear el error si el archivo realmente existía
                if (error.code !== 'ENOENT') {
                    console.warn(`⚠️ No se pudo eliminar el archivo ${filePath}:`, error);
                }
            }
        };
        try {
            // Actualizar estado: validando URL
            task_service_1.TaskService.updateTask(taskId, {
                status: 'validating',
                progress: 5,
                message: 'Validando URL de Zoom'
            });
            // Validar URL
            const urlValidation = await zoom_service_1.ZoomService.validateZoomUrl(zoomUrl);
            if (!urlValidation.valid) {
                task_service_1.TaskService.updateTask(taskId, {
                    status: 'failed',
                    progress: 0,
                    message: 'URL de Zoom inválida',
                    error: urlValidation.message
                });
                return;
            }
            // Actualizar estado: descargando video
            task_service_1.TaskService.updateTask(taskId, {
                status: 'downloading',
                progress: 10,
                message: 'Descargando video de Zoom'
            });
            // Descargar video
            const downloadResult = await zoom_service_1.ZoomService.downloadZoomVideo(zoomUrl, config_1.config.tempDir);
            if (!downloadResult.success || !downloadResult.filePath) {
                task_service_1.TaskService.updateTask(taskId, {
                    status: 'failed',
                    progress: 0,
                    message: 'Error al descargar el video',
                    error: downloadResult.message
                });
                return;
            }
            tempFiles.add(downloadResult.filePath);
            // Actualizar estado: convirtiendo video
            task_service_1.TaskService.updateTask(taskId, {
                status: 'converting',
                progress: 50,
                message: 'Convirtiendo video a formato FLAC'
            });
            // Convertir video a FLAC - ahora recibe y devuelve rutas completas
            const audioPath = await audio_converter_1.AudioConverter.convertToFlac(downloadResult.filePath);
            tempFiles.add(audioPath);
            // Limpiar el archivo de video después de la conversión
            await safeDeleteFile(downloadResult.filePath);
            // Actualizar estado: transcribiendo audio
            task_service_1.TaskService.updateTask(taskId, {
                status: 'transcribing',
                progress: 75,
                message: 'Procesando audio y generando transcripción'
            });
            // Transcribir audio usando la ruta completa
            const result = await speech_service_1.AudioService.processAndTranscribeAudio(audioPath);
            // Limpiar el archivo de audio después de la transcripción
            await safeDeleteFile(audioPath);
            // Formatear resultado según el formato solicitado
            let formattedResult;
            if (responseFormat === 'text') {
                formattedResult = result.transcription.split('. ').join('.\n');
            }
            else {
                formattedResult = { text: result.transcription };
            }
            // Actualizar estado: completado
            task_service_1.TaskService.updateTask(taskId, {
                status: 'completed',
                progress: 100,
                message: 'Transcripción completada',
                result: formattedResult
            });
        }
        catch (error) {
            console.error('Error en procesamiento de transcripción:', error);
            task_service_1.TaskService.updateTask(taskId, {
                status: 'failed',
                progress: 0,
                message: 'Error en el proceso de transcripción',
                error: error.message || 'Error desconocido'
            });
        }
        finally {
            // Asegurarse de que todos los archivos temporales sean eliminados
            for (const filePath of tempFiles) {
                if (!deletedFiles.has(filePath)) {
                    await safeDeleteFile(filePath);
                }
            }
        }
    }
}
exports.ZoomTranscriptionController = ZoomTranscriptionController;
