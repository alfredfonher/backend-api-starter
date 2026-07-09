import bcrypt from 'bcrypt';
import { PrismaClient, Role } from '@prisma/client';

const DEFAULT_BCRYPT_ROUNDS = 12;

function parseBcryptRounds(rawValue: string | undefined): number {
  const rounds = Number.parseInt(rawValue ?? String(DEFAULT_BCRYPT_ROUNDS), 10);

  if (!Number.isInteger(rounds) || rounds < 10 || rounds > 14) {
    throw new Error('BCRYPT_ROUNDS must be an integer between 10 and 14');
  }

  return rounds;
}

function getSeedConfig(env: NodeJS.ProcessEnv = process.env) {
  const name = env.SEED_ADMIN_NAME?.trim();
  const email = env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = env.SEED_ADMIN_PASSWORD;

  if (!name || !email || !password) {
    return null;
  }

  return {
    name,
    email,
    password,
    bcryptRounds: parseBcryptRounds(env.BCRYPT_ROUNDS),
  };
}

export async function seed(prisma = new PrismaClient()): Promise<void> {
  const config = getSeedConfig();

  if (!config) {
    console.info('Skipping admin seed: SEED_ADMIN_NAME, SEED_ADMIN_EMAIL, and SEED_ADMIN_PASSWORD are required.');
    return;
  }

  const existingAdmin = await prisma.user.findUnique({
    where: { email: config.email },
  });

  if (existingAdmin) {
    await prisma.user.update({
      where: { email: config.email },
      data: {
        name: config.name,
        role: Role.ADMIN,
      },
    });
    return;
  }

  const passwordHash = await bcrypt.hash(config.password, config.bcryptRounds);

  await prisma.user.create({
    data: {
      name: config.name,
      email: config.email,
      passwordHash,
      role: Role.ADMIN,
    },
  });
}

export async function main(): Promise<void> {
  const prisma = new PrismaClient();

  try {
    await seed(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
