"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecretsService = void 0;
const secret_manager_1 = require("@google-cloud/secret-manager");
const path_1 = __importDefault(require("path"));
const dotenv_1 = require("dotenv");
// Cargar variables de entorno
(0, dotenv_1.config)();
class SecretsService {
    static initialize() {
        try {
            // Si GOOGLE_APPLICATION_CREDENTIALS está configurado en el ambiente,
            // la biblioteca lo usará automáticamente
            if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
                this.client = new secret_manager_1.SecretManagerServiceClient();
                console.log('✅ Secret Manager Service inicializado con credenciales del ambiente');
            }
            else {
                // Fallback a credenciales locales
                this.client = new secret_manager_1.SecretManagerServiceClient({
                    keyFilename: this.CREDENTIALS_PATH
                });
                console.log('✅ Secret Manager Service inicializado con credenciales locales');
            }
        }
        catch (error) {
            console.error('❌ Error inicializando Secret Manager Service:', error);
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
SecretsService.CREDENTIALS_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS
    ? path_1.default.resolve(process.cwd(), process.env.GOOGLE_APPLICATION_CREDENTIALS)
    : path_1.default.resolve(process.cwd(), 'gen-lang-client-0961962132-c17aa42ced24.json');
