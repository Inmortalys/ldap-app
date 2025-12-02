import express from 'express';
const router = express.Router();
import ldapService from '../services/ldap.service.js';
import pocketbaseService from '../services/pocketbase.service.js';

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
