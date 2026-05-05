const { redis } = require('../lib/redis')
const { sendUsageAlert } = require('../lib/email')

// Rate limiting middleware using Redis
// Tracks how many requests each API key makes per day
// and blocks them if they exceed their plan's limit

const PLAN_LIMITS = {
  FREE:      5000,
  PREMIUM:   50000,
  PRO:       300000,
  UNLIMITED: 1000000,
}

const ALERT_THRESHOLDS = [0.8, 0.95]

const getAlertKey = (userId, date) => `usage-alert:${userId}:${date}`

const shouldSendAlert = async (userId, current, limit, date) => {
  const alertKey = getAlertKey(userId, date)
  const lastAlert = await redis.get(alertKey)
  const currentThreshold = ALERT_THRESHOLDS.reduce((prev, threshold) => {
    if (current >= limit * threshold) {
      return Math.max(prev, threshold)
    }
    return prev
  }, 0)

  if (currentThreshold === 0) {
    return null
  }

  if (!lastAlert || parseFloat(lastAlert) < currentThreshold) {
    await redis.setex(alertKey, 86400, currentThreshold.toString())
    return currentThreshold
  }

  return null
}

const rateLimit = (plan = null) => {
  return async (req, res, next) => {
    try {
      const apiKey = req.headers['x-api-key']
      if (!apiKey) return next()

      const user = req.apiKey?.user
      const effectivePlan = plan || user?.plan || 'FREE'
      const planLimit = PLAN_LIMITS[effectivePlan] || PLAN_LIMITS.FREE
      const limit = user?.dailyLimit ? Math.max(user.dailyLimit, planLimit) : planLimit
      const today = new Date().toISOString().split('T')[0]
      const redisKey = `ratelimit:${apiKey}:${today}`

      const current = await redis.incr(redisKey)
      if (current === 1) {
        await redis.expire(redisKey, 86400)
      }

      res.setHeader('X-RateLimit-Limit',     limit)
      res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - current))
      res.setHeader('X-RateLimit-Used',      current)
      res.setHeader('X-RateLimit-Plan',      effectivePlan)

      if (current > limit) {
        return res.status(429).json({
          success: false,
          error:   'Rate limit exceeded. Upgrade your plan for more requests.',
          reset:   'Resets at midnight UTC',
          limit,
          used:    current,
          plan:    effectivePlan,
        })
      }

      if (user && user.email) {
        const threshold = await shouldSendAlert(user.id, current, limit, today)
        if (threshold) {
          sendUsageAlert({ user, current, limit, threshold })
            .catch((err) => console.error('Failed to send usage alert email:', err))
        }
      }

      next()
    } catch (error) {
      console.error('Rate limit check failed:', error)
      next()
    }
  }
}

module.exports = { rateLimit, PLAN_LIMITS }