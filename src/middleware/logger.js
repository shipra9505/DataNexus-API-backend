const prisma = require('../lib/prisma')

const pendingUsageLogs = new Set()

const requestLogger = (req, res, next) => {
  const startedAt = Date.now()

  res.on('finish', () => {
    if (!req.user) {
      return
    }

    const endpoint = req.originalUrl.split('?')[0]
    const method = req.method
    const statusCode = res.statusCode
    const responseTime = Date.now() - startedAt

    const logPromise = prisma.usage.create({
      data: {
        userId: req.user.id,
        apiKeyId: req.apiKey?.id || null,
        endpoint,
        method,
        statusCode,
        responseTime,
      }
    })
      .catch((err) => {
        console.error('Request logging failed:', err)
      })
      .finally(() => {
        pendingUsageLogs.delete(logPromise)
      })

    pendingUsageLogs.add(logPromise)
  })

  next()
}

const flushUsageLogs = async () => {
  if (pendingUsageLogs.size === 0) {
    return
  }
  await Promise.all([...pendingUsageLogs])
}

module.exports = { requestLogger, flushUsageLogs }
