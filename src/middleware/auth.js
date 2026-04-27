const prisma = require('../lib/prisma')
const { AppError } = require('../utils/errorHandler')

// This middleware runs before any protected route
const requireApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key']

    // ❌ Missing key
    if (!apiKey) {
      throw new AppError(
        'Missing API key. Add header: X-API-Key: your_key',
        401
      )
    }

    // 🔍 Find API key in DB
    const keyRecord = await prisma.apiKey.findUnique({
      where: { key: apiKey },
      include: { user: true }
    })

    // ❌ Invalid or revoked key
    if (!keyRecord || keyRecord.status !== 'ACTIVE') {
      throw new AppError('Invalid or revoked API key', 401)
    }

    // ✅ Attach to request
    req.user = keyRecord.user
    req.apiKey = keyRecord

    next()

  } catch (error) {
    next(error) // ✅ pass to centralized error handler
  }
}

module.exports = { requireApiKey }