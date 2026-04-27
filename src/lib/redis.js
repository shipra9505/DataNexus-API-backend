const { Redis } = require('@upstash/redis')

const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

// Helper — get from cache or run the database query
// Usage: const data = await cached('states_all', () => prisma.state.findMany())
const cached = async (key, fetchFn, ttlSeconds = 3600) => {
  const hit = await redis.get(key)
  if (hit) {
    console.log(`Cache HIT: ${key}`)
    return hit
  }
  console.log(`Cache MISS: ${key}`)
  const data = await fetchFn()
  await redis.setex(key, ttlSeconds, JSON.stringify(data))
  return data
}

module.exports = { redis, cached }