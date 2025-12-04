import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import ldapRoutes from './routes/ldap.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:4200';

// Middleware
app.use(cors({
    origin: FRONTEND_URL,
    credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Routes
app.use('/api/ldap', ldapRoutes);

// Serve static files from Angular build (production only)
if (process.env.NODE_ENV === 'production') {
    const frontendPath = path.join(__dirname, '../frontend/dist/frontend/browser');
    app.use(express.static(frontendPath));

    // Fallback to index.html for SPA routing (must be after API routes)
    app.get('*', (req, res) => {
        res.sendFile(path.join(frontendPath, 'index.html'));
    });
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        ldapServer: process.env.LDAP_SERVER || 'Not configured',
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: err.message || 'Internal server error',
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Route not found',
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   LDAP Management Backend Server                     ║
║                                                       ║
║   Server running on: http://localhost:${PORT}        ║
║   LDAP Server: ${process.env.LDAP_SERVER || 'Not configured'}           ║
║                                                       ║
║   Available endpoints:                                ║
║   - GET  /health                                      ║
║   - GET  /api/ldap/users                              ║
║   - GET  /api/ldap/users/:dn                          ║
║   - POST /api/ldap/users/:dn/unlock                   ║
║   - POST /api/ldap/test-connection                    ║
║   - GET  /api/ldap/config                             ║
║   - POST /api/ldap/config                             ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down gracefully...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\nShutting down gracefully...');
    process.exit(0);
});
