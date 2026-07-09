import { buildApp, type BuildAppOptions } from '../../src/app';

export async function buildTestApp(options: Pick<BuildAppOptions, 'prisma'> = {}) {
  return buildApp({ logger: false, prisma: options.prisma });
}
