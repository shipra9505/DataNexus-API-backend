const request = require('supertest')
const app = require('../app')
const { PrismaClient } = require('@prisma/client')

const prisma = global.prisma || new PrismaClient()

describe('Usage API', () => {
  let testUser
  let authToken

  beforeEach(async () => {
    // Clean up before each test - delete in correct order to avoid foreign key constraints
    await prisma.usage.deleteMany({})
    await prisma.apiKey.deleteMany({})
    await prisma.user.deleteMany({})

    // Create a test user with unique email
    const uniqueId = Date.now() + Math.random()
    testUser = await prisma.user.create({
      data: {
        businessName: 'Test Business',
        email: `test${uniqueId}@example.com`,
        passwordHash: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // 'password'
        plan: 'FREE',
        status: 'ACTIVE',
        dailyLimit: 5000,
        emailVerified: true
      }
    })

    // Login to get token
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testUser.email,
        password: 'password'
      })
    authToken = response.body.data.token
  })

  describe('GET /api/v1/usage/dashboard', () => {
    it('should return usage dashboard with no usage data', async () => {
      const response = await request(app)
        .get('/api/v1/usage/dashboard')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('dailyLimit', 5000)
      expect(response.body.data).toHaveProperty('todayRequests', 0)
      expect(response.body.data).toHaveProperty('totalRequests', 0)
      expect(response.body.data).toHaveProperty('remainingToday', 5000)
      expect(response.body.data).toHaveProperty('last7Days')
      expect(response.body.data).toHaveProperty('successRate', 100)
      expect(response.body.data).toHaveProperty('averageResponse', 0)
      expect(response.body.data).toHaveProperty('topEndpoints')
      expect(Array.isArray(response.body.data.last7Days)).toBe(true)
      expect(Array.isArray(response.body.data.topEndpoints)).toBe(true)
    })

    it('should return usage dashboard with usage data', async () => {
      // Create some usage data
      const today = new Date()
      today.setUTCHours(0, 0, 0, 0)

      await prisma.usage.createMany({
        data: [
          {
            userId: testUser.id,
            endpoint: '/api/v1/search',
            method: 'GET',
            statusCode: 200,
            responseTime: 150,
            date: today
          },
          {
            userId: testUser.id,
            endpoint: '/api/v1/states',
            method: 'GET',
            statusCode: 200,
            responseTime: 100,
            date: today
          },
          {
            userId: testUser.id,
            endpoint: '/api/v1/search',
            method: 'GET',
            statusCode: 400,
            responseTime: 50,
            date: today
          }
        ]
      })

      const response = await request(app)
        .get('/api/v1/usage/dashboard')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.todayRequests).toBe(3)
      expect(response.body.data.totalRequests).toBe(3)
      expect(response.body.data.remainingToday).toBe(4997)
      expect(response.body.data.successRate).toBe(67) // 2 out of 3 successful
      expect(response.body.data.averageResponse).toBe(100) // (150+100+50)/3
      expect(response.body.data.topEndpoints).toHaveLength(2)
      expect(response.body.data.topEndpoints[0]).toHaveProperty('endpoint', 'GET /api/v1/search')
      expect(response.body.data.topEndpoints[0]).toHaveProperty('count', 2)
    })

    it('should reject request without authentication', async () => {
      const response = await request(app)
        .get('/api/v1/usage/dashboard')
        .expect(401)

      expect(response.body.success).toBe(false)
    })
  })

  describe('GET /api/v1/usage/recent', () => {
    it('should return recent usage logs', async () => {
      // Create some usage data
      const today = new Date()

      await prisma.usage.createMany({
        data: [
          {
            userId: testUser.id,
            endpoint: '/api/v1/search',
            method: 'GET',
            statusCode: 200,
            responseTime: 150,
            date: today
          },
          {
            userId: testUser.id,
            endpoint: '/api/v1/states',
            method: 'GET',
            statusCode: 200,
            responseTime: 100,
            date: new Date(today.getTime() - 1000)
          }
        ]
      })

      const response = await request(app)
        .get('/api/v1/usage/recent')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(Array.isArray(response.body.data)).toBe(true)
      expect(response.body.data).toHaveLength(2)
      expect(response.body.data[0]).toHaveProperty('endpoint', '/api/v1/search')
      expect(response.body.data[0]).toHaveProperty('method', 'GET')
      expect(response.body.data[0]).toHaveProperty('statusCode', 200)
      expect(response.body.data[0]).toHaveProperty('responseTime', 150)
      expect(response.body.data[1]).toHaveProperty('endpoint', '/api/v1/states')
    })

    it('should return empty array when no usage data exists', async () => {
      const response = await request(app)
        .get('/api/v1/usage/recent')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toEqual([])
    })

    it('should reject request without authentication', async () => {
      const response = await request(app)
        .get('/api/v1/usage/recent')
        .expect(401)

      expect(response.body.success).toBe(false)
    })
  })
})