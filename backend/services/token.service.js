import jwt from 'jsonwebtoken';
import configService from './config.service.js';
import crypto from 'crypto';

/**
 * Service to manage password reset tokens
 * Tokens are stored in-memory and expire after 1 hour
 */
class TokenService {
    constructor() {
        // In-memory storage for tokens
        // Map<tokenId, { userDN, createdAt, expiresAt, used }>
        this.tokens = new Map();

        // Start cleanup interval (every 15 minutes)
        this.startCleanupInterval();
    }

    /**
     * Generate a password reset token for a user
     * @param {string} userDN - Distinguished Name of the user
     * @returns {Object} Token information
     */
    generateResetToken(userDN) {
        const tokenId = crypto.randomBytes(32).toString('hex');
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now

        // Create JWT payload
        const payload = {
            tokenId,
            userDN,
            type: 'password-reset',
        };

        // Get JWT secret from config
        const jwtConfig = configService.getJwtConfig();

        // Sign token with 1 hour expiration
        const token = jwt.sign(payload, jwtConfig.secret, {
            expiresIn: '1h'
        });

        // Store token metadata in memory
        this.tokens.set(tokenId, {
            userDN,
            createdAt: now,
            expiresAt,
            used: false
        });

        console.log(`Generated reset token for user: ${userDN}, expires at: ${expiresAt.toISOString()}`);

        return {
            token,
            tokenId,
            expiresAt,
            userDN
        };
    }

    /**
     * Validate a reset token
     * @param {string} token - JWT token string
     * @returns {Object} Validation result
     */
    validateToken(token) {
        try {
            // Get JWT secret from config
            const jwtConfig = configService.getJwtConfig();

            // Verify and decode JWT
            const decoded = jwt.verify(token, jwtConfig.secret);

            // Check if token exists in our store
            const tokenData = this.tokens.get(decoded.tokenId);

            if (!tokenData) {
                return {
                    valid: false,
                    error: 'Token no encontrado o ha expirado'
                };
            }

            // Check if token has been used
            if (tokenData.used) {
                return {
                    valid: false,
                    error: 'Este enlace ya ha sido utilizado'
                };
            }

            // Check if token has expired (double check)
            if (new Date() > tokenData.expiresAt) {
                return {
                    valid: false,
                    error: 'Este enlace ha caducado'
                };
            }

            // Token is valid
            return {
                valid: true,
                userDN: tokenData.userDN,
                expiresAt: tokenData.expiresAt,
                tokenId: decoded.tokenId
            };
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                return {
                    valid: false,
                    error: 'Este enlace ha caducado'
                };
            }

            if (error.name === 'JsonWebTokenError') {
                return {
                    valid: false,
                    error: 'Enlace inválido'
                };
            }

            console.error('Error validating token:', error);
            return {
                valid: false,
                error: 'Error al validar el enlace'
            };
        }
    }

    /**
     * Mark a token as used (invalidate it)
     * @param {string} token - JWT token string
     * @returns {boolean} Success status
     */
    markTokenAsUsed(token) {
        try {
            const jwtConfig = configService.getJwtConfig();
            const decoded = jwt.verify(token, jwtConfig.secret);

            const tokenData = this.tokens.get(decoded.tokenId);
            if (tokenData) {
                tokenData.used = true;
                console.log(`Token marked as used: ${decoded.tokenId}`);
                return true;
            }

            return false;
        } catch (error) {
            console.error('Error marking token as used:', error);
            return false;
        }
    }

    /**
     * Clean up expired tokens from memory
     */
    cleanupExpiredTokens() {
        const now = new Date();
        let cleaned = 0;

        for (const [tokenId, tokenData] of this.tokens.entries()) {
            if (now > tokenData.expiresAt) {
                this.tokens.delete(tokenId);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            console.log(`Cleaned up ${cleaned} expired token(s)`);
        }
    }

    /**
     * Start automatic cleanup interval
     */
    startCleanupInterval() {
        // Run cleanup every 15 minutes
        setInterval(() => {
            this.cleanupExpiredTokens();
        }, 15 * 60 * 1000);

        console.log('Token cleanup interval started (runs every 15 minutes)');
    }

    /**
     * Get token statistics (for debugging)
     * @returns {Object} Token statistics
     */
    getStats() {
        const now = new Date();
        let active = 0;
        let expired = 0;
        let used = 0;

        for (const tokenData of this.tokens.values()) {
            if (tokenData.used) {
                used++;
            } else if (now > tokenData.expiresAt) {
                expired++;
            } else {
                active++;
            }
        }

        return {
            total: this.tokens.size,
            active,
            expired,
            used
        };
    }
}

export default new TokenService();
