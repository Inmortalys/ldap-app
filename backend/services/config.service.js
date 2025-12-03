import dotenv from 'dotenv';

dotenv.config();

class ConfigService {
    constructor() {
        // Parse LDAP_SEARCH_BASE - support multiple bases separated by semicolon
        const searchBaseEnv = process.env.LDAP_SEARCH_BASE || '';
        const searchBases = searchBaseEnv
            .split(';')
            .map(base => base.trim())
            .filter(base => base.length > 0);

        this.config = {
            ldap: {
                server: process.env.LDAP_SERVER,
                port: parseInt(process.env.LDAP_PORT),
                baseDN: process.env.LDAP_BASE_DN,
                searchBase: process.env.LDAP_SEARCH_BASE, // Keep for backward compatibility
                searchBases: searchBases.length > 0 ? searchBases : [process.env.LDAP_SEARCH_BASE].filter(Boolean),
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
