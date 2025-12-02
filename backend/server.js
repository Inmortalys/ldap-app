import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import ldapRoutes from './routes/ldap.routes.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: 'http://localhost:4200', // Angular dev server
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

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        pocketbaseUrl: process.env.POCKETBASE_URL || 'http://127.0.0.1:8090',
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
║   PocketBase URL: ${process.env.POCKETBASE_URL || 'http://127.0.0.1:8090'}     ║
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
