import type { FastifyDynamicSwaggerOptions } from '@fastify/swagger';

export const swaggerConfig: FastifyDynamicSwaggerOptions = {
  openapi: {
    info: {
      title: 'Backend API Starter',
      description: 'Portfolio-ready Fastify API starter with auth, users, projects, Prisma, and PostgreSQL.',
      version: '0.0.0',
    },
    tags: [
      { name: 'Health', description: 'Runtime health checks' },
      { name: 'Auth', description: 'Registration, login, and authenticated profile' },
      { name: 'Users', description: 'User management and RBAC operations' },
      { name: 'Projects', description: 'Owned project CRUD operations' },
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
};

export const bearerSecurity = [{ bearerAuth: [] }];
