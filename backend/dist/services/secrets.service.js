"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecretsService = void 0;
const secret_manager_1 = require("@google-cloud/secret-manager");
const path_1 = __importDefault(require("path"));
const dotenv_1 = require("dotenv");
const fs_1 = __importDefault(require("fs"));
// Cargar variables de entorno
(0, dotenv_1.config)();
console.log('🔑 GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS);
class SecretsService {
    static initialize() {
        try {
            if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
                throw new Error('La variable de entorno GOOGLE_APPLICATION_CREDENTIALS no está definida');
            }
            const credentialsPath = path_1.default.resolve(process.cwd(), process.env.GOOGLE_APPLICATION_CREDENTIALS);
            // Verificar que el archivo existe
            if (!fs_1.default.existsSync(credentialsPath)) {
                throw new Error(`El archivo de credenciales no existe en la ruta: ${credentialsPath}`);
            }
            console.log(`✅ Inicializando Secret Manager con credenciales: ${credentialsPath}`);
            this.client = new secret_manager_1.SecretManagerServiceClient({
                keyFilename: credentialsPath
            });
            console.log('✅ Secret Manager inicializado correctamente');
        }
        catch (error) {
            console.error('❌ Error inicializando Secret Manager:', error);
            throw error;
        }
    }
    /**
     * Obtiene un secreto de Secret Manager
     * @param secretName Nombre del secreto
     * @returns El valor del secreto
     */
    static async getSecret(secretName) {
        var _a;
        if (!this.client) {
            this.initialize();
        }
        try {
            // En desarrollo, si no hay credenciales válidas, usar valores de desarrollo
            if (process.env.NODE_ENV === 'development' && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
                console.log('⚠️ Usando valores de desarrollo para los secretos');
                return this.getDevSecret(secretName);
            }
            const name = `projects/${this.projectId}/secrets/${secretName}/versions/latest`;
            const [version] = await this.client.accessSecretVersion({ name });
            if (!((_a = version.payload) === null || _a === void 0 ? void 0 : _a.data)) {
                throw new Error(`No se pudo obtener el secreto ${secretName}`);
            }
            return version.payload.data.toString();
        }
        catch (error) {
            console.error(`Error obteniendo secreto ${secretName}:`, error);
            throw error;
        }
    }
    /**
     * Obtiene un valor de desarrollo para los secretos cuando no hay credenciales válidas
     * @param secretName Nombre del secreto
     * @returns Valor de desarrollo para el secreto
     */
    static getDevSecret(secretName) {
        // Mapa de valores de desarrollo para los secretos
        const devSecrets = {
            'speech-to-text-sa-key': JSON.stringify({
                // Valores mínimos necesarios para desarrollo
                type: 'service_account',
                project_id: this.projectId,
                private_key: process.env.GOOGLE_PRIVATE_KEY || '',
                client_email: process.env.GOOGLE_CLIENT_EMAIL || ''
            })
        };
        const secret = devSecrets[secretName];
        if (!secret) {
            throw new Error(`No hay valor de desarrollo configurado para el secreto ${secretName}`);
        }
        return secret;
    }
}
exports.SecretsService = SecretsService;
SecretsService.projectId = process.env.GOOGLE_CLOUD_PROJECT || 'gen-lang-client-0961962132';
