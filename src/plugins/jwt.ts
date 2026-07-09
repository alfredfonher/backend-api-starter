import jwt from '@fastify/jwt';
import fp from 'fastify-plugin';
import { loadEnv } from '../config/env';

export const jwtPlugin = fp(async (app) => {
  const env = loadEnv();

  await app.register(jwt, {
    secret: env.jwtSecret,
    sign: {
      expiresIn: env.jwtExpiresIn,
    },
  });
});
