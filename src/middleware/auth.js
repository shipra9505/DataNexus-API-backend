const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const prisma = require('../lib/prisma')
const { AppError } = require('../utils/errorHandler')
const { getEnv } = require('../lib/env')

const DEMO_API_KEY = getEnv('DEMO_API_KEY')
const DEMO_STATE_NAME = getEnv('DEMO_STATE_NAME', 'Maharashtra')

const validateApiKeyFormat = (apiKey) => {
  return /^ak_[0-9a-f]{32}$/.test(apiKey)
}

const fingerprintKey = (apiKey) => {
  return crypto.createHash('sha256').update(apiKey).digest('hex')
}

// This middleware runs before any protected route
const requireApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key']

    if (!apiKey) {
      throw new AppError('Missing API key. Add header: X-API-Key: your_key', 401)
    }

    if (!validateApiKeyFormat(apiKey)) {
      throw new AppError('Invalid API key format', 401)
    }

    if (DEMO_API_KEY && apiKey === DEMO_API_KEY) {
      req.demoMode = true
      req.demoStateName = DEMO_STATE_NAME
      req.apiKey = { demo: true }
      req.stateAccess = null
      return next()
    }

    const fingerprint = fingerprintKey(apiKey)
    const keyRecord = await prisma.apiKey.findUnique({
      where: { fingerprint },
      include: { user: true }
    })

    if (!keyRecord || keyRecord.status !== 'ACTIVE') {
      throw new AppError('Invalid or revoked API key', 401)
    }

    const validSecret = await bcrypt.compare(apiKey, keyRecord.secretHash)
    if (!validSecret) {
      throw new AppError('Invalid API key', 401)
    }

    req.user = keyRecord.user
    req.apiKey = keyRecord
    req.stateAccess = Array.isArray(keyRecord.user.stateAccess)
      ? keyRecord.user.stateAccess
      : null

    next()
  } catch (error) {
    next(error)
  }
}

module.exports = { requireApiKey }