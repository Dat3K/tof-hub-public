import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    url: process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/tof_hub',
  },
});
