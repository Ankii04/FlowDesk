import http from 'http';
import { createApp } from './app';
import { config } from './config/env';
import { logger } from './utils/logger';
import { connectDatabase, disconnectDatabase } from './config/database';
import { closeRedisConnections } from './config/redis';
import { socketService } from './socket/socket.service';

// ─────────────────────────────────────────────
// Bootstrap the server
// Handles: DB connection → start listening → graceful shutdown
// ─────────────────────────────────────────────
async function bootstrap(): Promise<void> {
  logger.info('╔═══════════════════════════════════════╗');
  logger.info('║        LeadPulse API Server           ║');
  logger.info('║  Communication Workflow Intelligence  ║');
  logger.info('╚═══════════════════════════════════════╝');

  // Connect to PostgreSQL
  await connectDatabase();

  // Create Express app
  const app = createApp();

  // Create HTTP server (needed for Socket.IO in Slot 9)
  const server = http.createServer(app);

  // Initialize Socket.IO
  socketService.init(server);

  // Start listening
  server.listen({ port: config.server.port, host: process.env.FORTIVEX_LOOPBACK === '1' ? '127.0.0.1' : undefined }, () => {
    logger.info(`[Server] Running on port ${config.server.port}`);
    logger.info(`[Server] Environment: ${config.server.env}`);
    logger.info(`[Server] API prefix: ${config.server.apiPrefix}`);
    logger.info(`[Server] Health check: http://localhost:${config.server.port}/health`);
  });

  // ── Graceful Shutdown ────────────────────────
  // On SIGTERM / SIGINT: stop accepting new connections,
  // wait for active requests to finish, close DB + Redis
  const shutdown = async (signal: string) => {
    logger.warn(`[Server] ${signal} received — starting graceful shutdown`);

    server.close(async () => {
      logger.info('[Server] HTTP server closed');

      try {
        await disconnectDatabase();
        await closeRedisConnections();
        logger.info('[Server] Shutdown complete');
        process.exit(0);
      } catch (error) {
        logger.error('[Server] Error during shutdown', { error });
        process.exit(1);
      }
    });

    // Force shutdown after 10 seconds if graceful fails
    setTimeout(() => {
      logger.error('[Server] Forced shutdown after timeout');
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught errors — log and keep running if operational
  process.on('uncaughtException', (error) => {
    logger.error('[Server] Uncaught exception', { error: error.message, stack: error.stack });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('[Server] Unhandled promise rejection', { reason });
    process.exit(1);
  });
}

// Start the server
bootstrap().catch((error) => {
  logger.error('[Server] Fatal error during bootstrap', { error });
  process.exit(1);
});
