import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import path from 'path';

export class SecretsService {
    private static client: SecretManagerServiceClient;
    private static projectId = 'gen-lang-client-0961962132';
    private static readonly INITIAL_CREDENTIALS_PATH = path.resolve(process.cwd(), 'gen-lang-client-0961962132-1afd1324c445.json');

    static initialize() {
        try {
            this.client = new SecretManagerServiceClient({
                keyFilename: this.INITIAL_CREDENTIALS_PATH
            });
            console.log('✅ Secret Manager Service inicializado con credenciales locales');
        } catch (error) {
            console.error('❌ Error inicializando Secret Manager Service:', error);
            throw error;
        }
    }

    /**
     * Obtiene un secreto de Secret Manager
     * @param secretName Nombre del secreto
     * @returns El valor del secreto
     */
    static async getSecret(secretName: string): Promise<string> {
        if (!this.client) {
            this.initialize();
        }

        try {
            const name = `projects/${this.projectId}/secrets/${secretName}/versions/latest`;
            const [version] = await this.client.accessSecretVersion({ name });
            
            if (!version.payload?.data) {
                throw new Error(`No se pudo obtener el secreto ${secretName}`);
            }

            return version.payload.data.toString();
        } catch (error) {
            console.error(`Error obteniendo secreto ${secretName}:`, error);
            throw error;
        }
    }
}