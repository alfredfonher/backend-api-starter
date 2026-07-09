import 'dotenv/config';

export type NodeEnv = 'development' | 'test' | 'production';

export interface AppEnv {
  nodeEnv: NodeEnv;
  port: number;
  host: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  bcryptRounds: number;
}

const NODE_ENVS: NodeEnv[] = ['development', 'test', 'production'];

function parsePort(rawPort: string | undefined): number {
  const port = Number.parseInt(rawPort ?? '3000', 10);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT value: ${rawPort ?? '3000'}`);
  }

  return port;
}

function parseNodeEnv(rawNodeEnv: string | undefined): NodeEnv {
  const nodeEnv = (rawNodeEnv ?? 'development') as NodeEnv;

  if (!NODE_ENVS.includes(nodeEnv)) {
    throw new Error(`Invalid NODE_ENV value: ${rawNodeEnv ?? ''}`);
  }

  return nodeEnv;
}

function parseRequiredString(name: string, rawValue: string | undefined): string {
  if (!rawValue?.trim()) {
    throw new Error(`${name} is required`);
  }

  return rawValue;
}

function parseBcryptRounds(rawValue: string | undefined): number {
  const rounds = Number.parseInt(rawValue ?? '12', 10);

  if (!Number.isInteger(rounds) || rounds < 10 || rounds > 14) {
    throw new Error('BCRYPT_ROUNDS must be an integer between 10 and 14');
  }

  return rounds;
}

export function loadEnv(env: NodeJS.ProcessEnv = process.env): AppEnv {
  return {
    nodeEnv: parseNodeEnv(env.NODE_ENV),
    port: parsePort(env.PORT),
    host: env.HOST ?? '0.0.0.0',
    jwtSecret: parseRequiredString('JWT_SECRET', env.JWT_SECRET),
    jwtExpiresIn: env.JWT_EXPIRES_IN ?? '1h',
    bcryptRounds: parseBcryptRounds(env.BCRYPT_ROUNDS),
  };
}
