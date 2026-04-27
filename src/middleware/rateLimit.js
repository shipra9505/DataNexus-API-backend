const { redis } = require('../lib/redis')

// Rate limiting middleware using Redis
// Tracks how many requests each API key makes per day
// and blocks them if they exceed their plan's limit

const PLAN_LIMITS = {
  FREE:      5000,
  PREMIUM:   50000,
  PRO:       300000,
  UNLIMITED: 1000000,
}

const rateLimit = (plan = 'FREE') => {
  return async (req, res, next) => {
    try {
      const apiKey = req.headers['x-api-key']

      // If no API key, skip rate limiting — auth middleware handles this
      if (!apiKey) return next()

      const today = new Date().toISOString().split('T')[0] // e.g. "2024-01-15"
      const redisKey = `ratelimit:${apiKey}:${today}`
      const limit = PLAN_LIMITS[plan] || PLAN_LIMITS.FREE

      // Increment request count in Redis
      const current = await redis.incr(redisKey)

      // Set expiry to 24 hours on first request of the day
      if (current === 1) {
        await redis.expire(redisKey, 86400)
      }

      // Attach rate limit info to response headers
      res.setHeader('X-RateLimit-Limit',     limit)
      res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - current))
      res.setHeader('X-RateLimit-Used',      current)

      // Block if over limit
      if (current > limit) {
        return res.status(429).json({
          success: false,
          error:   'Rate limit exceeded. Upgrade your plan for more requests.',
          reset:   `Resets at midnight UTC`,
          limit,
          used:    current,
        })
      }

      next()
    } catch (error) {
      // If Redis fails, don't block the request — just log and continue
      console.error('Rate limit check failed:', error)
      next()
    }
  }
}

module.exports = { rateLimit }