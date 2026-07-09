import fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import { registerErrorHandler } from './middlewares/error-handler';
import { registerAuthRoutes } from './modules/auth/auth.routes';
import { registerHealthRoutes } from './modules/health/health.routes';
import { registerProjectsRoutes } from './modules/projects/projects.routes';
import { registerUsersRoutes } from './modules/users/users.routes';
import { jwtPlugin } from './plugins/jwt';
import { prismaPlugin } from './plugins/prisma';
import { securityPlugin } from './plugins/security';
import { swaggerPlugin } from './plugins/swagger';

export interface BuildAppOptions extends FastifyServerOptions {
  prisma?: boolean;
}

type AppBootstrapStep = (app: FastifyInstance) => Promise<void> | void;

interface AppBootstrapPlan {
  plugins: AppBootstrapStep[];
  routes: AppBootstrapStep[];
}

const bootstrapPlan: AppBootstrapPlan = {
  plugins: [securityPlugin, prismaPlugin, jwtPlugin, swaggerPlugin],
  routes: [registerHealthRoutes, registerAuthRoutes, registerUsersRoutes, registerProjectsRoutes],
};

async function runBootstrapSteps(app: FastifyInstance, steps: AppBootstrapStep[]): Promise<void> {
  for (const step of steps) {
    await step(app);
  }
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = fastify({
    logger: options.logger ?? true,
  });

  registerErrorHandler(app);

  const plugins = options.prisma === false ? [securityPlugin, swaggerPlugin] : bootstrapPlan.plugins;
  const routes = options.prisma === false ? [registerHealthRoutes] : bootstrapPlan.routes;

  await runBootstrapSteps(app, plugins);
  await runBootstrapSteps(app, routes);

  return app;
}
