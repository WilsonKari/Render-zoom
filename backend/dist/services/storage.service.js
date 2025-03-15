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
exports.StorageService = void 0;
const storage_1 = require("@google-cloud/storage");
const config_1 = require("../config/config");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const dotenv_1 = require("dotenv");
// Cargar variables de entorno
(0, dotenv_1.config)();
class StorageService {
    static async initialize() {
        try {
            if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
                throw new Error('La variable de entorno GOOGLE_APPLICATION_CREDENTIALS no está definida');
            }
            const credentialsPath = path.resolve(process.cwd(), process.env.GOOGLE_APPLICATION_CREDENTIALS);
            // Verificar que el archivo existe
            if (!fs.existsSync(credentialsPath)) {
                throw new Error(`El archivo de credenciales no existe en la ruta: ${credentialsPath}`);
            }
            console.log('🔑 Storage Service usando archivo de credenciales:', credentialsPath);
            this.storage = new storage_1.Storage({ keyFilename: credentialsPath });
            this.bucket = this.storage.bucket(config_1.config.google.storageBucket);
            console.log('✅ Storage Service inicializado correctamente');
        }
        catch (error) {
            console.error('❌ Error inicializando Storage Service:', error);
            throw error;
        }
    }
    /**
     * Sube un archivo al bucket de Google Cloud Storage
     * @param filePath Ruta local del archivo a subir
     * @param destination Ruta de destino en el bucket (opcional)
     * @returns URI del archivo en formato gs://
     */
    static async uploadFile(filePath, destination) {
        if (!this.bucket) {
            await this.initialize();
        }
        const fileName = path.basename(filePath);
        const destFileName = destination || fileName;
        try {
            console.log(`\n📤 Subiendo archivo ${fileName} a Google Cloud Storage...`);
            // Subir el archivo al bucket
            await this.bucket.upload(filePath, {
                destination: destFileName
            });
            // Retornar el URI en formato gs://
            const gcsUri = `gs://${config_1.config.google.storageBucket}/${destFileName}`;
            console.log(`✅ Archivo subido con éxito: ${gcsUri}`);
            return gcsUri;
        }
        catch (error) {
            console.error(`\n❌ Error al subir archivo a Google Cloud Storage:`, error);
            throw new Error(`Error al subir archivo a Google Cloud Storage: ${error instanceof Error ? error.message : 'Error desconocido'}`);
        }
    }
    /**
     * Descarga un archivo del bucket de Google Cloud Storage
     * @param fileName Nombre del archivo a descargar
     * @param destination Ruta local donde guardar el archivo
     * @returns Ruta local del archivo descargado
     */
    static async downloadFile(fileName, destination) {
        if (!this.bucket) {
            await this.initialize();
        }
        const destPath = path.join(destination, fileName);
        try {
            console.log(`\n📥 Descargando archivo ${fileName} desde Google Cloud Storage...`);
            // Descargar el archivo del bucket
            await this.bucket.file(fileName).download({
                destination: destPath
            });
            console.log(`✅ Archivo descargado con éxito: ${destPath}`);
            return destPath;
        }
        catch (error) {
            console.error(`\n❌ Error al descargar archivo desde Google Cloud Storage:`, error);
            throw new Error(`Error al descargar archivo desde Google Cloud Storage: ${error instanceof Error ? error.message : 'Error desconocido'}`);
        }
    }
    /**
     * Verifica si un archivo existe en el bucket
     * @param fileName Nombre del archivo a verificar
     * @returns true si el archivo existe, false en caso contrario
     */
    static async fileExists(fileName) {
        if (!this.bucket) {
            await this.initialize();
        }
        try {
            const [exists] = await this.bucket.file(fileName).exists();
            return exists;
        }
        catch (error) {
            console.error(`\n❌ Error al verificar si el archivo existe en Google Cloud Storage:`, error);
            return false;
        }
    }
    /**
     * Elimina un archivo del bucket
     * @param fileName Nombre del archivo a eliminar
     */
    static async deleteFile(fileName) {
        if (!this.bucket) {
            await this.initialize();
        }
        try {
            console.log(`\n🗑️ Eliminando archivo ${fileName} de Google Cloud Storage...`);
            await this.bucket.file(fileName).delete();
            console.log(`✅ Archivo eliminado con éxito`);
        }
        catch (error) {
            console.error(`\n❌ Error al eliminar archivo de Google Cloud Storage:`, error);
            throw new Error(`Error al eliminar archivo de Google Cloud Storage: ${error instanceof Error ? error.message : 'Error desconocido'}`);
        }
    }
    /**
     * Maneja un archivo temporal, subiéndolo a Cloud Storage si es necesario
     * @param filePath Ruta local del archivo temporal
     * @returns Ruta del archivo (local o Cloud Storage URI)
     */
    static async handleTempFile(filePath) {
        if (!config_1.config.useCloudStorage) {
            return filePath;
        }
        const fileName = path.basename(filePath);
        const cloudPath = `${config_1.config.google.tempFolder}/${fileName}`;
        try {
            // Subir a Cloud Storage
            const gcsUri = await this.uploadFile(filePath, cloudPath);
            // Eliminar archivo local después de subir
            await fs.promises.unlink(filePath);
            return gcsUri;
        }
        catch (error) {
            console.error('Error al manejar archivo temporal:', error);
            return filePath; // Fallback a archivo local si hay error
        }
    }
    /**
     * Limpia un archivo temporal (local o en Cloud Storage)
     * @param filePath Ruta del archivo a limpiar
     */
    static async cleanupTempFile(filePath) {
        try {
            if (filePath.startsWith('gs://')) {
                // Es un archivo en Cloud Storage
                const fileName = filePath.split('/').pop();
                if (fileName) {
                    await this.deleteFile(fileName);
                }
            }
            else {
                // Es un archivo local
                if (fs.existsSync(filePath)) {
                    await fs.promises.unlink(filePath);
                }
            }
        }
        catch (error) {
            console.error('Error al limpiar archivo temporal:', error);
        }
    }
}
exports.StorageService = StorageService;
