const express = require('express')
const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const speakeasy = require('speakeasy')
const { body, validationResult } = require('express-validator')
const prisma = require('../lib/prisma')
const { AppError } = require('../utils/errorHandler')
const { redis } = require('../lib/redis')
const { sendEmail } = require('../lib/email')
const { getRequiredEnv, getEnv } = require('../lib/env')

const router = express.Router()
const JWT_SECRET = getRequiredEnv('JWT_SECRET')
const JWT_EXPIRES = '8h'
const API_KEY_BYTES = 16
const EMAIL_VERIFY_TTL = 60 * 60 * 24
const FRONTEND_URL = getEnv('FRONTEND_URL', 'http://localhost:5173')

const createToken = (userId) => jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES })
const generateApiKey = () => `ak_${crypto.randomBytes(API_KEY_BYTES).toString('hex')}`
const fingerprintKey = (apiKey) => crypto.createHash('sha256').update(apiKey).digest('hex')
const validateApiKeyFormat = (apiKey) => /^ak_[0-9a-f]{32}$/.test(apiKey)

const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Missing Authorization header', 401)
    }

    const token = authHeader.split(' ')[1]
    let payload

    try {
      payload = jwt.verify(token, JWT_SECRET)
    } catch (error) {
      throw new AppError('Invalid or expired token', 401)
    }

    const user = await prisma.user.findUnique({ where: { id: payload.userId } })

    if (!user || user.status !== 'ACTIVE') {
      throw new AppError('User not found or not active', 401)
    }

    req.user = user
    next()
  } catch (error) {
    next(error)
  }
}

const sanitizeUser = (user) => {
  const {
    passwordHash,
    twoFactorSecret,
    twoFactorTempSecret,
    ...safeUser
  } = user
  return {
    ...safeUser,
    emailVerified: user.emailVerified ?? false,
  }
}

const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user || !['ADMIN', 'SUPERADMIN'].includes(req.user.role)) {
      throw new AppError('Admin access required', 403)
    }
    next()
  } catch (error) {
    next(error)
  }
}

const requireAdmin2FA = async (req, res, next) => {
  try {
    if (!req.user || !['ADMIN', 'SUPERADMIN'].includes(req.user.role)) {
      throw new AppError('Admin access required', 403)
    }

    if (!req.user.twoFactorEnabled) {
      return next()
    }

    const token = req.headers['x-2fa-code'] || req.body.twoFactorCode
    if (!token) {
      throw new AppError('2FA code required for admin actions', 401)
    }

    const verified = speakeasy.totp.verify({
      secret: req.user.twoFactorSecret,
      encoding: 'base32',
      token,
      window: 1,
    })

    if (!verified) {
      throw new AppError('Invalid 2FA code', 401)
    }

    next()
  } catch (error) {
    next(error)
  }
}

const runValidation = (req) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    throw new AppError(errors.array()[0].msg, 400)
  }
}

router.post(
  '/register',
  body('businessName').trim().notEmpty().withMessage('businessName is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  async (req, res, next) => {
    try {
      runValidation(req)

      const { businessName, email, phone, gst, password } = req.body
      const existing = await prisma.user.findUnique({ where: { email } })

      if (existing) {
        throw new AppError('Email is already registered', 409)
      }

      const passwordHash = await bcrypt.hash(password, 10)
      const user = await prisma.user.create({
        data: {
          businessName,
          email,
          phone,
          gst,
          passwordHash,
          plan: 'FREE',
          status: 'PENDING_APPROVAL',
          dailyLimit: 5000,
          emailVerified: false
        }
      })

      const verificationToken = crypto.randomBytes(32).toString('hex')
      await redis.setex(`emailVerify:${verificationToken}`, EMAIL_VERIFY_TTL, String(user.id))
      const verifyUrl = `${FRONTEND_URL}/verify-email?token=${verificationToken}`

      await sendEmail({
        to: user.email,
        subject: 'Verify your Bluestock account email',
        text: `Hello ${user.businessName || user.email},\n\nPlease verify your email address by visiting ${verifyUrl}.\n\nThis link expires in 24 hours.\n\nThank you,\nBluestock API Team`,
        html: `<p>Hello ${user.businessName || user.email},</p><p>Please verify your email address by clicking <a href="${verifyUrl}">here</a>.</p><p>This link expires in 24 hours.</p><p>Thank you,<br/>Bluestock API Team</p>`
      })

      const token = createToken(user.id)

      res.status(201).json({
        success: true,
        data: {
          user: sanitizeUser(user),
          token,
          message: 'Registration successful. Account is pending approval.'
        }
      })
    } catch (error) {
      next(error)
    }
  }
)

router.post(
  '/verify-email',
  body('token').notEmpty().withMessage('Verification token is required'),
  async (req, res, next) => {
    try {
      runValidation(req)

      const { token } = req.body
      const redisKey = `emailVerify:${token}`
      const userId = await redis.get(redisKey)

      if (!userId) {
        throw new AppError('Invalid or expired verification token', 400)
      }

      const user = await prisma.user.update({
        where: { id: parseInt(userId, 10) },
        data: { emailVerified: true }
      })

      await redis.del(redisKey)

      res.json({
        success: true,
        data: {
          user: sanitizeUser(user),
          message: 'Email verified successfully. Waiting for admin approval.'
        }
      })
    } catch (error) {
      next(error)
    }
  }
)

router.post(
  '/resend-verification',
  body('email').isEmail().withMessage('Valid email is required'),
  async (req, res, next) => {
    try {
      runValidation(req)

      const { email } = req.body
      const user = await prisma.user.findUnique({ where: { email } })
      if (!user) {
        throw new AppError('User not found', 404)
      }
      if (user.emailVerified) {
        throw new AppError('Email already verified', 400)
      }

      const verificationToken = crypto.randomBytes(32).toString('hex')
      await redis.setex(`emailVerify:${verificationToken}`, EMAIL_VERIFY_TTL, String(user.id))
      const verifyUrl = `${FRONTEND_URL}/verify-email?token=${verificationToken}`

      await sendEmail({
        to: user.email,
        subject: 'Verify your Bluestock account email',
        text: `Hello ${user.businessName || user.email},\n\nPlease verify your email address by visiting ${verifyUrl}.\n\nThis link expires in 24 hours.\n\nThank you,\nBluestock API Team`,
        html: `<p>Hello ${user.businessName || user.email},</p><p>Please verify your email address by clicking <a href="${verifyUrl}">here</a>.</p><p>This link expires in 24 hours.</p><p>Thank you,<br/>Bluestock API Team</p>`
      })

      res.json({ success: true, message: 'Verification email resent.' })
    } catch (error) {
      next(error)
    }
  }
)

router.post(
  '/login',
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
  async (req, res, next) => {
    try {
      runValidation(req)

      const { email, password } = req.body
      const user = await prisma.user.findUnique({ where: { email } })

      if (!user) {
        throw new AppError('Invalid email or password', 401)
      }

      const passwordMatches = await bcrypt.compare(password, user.passwordHash)
      if (!passwordMatches) {
        throw new AppError('Invalid email or password', 401)
      }

      if (!user.emailVerified) {
        throw new AppError('Please verify your email before logging in.', 403)
      }

      if (user.status !== 'ACTIVE') {
        throw new AppError('Account is not active. Please contact support.', 403)
      }

      const token = createToken(user.id)

      res.json({
        success: true,
        data: {
          user: sanitizeUser(user),
          token
        }
      })
    } catch (error) {
      next(error)
    }
  }
)

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    res.json({ success: true, data: sanitizeUser(req.user) })
  } catch (error) {
    next(error)
  }
})

router.post('/2fa/setup', requireAuth, async (req, res, next) => {
  try {
    const secret = speakeasy.generateSecret({
      name: `Bluestock (${req.user.email})`,
      length: 20,
    })

    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        twoFactorTempSecret: secret.base32,
      }
    })

    res.json({
      success: true,
      data: {
        otpauthUrl: secret.otpauth_url,
        base32: secret.base32,
      }
    })
  } catch (error) {
    next(error)
  }
})

router.post('/2fa/verify', requireAuth, async (req, res, next) => {
  try {
    const { token } = req.body
    if (!token) {
      throw new AppError('2FA token is required', 400)
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    })

    if (!user?.twoFactorTempSecret) {
      throw new AppError('2FA setup has not been initialized', 400)
    }

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorTempSecret,
      encoding: 'base32',
      token,
      window: 1,
    })

    if (!verified) {
      throw new AppError('Invalid 2FA token', 401)
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorSecret: user.twoFactorTempSecret,
        twoFactorTempSecret: null,
        twoFactorEnabled: true,
      }
    })

    res.json({ success: true, message: '2FA enabled successfully' })
  } catch (error) {
    next(error)
  }
})

router.post('/2fa/disable', requireAuth, async (req, res, next) => {
  try {
    const { token } = req.body
    if (!token) {
      throw new AppError('2FA token is required', 400)
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    })

    if (!user?.twoFactorEnabled || !user.twoFactorSecret) {
      throw new AppError('2FA is not enabled', 400)
    }

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token,
      window: 1,
    })

    if (!verified) {
      throw new AppError('Invalid 2FA token', 401)
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorTempSecret: null,
      }
    })

    res.json({ success: true, message: '2FA disabled successfully' })
  } catch (error) {
    next(error)
  }
})

router.get('/apikeys', requireAuth, async (req, res, next) => {
  try {
    const apiKeys = await prisma.apiKey.findMany({
      where: { userId: req.user.id },
      select: {
        id: true,
        status: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    })

    res.json({ success: true, count: apiKeys.length, data: apiKeys })
  } catch (error) {
    next(error)
  }
})

router.post('/apikeys', requireAuth, async (req, res, next) => {
  try {
    const existingCount = await prisma.apiKey.count({ where: { userId: req.user.id } })
    if (existingCount >= 5) {
      throw new AppError('Maximum of 5 API keys allowed per user', 403)
    }

    const keyValue = generateApiKey()
    const fingerprint = fingerprintKey(keyValue)
    const secretHash = await bcrypt.hash(keyValue, 10)

    const apiKey = await prisma.apiKey.create({
      data: {
        fingerprint,
        secretHash,
        userId: req.user.id,
        status: 'ACTIVE'
      }
    })

    res.status(201).json({
      success: true,
      data: {
        id: apiKey.id,
        status: apiKey.status,
        createdAt: apiKey.createdAt,
      },
      apiKey: keyValue
    })
  } catch (error) {
    next(error)
  }
})

router.patch('/apikeys/:id/revoke', requireAuth, async (req, res, next) => {
  try {
    const keyId = parseInt(req.params.id)
    if (Number.isNaN(keyId)) {
      throw new AppError('Invalid API key ID', 400)
    }

    const apiKey = await prisma.apiKey.findUnique({ where: { id: keyId } })
    if (!apiKey || apiKey.userId !== req.user.id) {
      throw new AppError('API key not found', 404)
    }

    if (apiKey.status === 'REVOKED') {
      throw new AppError('API key is already revoked', 400)
    }

    const updated = await prisma.apiKey.update({
      where: { id: keyId },
      data: { status: 'REVOKED' }
    })

    res.json({ success: true, data: { id: updated.id, status: updated.status } })
  } catch (error) {
    next(error)
  }
})

router.patch('/apikeys/:id/rotate', requireAuth, async (req, res, next) => {
  try {
    const keyId = parseInt(req.params.id, 10)
    if (Number.isNaN(keyId)) {
      throw new AppError('Invalid API key ID', 400)
    }

    const currentKey = await prisma.apiKey.findUnique({ where: { id: keyId } })
    if (!currentKey || currentKey.userId !== req.user.id) {
      throw new AppError('API key not found', 404)
    }
    if (currentKey.status !== 'ACTIVE') {
      throw new AppError('Only active API keys can be rotated', 400)
    }

    await prisma.apiKey.update({
      where: { id: keyId },
      data: { status: 'REVOKED' }
    })

    const newKeyValue = generateApiKey()
    const fingerprint = fingerprintKey(newKeyValue)
    const secretHash = await bcrypt.hash(newKeyValue, 10)

    const apiKey = await prisma.apiKey.create({
      data: {
        fingerprint,
        secretHash,
        userId: req.user.id,
        status: 'ACTIVE'
      }
    })

    res.json({
      success: true,
      data: {
        id: apiKey.id,
        status: apiKey.status,
        createdAt: apiKey.createdAt,
      },
      apiKey: newKeyValue
    })
  } catch (error) {
    next(error)
  }
})

module.exports = router
module.exports.requireAuth = requireAuth
module.exports.requireAdmin = requireAdmin
module.exports.requireAdmin2FA = requireAdmin2FA
