import bcrypt from 'bcrypt';
import { loadEnv } from '../config/env';

export async function hashPassword(password: string): Promise<string> {
  const env = loadEnv();
  return bcrypt.hash(password, env.bcryptRounds);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}
