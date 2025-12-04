import express from 'express';
const router = express.Router();
import ldapService from '../services/ldap.service.js';
import configService from '../services/config.service.js';
import tokenService from '../services/token.service.js';
import { verifyToken, generateToken, decodeCredentials } from '../middleware/auth.middleware.js';

/**
 * POST /api/ldap/login
 * Authenticate user with LDAP credentials
 */
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                error: 'Username and password are required',
            });
        }

        // Authenticate user against LDAP
        const userInfo = await ldapService.authenticateUser(username, password);

        // Generate JWT token
        const token = generateToken(userInfo, username, password);

        res.json({
            success: true,
            token,
            user: {
                dn: userInfo.dn,
                cn: userInfo.cn,
                sAMAccountName: userInfo.sAMAccountName,
                mail: userInfo.mail,
            },
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(401).json({
            success: false,
            error: error.message || 'Authentication failed',
        });
    }
});

/**
 * GET /api/ldap/verify-token
 * Verify if token is valid
 */
router.get('/verify-token', verifyToken, (req, res) => {
    res.json({
        success: true,
        user: {
            dn: req.user.dn,
            cn: req.user.cn,
            sAMAccountName: req.user.sAMAccountName,
            mail: req.user.mail,
        },
    });
});

/**
 * GET /api/ldap/users
 * Get all users from LDAP
 */
/**
 * GET /api/ldap/users
 * Get all users from LDAP
 */
router.get('/users', verifyToken, async (req, res) => {
    try {
        // Decode credentials from token
        const { username, password } = decodeCredentials(req.user.credentials);

        // Connect with user credentials
        const client = await ldapService.connect(username, password);

        // Get search base from query param
        const searchBase = req.query.base ? decodeURIComponent(req.query.base) : null;

        // Search users using the authenticated client
        const users = await ldapService.searchUsers(searchBase, '(objectClass=user)', client);

        // Unbind client after use
        client.unbind();

        res.json({
            success: true,
            count: users.length,
            users,
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch users from LDAP',
        });
    }
});

/**
 * GET /api/ldap/users/:dn
 * Get specific user by DN
 */
/**
 * GET /api/ldap/users/:dn
 * Get specific user by DN
 */
router.get('/users/:dn', verifyToken, async (req, res) => {
    try {
        const dn = decodeURIComponent(req.params.dn);

        // Decode credentials from token
        const { username, password } = decodeCredentials(req.user.credentials);

        // Connect with user credentials
        const client = await ldapService.connect(username, password);

        const users = await ldapService.searchUsers(dn, '(objectClass=*)', client);

        // Unbind client
        client.unbind();

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'User not found',
            });
        }

        res.json({
            success: true,
            user: users[0],
        });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch user from LDAP',
        });
    }
});

/**
 * POST /api/ldap/users/:dn/unlock
 * Unlock a locked user account
 */
router.post('/users/:dn/unlock', async (req, res) => {
    try {
        const dn = decodeURIComponent(req.params.dn);

        await ldapService.unlockUser(dn);

        // Simple logging to console
        console.log(`User ${dn} unlocked by admin`);

        res.json({
            success: true,
            message: `User ${dn} unlocked successfully`,
        });
    } catch (error) {
        console.error('Error unlocking user:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to unlock user',
        });
    }
});

/**
 * GET /api/ldap/password-policy
 * Get domain password policy
 */
/**
 * GET /api/ldap/password-policy
 * Get domain password policy
 */
router.get('/password-policy', verifyToken, async (req, res) => {
    try {
        // Decode credentials from token
        const { username, password } = decodeCredentials(req.user.credentials);

        // Connect with user credentials
        const client = await ldapService.connect(username, password);

        // Temporarily set client on service for getDomainPasswordPolicyComplete to use
        // Ideally we should refactor getDomainPasswordPolicyComplete to accept client
        ldapService.client = client;

        const policy = await ldapService.getDomainPasswordPolicyComplete();

        // Unbind client
        client.unbind();
        ldapService.client = null;

        res.json({
            success: true,
            policy,
        });
    } catch (error) {
        console.error('Error fetching password policy:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch password policy',
        });
    }
});

/**
 * POST /api/ldap/change-password
 * Change user password (requires authentication)
 */
router.post('/change-password', verifyToken, async (req, res) => {
    try {
        const { userDN, newPassword } = req.body;

        if (!userDN || !newPassword) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: userDN and newPassword',
            });
        }

        // Decode admin credentials from token
        const { username, password } = decodeCredentials(req.user.credentials);

        // Change password using authenticated user's credentials
        await ldapService.changeUserPasswordWithAuth(userDN, newPassword, username, password);

        // Simple logging to console
        console.log(`Password changed for ${userDN} by ${req.user.cn}`);

        res.json({
            success: true,
            message: 'Password changed successfully',
        });
    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to change password',
        });
    }
});

/**
 * POST /api/ldap/test-connection
 * Test LDAP connection with provided configuration
 */
router.post('/test-connection', async (req, res) => {
    try {
        const config = req.body;

        // Validate required fields
        if (!config.server || !config.port || !config.adminDN || !config.adminPassword) {
            return res.status(400).json({
                success: false,
                error: 'Missing required configuration fields',
            });
        }

        await ldapService.testConnection(config);

        res.json({
            success: true,
            message: 'LDAP connection successful',
        });
    } catch (error) {
        console.error('LDAP connection test failed:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'LDAP connection failed',
        });
    }
});

/**
 * GET /api/ldap/config
 * Get current LDAP configuration (without password)
 */
router.get('/config', async (req, res) => {
    try {
        const config = configService.getLdapConfig();

        // Remove sensitive data before sending (no password in config service)
        const safeConfig = {
            server: config.server,
            port: config.port,
            baseDN: config.baseDN,
            searchBase: config.searchBase, // Keep for backward compatibility
            searchBases: config.searchBases, // New: array of search bases
        };

        res.json({
            success: true,
            config: safeConfig,
        });
    } catch (error) {
        console.error('Error fetching config:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch LDAP configuration',
        });
    }
});

/**
 * POST /api/ldap/config
 * Save LDAP configuration (disabled - use .env file instead)
 */
router.post('/config', async (req, res) => {
    res.status(403).json({
        success: false,
        error: 'Configuration must be set in .env file. This endpoint is disabled.',
    });
});

/**
 * POST /api/ldap/generate-reset-token
 * Generate a temporary password reset token for a user
 */
router.post('/generate-reset-token', verifyToken, async (req, res) => {
    try {
        const { userDN } = req.body;

        if (!userDN) {
            return res.status(400).json({
                success: false,
                error: 'userDN is required',
            });
        }

        // Generate reset token
        const tokenData = tokenService.generateResetToken(userDN);

        // Construct reset URL (frontend URL)
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
        const resetUrl = `${frontendUrl}/reset-password?token=${tokenData.token}`;

        res.json({
            success: true,
            token: tokenData.token,
            resetUrl,
            expiresAt: tokenData.expiresAt,
            userDN: tokenData.userDN
        });
    } catch (error) {
        console.error('Error generating reset token:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to generate reset token',
        });
    }
});

/**
 * GET /api/ldap/validate-reset-token/:token
 * Validate a password reset token (check if it's valid, not used, not expired)
 */
router.get('/validate-reset-token/:token', async (req, res) => {
    try {
        const { token } = req.params;

        if (!token) {
            return res.status(400).json({
                success: false,
                error: 'Token is required',
            });
        }

        // Validate token
        const validation = tokenService.validateToken(token);

        if (!validation.valid) {
            return res.status(400).json({
                success: false,
                error: validation.error,
            });
        }

        res.json({
            success: true,
            valid: true,
            userDN: validation.userDN,
            expiresAt: validation.expiresAt,
        });
    } catch (error) {
        console.error('Error validating reset token:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to validate token',
        });
    }
});

/**
 * POST /api/ldap/reset-password-with-token
 * Reset password using a valid token
 * Requires authentication with current credentials
 */
router.post('/reset-password-with-token', async (req, res) => {
    try {
        const { token, username, currentPassword, newPassword } = req.body;

        if (!token || !username || !currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                error: 'Token, username, currentPassword, and newPassword are required',
            });
        }

        // Validate token first
        const validation = tokenService.validateToken(token);

        if (!validation.valid) {
            return res.status(400).json({
                success: false,
                error: validation.error,
            });
        }

        // Authenticate user with current credentials
        let userInfo;
        try {
            userInfo = await ldapService.authenticateUser(username, currentPassword);
        } catch (authError) {
            return res.status(401).json({
                success: false,
                error: 'Credenciales incorrectas',
            });
        }

        // Verify that the authenticated user matches the token's user
        if (userInfo.dn !== validation.userDN) {
            return res.status(403).json({
                success: false,
                error: 'Este enlace no es válido para este usuario',
            });
        }

        // Change password
        await ldapService.changeUserPasswordWithAuth(
            userInfo.dn,
            newPassword,
            username,
            currentPassword
        );

        // Mark token as used (invalidate it)
        tokenService.markTokenAsUsed(token);

        console.log(`Password reset successful for user: ${username} using token`);

        res.json({
            success: true,
            message: 'Contraseña cambiada correctamente',
        });
    } catch (error) {
        console.error('Error resetting password with token:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to reset password',
        });
    }
});

export default router;
