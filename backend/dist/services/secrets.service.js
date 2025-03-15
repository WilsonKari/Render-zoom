"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecretsService = void 0;
const secret_manager_1 = require("@google-cloud/secret-manager");
const path_1 = __importDefault(require("path"));
class SecretsService {
    static initialize() {
        try {
            this.client = new secret_manager_1.SecretManagerServiceClient({
                keyFilename: this.INITIAL_CREDENTIALS_PATH
            });
            console.log('✅ Secret Manager Service inicializado con credenciales locales');
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
}
exports.SecretsService = SecretsService;
SecretsService.projectId = 'gen-lang-client-0961962132';
SecretsService.INITIAL_CREDENTIALS_PATH = path_1.default.resolve(process.cwd(), 'gen-lang-client-0961962132-1afd1324c445.json');
