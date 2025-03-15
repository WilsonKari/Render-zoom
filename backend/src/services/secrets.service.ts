import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import path from 'path';
import { config as dotenvConfig } from 'dotenv';

// Cargar variables de entorno
dotenvConfig();

export class SecretsService {
    private static client: SecretManagerServiceClient;
    private static projectId = process.env.GOOGLE_CLOUD_PROJECT || 'gen-lang-client-0961962132';
    private static readonly CREDENTIALS_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS 
        ? path.resolve(process.cwd(), process.env.GOOGLE_APPLICATION_CREDENTIALS)
        : path.resolve(process.cwd(), 'gen-lang-client-0961962132-c17aa42ced24.json');

    static initialize() {
        try {
            // Si GOOGLE_APPLICATION_CREDENTIALS está configurado en el ambiente,
            // la biblioteca lo usará automáticamente
            if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
                this.client = new SecretManagerServiceClient();
                console.log('✅ Secret Manager Service inicializado con credenciales del ambiente');
            } else {
                // Fallback a credenciales locales
                this.client = new SecretManagerServiceClient({
                    keyFilename: this.CREDENTIALS_PATH
                });
                console.log('✅ Secret Manager Service inicializado con credenciales locales');
            }
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
            // En desarrollo, si no hay credenciales válidas, usar valores de desarrollo
            if (process.env.NODE_ENV === 'development' && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
                console.log('⚠️ Usando valores de desarrollo para los secretos');
                return this.getDevSecret(secretName);
            }

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

    /**
     * Obtiene un valor de desarrollo para los secretos cuando no hay credenciales válidas
     * @param secretName Nombre del secreto
     * @returns Valor de desarrollo para el secreto
     */
    private static getDevSecret(secretName: string): string {
        // Mapa de valores de desarrollo para los secretos
        const devSecrets: { [key: string]: string } = {
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