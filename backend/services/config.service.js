import dotenv from 'dotenv';

dotenv.config();

class ConfigService {
    constructor() {
        this.config = {
            ldap: {
                server: process.env.LDAP_SERVER || 'ldaps://192.168.4.8',
                port: parseInt(process.env.LDAP_PORT) || 636,
                baseDN: process.env.LDAP_BASE_DN || 'DC=ODECGANDIA,DC=ES',
                searchBase: process.env.LDAP_SEARCH_BASE || 'OU=Valencia,OU=Administradores,DC=ODECGANDIA,DC=ES',
            },
            jwt: {
                secret: process.env.JWT_SECRET || 'default-secret-change-in-production',
                expiration: process.env.JWT_EXPIRATION || '8h',
            },
            server: {
                port: parseInt(process.env.PORT) || 3000,
                env: process.env.NODE_ENV || 'development',
            }
        };
    }

    /**
     * Get LDAP configuration
     * @returns {Object} LDAP configuration
     */
    getLdapConfig() {
        return this.config.ldap;
    }

    /**
     * Get JWT configuration
     * @returns {Object} JWT configuration
     */
    getJwtConfig() {
        return this.config.jwt;
    }

    /**
     * Get server configuration
     * @returns {Object} Server configuration
     */
    getServerConfig() {
        return this.config.server;
    }

    /**
     * Get all configuration
     * @returns {Object} Complete configuration
     */
    getAllConfig() {
        return this.config;
    }
}

export default new ConfigService();
