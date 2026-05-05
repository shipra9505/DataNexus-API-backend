const express = require('express')
const prisma = require('../lib/prisma')
const { AppError } = require('../utils/errorHandler')
const auth = require('./auth')

const router = express.Router()
const { requireAuth } = auth

const getLastDays = (days) => {
  const result = []
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today)
    date.setUTCDate(date.getUTCDate() - i)
    result.push({ label: date.toISOString().slice(0, 10), date })
  }

  return result
}

router.get('/dashboard', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    const weekStart = new Date(today)
    weekStart.setUTCDate(weekStart.getUTCDate() - 6)

    const usageEntries = await prisma.usage.findMany({
      where: { userId, date: { gte: weekStart } },
      orderBy: { date: 'asc' }
    })

    const dailyBuckets = getLastDays(7).map((day) => ({
      day: day.label.slice(5),
      requests: 0,
    }))

    let successful = 0
    let responseTotal = 0

    usageEntries.forEach((entry) => {
      const dayLabel = entry.date.toISOString().slice(5, 10)
      const bucket = dailyBuckets.find((item) => item.day === dayLabel)
      if (bucket) {
        bucket.requests += 1
      }
      if (entry.statusCode < 400) {
        successful += 1
      }
      responseTotal += entry.responseTime
    })

    const totalRequests = usageEntries.length
    const successRate = totalRequests ? Math.round((successful / totalRequests) * 100) : 100
    const averageResponse = totalRequests ? Math.round(responseTotal / totalRequests) : 0
    const todayRequests = usageEntries.filter(entry => entry.date >= today).length

    const topEndpoints = usageEntries.reduce((acc, entry) => {
      const key = `${entry.method} ${entry.endpoint}`
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})

    const topEndpointsArray = Object.entries(topEndpoints)
      .map(([endpoint, count]) => ({ endpoint, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    res.json({
      success: true,
      data: {
        dailyLimit: req.user.dailyLimit,
        todayRequests,
        totalRequests,
        remainingToday: Math.max(req.user.dailyLimit - todayRequests, 0),
        last7Days: dailyBuckets,
        successRate,
        averageResponse,
        topEndpoints: topEndpointsArray,
      }
    })
  } catch (error) {
    next(error)
  }
})

router.get('/recent', requireAuth, async (req, res, next) => {
  try {
    const logs = await prisma.usage.findMany({
      where: { userId: req.user.id },
      orderBy: { date: 'desc' },
      take: 10,
      select: {
        id: true,
        endpoint: true,
        method: true,
        statusCode: true,
        responseTime: true,
        date: true
      }
    })

    res.json({ success: true, data: logs })
  } catch (error) {
    next(error)
  }
})

module.exports = router
