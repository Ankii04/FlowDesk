import swaggerJsdoc from 'swagger-jsdoc';
import { config } from '../config/env';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'LeadPulse API',
      version: '1.0.0',
      description: 'Communication Workflow Intelligence Engine API Documentation',
    },
    servers: [
      {
        url: `http://localhost:${config.server.port}${config.server.apiPrefix}`,
        description: 'Local development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: ['src/modules/**/*.routes.ts', 'src/modules/**/*.schema.ts'], 
};

export const swaggerSpec = swaggerJsdoc(options);
