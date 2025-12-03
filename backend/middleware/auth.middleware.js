import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'ldap-app-secret-key-change-in-production';
const JWT_EXPIRES_IN = '8h'; // Token expires in 8 hours

/**
 * Middleware to verify JWT token and extract user credentials
 */
export const verifyToken = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'No token provided',
            });
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix

        jwt.verify(token, JWT_SECRET, (err, decoded) => {
            if (err) {
                console.error('Token verification failed:', err.message);
                return res.status(401).json({
                    success: false,
                    error: 'Invalid or expired token',
                });
            }

            // Attach user info to request
            req.user = decoded;
            next();
        });
    } catch (error) {
        console.error('Error in token verification:', error);
        return res.status(500).json({
            success: false,
            error: 'Authentication error',
        });
    }
};

/**
 * Generate JWT token for authenticated user
 * @param {Object} userInfo - User information
 * @param {string} username - Username
 * @param {string} password - Password (will be encrypted in token)
 * @returns {string} JWT token
 */
export const generateToken = (userInfo, username, password) => {
    const payload = {
        username,
        // Store encrypted password for LDAP operations
        // In production, consider using a more secure method
        credentials: Buffer.from(`${username}:${password}`).toString('base64'),
        dn: userInfo.dn,
        cn: userInfo.cn,
        sAMAccountName: userInfo.sAMAccountName,
        mail: userInfo.mail,
        memberOf: userInfo.memberOf,
    };

    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

/**
 * Decode credentials from token
 * @param {string} credentials - Base64 encoded credentials
 * @returns {Object} Object with username and password
 */
export const decodeCredentials = (credentials) => {
    const decoded = Buffer.from(credentials, 'base64').toString('utf-8');
    const [username, password] = decoded.split(':');
    return { username, password };
};

export default {
    verifyToken,
    generateToken,
    decodeCredentials,
};
