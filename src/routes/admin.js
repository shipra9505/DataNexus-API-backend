const express = require('express')
const prisma = require('../lib/prisma')
const auth = require('./auth')
const { AppError } = require('../utils/errorHandler')
const { sendUserStatusEmail } = require('../lib/email')

const router = express.Router()
const { requireAuth, requireAdmin, requireAdmin2FA } = auth

const PLAN_LIMITS = {
  FREE:      5000,
  PREMIUM:   50000,
  PRO:       300000,
  UNLIMITED: 1000000,
}

const VALID_PLANS = Object.keys(PLAN_LIMITS)

router.use(requireAuth, requireAdmin, requireAdmin2FA)

router.get('/overview', async (req, res, next) => {
  try {
    const [totalVillages, activeUsers, pendingUsers, planGroups] = await Promise.all([
      prisma.village.count(),
      prisma.user.count({ where: { status: 'ACTIVE' } }),
      prisma.user.count({ where: { status: 'PENDING_APPROVAL' } }),
      prisma.user.groupBy({ by: ['plan'], _count: { _all: true } }),
    ])

    const todayStart = new Date()
    todayStart.setUTCHours(0, 0, 0, 0)

    const todayUsage = await prisma.usage.findMany({
      where: { date: { gte: todayStart } },
      select: { statusCode: true }
    })

    const totalRequests = todayUsage.length
    const successRate = totalRequests === 0
      ? 100
      : Math.round((todayUsage.filter(u => u.statusCode < 400).length / totalRequests) * 100)

    const planData = planGroups.map(p => ({ name: p.plan, value: p._count._all }))

    const states = await prisma.state.findMany({
      orderBy: { name: 'asc' },
      include: {
        districts: {
          include: {
            subDistricts: {
              include: {
                _count: { select: { villages: true } }
              }
            }
          }
        }
      }
    })

    const topStates = states.map(s => ({
      state: s.name,
      villages: s.districts.reduce((districtTotal, d) => {
        return districtTotal + d.subDistricts.reduce((subTotal, sd) => subTotal + sd._count.villages, 0)
      }, 0)
    }))
      .sort((a, b) => b.villages - a.villages)
      .slice(0, 5)

    res.json({
      success: true,
      data: {
        totalVillages,
        activeUsers,
        pendingUsers,
        totalRequests,
        successRate,
        planData,
        topStates,
      }
    })
  } catch (error) {
    next(error)
  }
})

router.get('/users', async (req, res, next) => {
  try {
    const status = req.query.status || undefined
    const where = status ? { status } : {}

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        businessName: true,
        email: true,
        phone: true,
        gst: true,
        plan: true,
        dailyLimit: true,
        status: true,
        role: true,
        stateAccess: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' }
    })

    res.json({ success: true, count: users.length, data: users })
  } catch (error) {
    next(error)
  }
})

router.get('/states', async (req, res, next) => {
  try {
    const states = await prisma.state.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true }
    })

    res.json({ success: true, count: states.length, data: states })
  } catch (error) {
    next(error)
  }
})

router.get('/logs', async (req, res, next) => {
  try {
    const { endpoint, status, userEmail, page = 1, limit = 20, fromDate, toDate } = req.query
    const parsedPage = Math.max(parseInt(page, 10) || 1, 1)
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100)
    const where = {}

    if (endpoint) {
      where.endpoint = { contains: endpoint, mode: 'insensitive' }
    }
    if (status && !isNaN(parseInt(status, 10))) {
      where.statusCode = parseInt(status, 10)
    }
    if (userEmail) {
      where.user = { email: { contains: userEmail, mode: 'insensitive' } }
    }
    if (fromDate) {
      const from = new Date(fromDate)
      if (isNaN(from)) throw new AppError('Invalid fromDate', 400)
      where.date = { ...where.date, gte: from }
    }
    if (toDate) {
      const to = new Date(toDate)
      if (isNaN(to)) throw new AppError('Invalid toDate', 400)
      where.date = { ...where.date, lte: to }
    }

    const [logs, total] = await Promise.all([
      prisma.usage.findMany({
        where,
        include: { user: { select: { email: true, businessName: true } }, apiKey: { select: { id: true } } },
        orderBy: { date: 'desc' },
        skip: (parsedPage - 1) * parsedLimit,
        take: parsedLimit,
      }),
      prisma.usage.count({ where })
    ])

    const formatted = logs.map(log => ({
      id: log.id,
      time: log.date.toISOString(),
      user: log.user?.email || 'unknown',
      endpoint: log.endpoint,
      status: log.statusCode,
      ms: log.responseTime,
      apiKeyId: log.apiKey?.id || null,
    }))

    res.json({
      success: true,
      meta: {
        total,
        count: formatted.length,
        page: parsedPage,
        limit: parsedLimit,
        totalPages: Math.ceil(total / parsedLimit)
      },
      data: formatted
    })
  } catch (error) {
    next(error)
  }
})

const changeUserStatus = async (req, res, next, targetStatus) => {
  try {
    const userId = parseInt(req.params.id)
    if (Number.isNaN(userId)) {
      throw new AppError('Invalid user ID', 400)
    }

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      throw new AppError('User not found', 404)
    }

    if (user.status === targetStatus) {
      throw new AppError(`User already has status ${targetStatus}`, 400)
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { status: targetStatus }
    })

    sendUserStatusEmail({ user, status: targetStatus })
      .catch(err => console.error('Failed to send approval email:', err))

    res.json({ success: true, data: { id: updated.id, status: updated.status } })
  } catch (error) {
    next(error)
  }
}

router.patch('/users/:id/approve', async (req, res, next) => {
  return changeUserStatus(req, res, next, 'ACTIVE')
})

router.patch('/users/:id/reject', async (req, res, next) => {
  return changeUserStatus(req, res, next, 'REJECTED')
})

router.patch('/users/:id/access', async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id)
    if (Number.isNaN(userId)) {
      throw new AppError('Invalid user ID', 400)
    }

    const { stateIds } = req.body
    if (!Array.isArray(stateIds)) {
      throw new AppError('stateIds must be an array of state IDs', 400)
    }

    const parsedStateIds = stateIds.map(id => parseInt(id, 10)).filter(id => !Number.isNaN(id))
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { stateAccess: parsedStateIds }
    })

    res.json({ success: true, data: { id: updated.id, stateAccess: updated.stateAccess } })
  } catch (error) {
    next(error)
  }
})

router.patch('/users/:id/plan', async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id)
    if (Number.isNaN(userId)) {
      throw new AppError('Invalid user ID', 400)
    }

    const { plan, dailyLimit } = req.body
    if (!plan || !VALID_PLANS.includes(plan)) {
      throw new AppError('Invalid or missing plan', 400)
    }

    const updateData = { plan }
    if (dailyLimit !== undefined) {
      const parsedLimit = parseInt(dailyLimit, 10)
      if (Number.isNaN(parsedLimit) || parsedLimit <= 0) {
        throw new AppError('dailyLimit must be a positive integer', 400)
      }
      updateData.dailyLimit = parsedLimit
    } else {
      updateData.dailyLimit = PLAN_LIMITS[plan]
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    })

    res.json({ success: true, data: { id: updated.id, plan: updated.plan, dailyLimit: updated.dailyLimit } })
  } catch (error) {
    next(error)
  }
})

router.patch('/users/:id/limit', async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id)
    if (Number.isNaN(userId)) {
      throw new AppError('Invalid user ID', 400)
    }

    const { dailyLimit } = req.body
    const parsedLimit = parseInt(dailyLimit, 10)
    if (Number.isNaN(parsedLimit) || parsedLimit <= 0) {
      throw new AppError('dailyLimit must be a positive integer', 400)
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { dailyLimit: parsedLimit },
    })

    res.json({ success: true, data: { id: updated.id, dailyLimit: updated.dailyLimit } })
  } catch (error) {
    next(error)
  }
})

module.exports = router
