require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const { flushUsageLogs } = require('../middleware/logger');
const { clearCache } = require('../lib/redis');

let prisma;

beforeAll(async () => {
  try {
    // Use a test database URL if available, otherwise use the main one
    const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

    prisma = new PrismaClient({
      datasourceUrl: databaseUrl,
    });

    // Test the connection
    await prisma.$connect();
    global.prisma = prisma;

    // Clean up test data - delete in correct order to avoid foreign key constraints
    // Use raw SQL for more reliable cleanup
    await prisma.$executeRaw`DELETE FROM "Usage"`;
    await prisma.$executeRaw`DELETE FROM "ApiKey"`;
    await prisma.$executeRaw`DELETE FROM "Village"`;
    await prisma.$executeRaw`DELETE FROM "SubDistrict"`;
    await prisma.$executeRaw`DELETE FROM "District"`;
    await prisma.$executeRaw`DELETE FROM "State"`;
    await prisma.$executeRaw`DELETE FROM "Country"`;
    await prisma.$executeRaw`DELETE FROM "User"`;
  } catch (error) {
    console.warn('Database connection failed, skipping database cleanup:', error.message);
    // Set prisma to null to indicate no database connection
    prisma = null;
    global.prisma = null;
  }
});

afterEach(async () => {
  await flushUsageLogs();
  await clearCache();
});

afterAll(async () => {
  if (prisma) {
    await prisma.$disconnect();
  }
});