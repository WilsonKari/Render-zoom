import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import path from 'path';
import { config as dotenvConfig } from 'dotenv';
import fs from 'fs';

// Cargar variables de entorno
dotenvConfig();
console.log('🔑 GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS);

export class SecretsService {
    private static client: SecretManagerServiceClient;
    private static projectId = process.env.GOOGLE_CLOUD_PROJECT || 'gen-lang-client-0961962132';
    
    static initialize() {
        try {
            if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
                throw new Error('La variable de entorno GOOGLE_APPLICATION_CREDENTIALS no está definida');
            }

            const credentialsPath = path.resolve(process.cwd(), process.env.GOOGLE_APPLICATION_CREDENTIALS);
            
            // Verificar que el archivo existe
            if (!fs.existsSync(credentialsPath)) {
                throw new Error(`El archivo de credenciales no existe en la ruta: ${credentialsPath}`);
            }
            
            console.log(`✅ Inicializando Secret Manager con credenciales: ${credentialsPath}`);
            this.client = new SecretManagerServiceClient({
                keyFilename: credentialsPath
            });
            
            console.log('✅ Secret Manager inicializado correctamente');
        } catch (error) {
            console.error('❌ Error inicializando Secret Manager:', error);
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