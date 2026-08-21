import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { prisma } from './config/database.js';
import routes from './routes/index.js';
import logger from './lib/logger.js';
import { errorMiddleware } from './middleware/error.middleware.js';
import { authMiddleware } from './middleware/auth.middleware.js';
import { startAccrualScheduler } from './services/conges-accrual.service.js';
const app = express();
const PORT = process.env.PORT || 3000;
// Derrière un reverse proxy (Caddy) — nécessaire pour express-rate-limit
app.set('trust proxy', 1);
// Security middleware
app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://127.0.0.1:30001',
    credentials: true,
    exposedHeaders: ['Content-Disposition'],
}));
// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 2000,
    message: { error: 'Trop de requêtes, veuillez réessayer plus tard.' }
});
app.use('/api', limiter);
// Rate limiting strict sur le login (anti brute-force)
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Trop de tentatives de connexion, réessayez dans 15 minutes.' },
    skipSuccessfulRequests: true,
});
app.use('/api/auth/login', loginLimiter);
// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// Logos publics (utilisés dans les PDFs et l'UI)
app.use('/uploads/logos', express.static(path.join(process.cwd(), 'uploads/logos')));
// Fiches techniques protégées — auth requise
app.use('/uploads/fiches-techniques', authMiddleware, express.static(path.join(process.cwd(), 'uploads/fiches-techniques')));
// Rapports terrain (Excel) protégés — auth requise
app.use('/uploads/field-reports', authMiddleware, express.static(path.join(process.cwd(), 'uploads/field-reports')));
// API routes
app.use('/api', routes);
// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route non trouvée', timestamp: new Date().toISOString() });
});
// Centralized error handler
app.use(errorMiddleware);
// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down...');
    await prisma.$disconnect();
    process.exit(0);
});
// Start server
app.listen(PORT, () => {
    logger.info(`🚀 RHS Controler API running on http://localhost:${PORT}`);
    logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    startAccrualScheduler();
});
export default app;
//# sourceMappingURL=app.js.map