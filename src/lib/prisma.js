const { PrismaClient } = require('@prisma/client')

// This pattern ensures only ONE connection is made, not a new one per request
const globalForPrisma = globalThis

const prisma = globalForPrisma.prisma ?? new PrismaClient({
    log: ['error', 'warn'],
})

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma
}

module.exports = prisma