import salesDemoRouter from './modules/sales-demo/sales.routes';
import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';
import { config } from './config/env';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import authRouter from './modules/auth/auth.routes';
import leadRouter from './modules/leads/lead.routes';
import conversationRouter from './modules/conversations/conversation.routes';
import metricsRouter from './modules/metrics/metrics.routes';

// ─────────────────────────────────────────────
// Create and configure the Express application
// All middleware, routes, and error handlers
// are registered here in the correct order
// ─────────────────────────────────────────────
export function createApp(): Application {
  const app = express();

  // ── Security Middleware ──────────────────────
  app.use(helmet());                          // Sets secure HTTP headers
  app.use(rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    message: { success: false, error: { message: 'Too many requests, please try again later.' } }
  }));
  app.use(cors({
    origin: config.server.isDev ? '*' : process.env.ALLOWED_ORIGINS?.split(',') ?? [],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  }));

  // ── Body Parsers ─────────────────────────────
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // ── Request Logging ──────────────────────────
  app.use(requestLogger);

  // ── Health Check ─────────────────────────────
  // Simple endpoint — no auth, no DB hit
  app.get('/health', (_req, res) => {
    res.status(200).json({
      success: true,
      message: 'LeadPulse API is running',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      env: config.server.env,
    });
  });

  // ── API Routes ───────────────────────────────
  app.use(`${config.server.apiPrefix}/auth`, authRouter);
  app.use(`${config.server.apiPrefix}/leads`, leadRouter);
  app.use(`${config.server.apiPrefix}/conversations`, conversationRouter);
  app.use(`${config.server.apiPrefix}/metrics`, metricsRouter);
  app.use(`${config.server.apiPrefix}/sales-demo`, salesDemoRouter);

  // Swagger UI (Slot 12)
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  // ── Error Handling ───────────────────────────
  // Must be LAST — after all routes
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
