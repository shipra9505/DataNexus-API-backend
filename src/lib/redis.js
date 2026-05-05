const { Redis } = require('@upstash/redis')
const { getEnv } = require('./env')

const redisUrl = getEnv('UPSTASH_REDIS_REST_URL')
const redisToken = getEnv('UPSTASH_REDIS_REST_TOKEN')

const memoryStore = new Map()

const memoryRedis = {
  async get(key) {
    const item = memoryStore.get(key)
    if (!item) return null
    if (item.expiresAt && Date.now() > item.expiresAt) {
      memoryStore.delete(key)
      return null
    }
    return item.value
  },

  async setex(key, ttl, value) {
    memoryStore.set(key, {
      value,
      expiresAt: Date.now() + ttl * 1000,
    })
    return true
  },

  async del(key) {
    return memoryStore.delete(key)
  },
}

let redisClient = null
let useUpstash = false

if (redisUrl && redisToken) {
  try {
    redisClient = new Redis({
      url: redisUrl,
      token: redisToken,
    })
    useUpstash = true
  } catch (error) {
    console.warn('Failed to initialize Upstash Redis. Falling back to in-memory cache:', error.message)
  }
} else {
  console.warn('Upstash Redis is not configured. Falling back to in-memory cache for local development only.')
}

const safeRedis = async (method, ...args) => {
  if (!useUpstash || !redisClient) {
    return memoryRedis[method](...args)
  }

  try {
    return await redisClient[method](...args)
  } catch (error) {
    console.warn(`Upstash Redis command failed (${method}). Falling back to in-memory cache:`, error.message)
    useUpstash = false
    return memoryRedis[method](...args)
  }
}

const redis = {
  get: (key) => safeRedis('get', key),
  setex: (key, ttl, value) => safeRedis('setex', key, ttl, value),
  del: (key) => safeRedis('del', key),
}

const clearCache = async () => {
  if (!useUpstash) {
    memoryStore.clear()
  }
}

// Helper — get from cache or run the database query
// Usage: const data = await cached('states_all', () => prisma.state.findMany())
const cached = async (key, fetchFn, ttlSeconds = 3600) => {
  const hit = await redis.get(key)
  if (hit) {
    console.log(`Cache HIT: ${key}`)
    return typeof hit === 'string' ? JSON.parse(hit) : hit
  }
  console.log(`Cache MISS: ${key}`)
  const data = await fetchFn()
  await redis.setex(key, ttlSeconds, JSON.stringify(data))
  return data
}

module.exports = { redis, cached, clearCache }