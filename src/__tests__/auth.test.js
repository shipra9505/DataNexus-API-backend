const request = require('supertest')
const app = require('../app')
const { PrismaClient } = require('@prisma/client')

let prisma

describe('Auth API', () => {
  let testUser
  let authToken

  beforeAll(() => {
    prisma = global.prisma || new PrismaClient()
  })

  afterAll(async () => {
    if (!global.prisma && prisma) {
      await prisma.$disconnect()
    }
  })

  beforeEach(async () => {
    // Clean up before each test in dependency order to avoid foreign key constraints
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
  })

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user successfully', async () => {
      const uniqueId = Date.now() + Math.random()
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          businessName: 'New Business',
          email: `new${uniqueId}@example.com`,
          password: 'password123'
        })
        .expect(201)

      expect(response.body.success).toBe(true)
      expect(response.body.data.user.email).toBe(`new${uniqueId}@example.com`)
      expect(response.body.data.user.businessName).toBe('New Business')
      expect(response.body.data.token).toBeDefined()
    })

    it('should reject registration with existing email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          businessName: 'Test Business',
          email: testUser.email,
          password: 'password123'
        })
        .expect(409)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toContain('already registered')
    })

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'invalid',
          password: 'short'
        })
        .expect(400)

      expect(response.body.success).toBe(false)
    })
  })

  describe('POST /api/v1/auth/login', () => {
    it('should login successfully with correct credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'password'
        })
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.user.email).toBe(testUser.email)
      expect(response.body.data.token).toBeDefined()

      authToken = response.body.data.token
    })

    it('should reject login with wrong password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword'
        })
        .expect(401)

      expect(response.body.success).toBe(false)
    })

    it('should reject login with non-existent email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password'
        })
        .expect(401)

      expect(response.body.success).toBe(false)
    })
  })

  describe('GET /api/v1/auth/me', () => {
    beforeEach(async () => {
      // Login to get token
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'password'
        })
      authToken = response.body.data.token
    })

    it('should return current user with valid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.email).toBe(testUser.email)
      expect(response.body.data.passwordHash).toBeUndefined()
    })

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .expect(401)

      expect(response.body.success).toBe(false)
    })

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401)

      expect(response.body.success).toBe(false)
    })
  })

  describe('API Keys', () => {
    beforeEach(async () => {
      // Login to get token
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'password'
        })
      authToken = response.body.data.token
    })

    describe('GET /api/v1/auth/apikeys', () => {
      it('should return empty array when no API keys exist', async () => {
        const response = await request(app)
          .get('/api/v1/auth/apikeys')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200)

        expect(response.body.success).toBe(true)
        expect(response.body.count).toBe(0)
        expect(response.body.data).toEqual([])
      })

      it('should return API keys when they exist', async () => {
        // Create an API key first
        await request(app)
          .post('/api/v1/auth/apikeys')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(201)

        const response = await request(app)
          .get('/api/v1/auth/apikeys')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200)

        expect(response.body.success).toBe(true)
        expect(response.body.count).toBe(1)
        expect(response.body.data[0]).toHaveProperty('id')
        expect(response.body.data[0]).toHaveProperty('status')
        expect(response.body.data[0]).toHaveProperty('createdAt')
      })
    })

    describe('POST /api/v1/auth/apikeys', () => {
      it('should create a new API key', async () => {
        const response = await request(app)
          .post('/api/v1/auth/apikeys')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(201)

        expect(response.body.success).toBe(true)
        expect(response.body.data).toHaveProperty('id')
        expect(response.body.data).toHaveProperty('status', 'ACTIVE')
        expect(response.body.data).toHaveProperty('createdAt')
        expect(response.body).toHaveProperty('apiKey')
        expect(typeof response.body.apiKey).toBe('string')
        expect(response.body.apiKey).toMatch(/^ak_[0-9a-f]{32}$/)
      })

      it('should limit API keys to 5 per user', async () => {
        // Create 5 API keys
        for (let i = 0; i < 5; i++) {
          await request(app)
            .post('/api/v1/auth/apikeys')
            .set('Authorization', `Bearer ${authToken}`)
            .expect(201)
        }

        // Try to create a 6th
        const response = await request(app)
          .post('/api/v1/auth/apikeys')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(403)

        expect(response.body.success).toBe(false)
        expect(response.body.error).toContain('Maximum of 5 API keys')
      })
    })

    describe('PATCH /api/v1/auth/apikeys/:id/revoke', () => {
      let apiKeyId

      beforeEach(async () => {
        const response = await request(app)
          .post('/api/v1/auth/apikeys')
          .set('Authorization', `Bearer ${authToken}`)
        apiKeyId = response.body.data.id
      })

      it('should revoke an API key', async () => {
        const response = await request(app)
          .patch(`/api/v1/auth/apikeys/${apiKeyId}/revoke`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200)

        expect(response.body.success).toBe(true)
        expect(response.body.data.status).toBe('REVOKED')
      })

      it('should reject revoking non-existent API key', async () => {
        const response = await request(app)
          .patch('/api/v1/auth/apikeys/99999/revoke')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404)

        expect(response.body.success).toBe(false)
      })

      it('should reject revoking already revoked API key', async () => {
        // Revoke first
        await request(app)
          .patch(`/api/v1/auth/apikeys/${apiKeyId}/revoke`)
          .set('Authorization', `Bearer ${authToken}`)

        // Try to revoke again
        const response = await request(app)
          .patch(`/api/v1/auth/apikeys/${apiKeyId}/revoke`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(400)

        expect(response.body.success).toBe(false)
        expect(response.body.error).toContain('already revoked')
      })
    })

    describe('PATCH /api/v1/auth/apikeys/:id/rotate', () => {
      let apiKeyId

      beforeEach(async () => {
        const response = await request(app)
          .post('/api/v1/auth/apikeys')
          .set('Authorization', `Bearer ${authToken}`)
        apiKeyId = response.body.data.id
      })

      it('should rotate an API key', async () => {
        const response = await request(app)
          .patch(`/api/v1/auth/apikeys/${apiKeyId}/rotate`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200)

        expect(response.body.success).toBe(true)
        expect(response.body.data).toHaveProperty('id')
        expect(response.body.data.status).toBe('ACTIVE')
        expect(response.body).toHaveProperty('apiKey')
        expect(typeof response.body.apiKey).toBe('string')
      })

      it('should reject rotating revoked API key', async () => {
        // Revoke first
        await request(app)
          .patch(`/api/v1/auth/apikeys/${apiKeyId}/revoke`)
          .set('Authorization', `Bearer ${authToken}`)

        // Try to rotate
        const response = await request(app)
          .patch(`/api/v1/auth/apikeys/${apiKeyId}/rotate`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(400)

        expect(response.body.success).toBe(false)
        expect(response.body.error).toContain('Only active API keys can be rotated')
      })
    })
  })
})