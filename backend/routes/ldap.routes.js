import express from 'express';
const router = express.Router();
import ldapService from '../services/ldap.service.js';
import pocketbaseService from '../services/pocketbase.service.js';
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
router.get('/users', async (req, res) => {
    try {
        const users = await ldapService.searchUsers();
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
router.get('/users/:dn', async (req, res) => {
    try {
        const dn = decodeURIComponent(req.params.dn);
        const users = await ldapService.searchUsers(dn, '(objectClass=*)');

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
        const userId = req.body.userId; // PocketBase user ID for audit logging

        await ldapService.unlockUser(dn);

        // Log audit event
        if (userId) {
            await pocketbaseService.logAudit(userId, 'unlock_user', dn, {
                timestamp: new Date().toISOString(),
            });
        }

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
router.get('/password-policy', async (req, res) => {
    try {
        const policy = await ldapService.getDomainPasswordPolicyComplete();
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

        // Log audit event
        await pocketbaseService.logAudit(req.user.sAMAccountName, 'change_password', userDN, {
            timestamp: new Date().toISOString(),
            changedBy: req.user.cn,
        });

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
        const config = await pocketbaseService.getLdapConfig();

        // Remove sensitive data before sending
        const safeConfig = {
            server: config.server,
            port: config.port,
            baseDN: config.baseDN,
            adminDN: config.adminDN,
            searchBase: config.searchBase,
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
 * Save LDAP configuration
 */
router.post('/config', async (req, res) => {
    try {
        const config = req.body;
        const userId = req.body.userId; // PocketBase user ID for audit logging

        // Validate required fields
        if (!config.server || !config.port || !config.adminDN || !config.baseDN) {
            return res.status(400).json({
                success: false,
                error: 'Missing required configuration fields',
            });
        }

        const savedConfig = await pocketbaseService.saveLdapConfig(config);

        // Log audit event
        if (userId) {
            await pocketbaseService.logAudit(userId, 'update_ldap_config', 'ldap_config', {
                server: config.server,
                timestamp: new Date().toISOString(),
            });
        }

        res.json({
            success: true,
            message: 'LDAP configuration saved successfully',
            config: savedConfig,
        });
    } catch (error) {
        console.error('Error saving config:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to save LDAP configuration',
        });
    }
});

export default router;
