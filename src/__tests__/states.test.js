const request = require('supertest')
const app = require('../app')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

describe('States API', () => {
  let apiKey

  beforeEach(async () => {
    // Clean up before each test
    await prisma.village.deleteMany({})
    await prisma.subDistrict.deleteMany({})
    await prisma.district.deleteMany({})
    await prisma.state.deleteMany({})
    await prisma.country.deleteMany({})
    await prisma.apiKey.deleteMany({})
    await prisma.usage.deleteMany({})
    await prisma.user.deleteMany({})

    // Create test user and API key
    const user = await prisma.user.create({
      data: {
        businessName: 'Test Business',
        email: 'test@example.com',
        passwordHash: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // 'password'
        plan: 'FREE',
        status: 'ACTIVE',
        dailyLimit: 5000,
        emailVerified: true
      }
    })

    const keyValue = 'ak_1234567890abcdef1234567890abcdef'
    const fingerprint = require('crypto').createHash('sha256').update(keyValue).digest('hex')
    const secretHash = await require('bcryptjs').hash(keyValue, 10)

    const apiKeyRecord = await prisma.apiKey.create({
      data: {
        fingerprint,
        secretHash,
        userId: user.id,
        status: 'ACTIVE'
      }
    })

    apiKey = keyValue
  })

  describe('GET /api/v1/states', () => {
    it('should return all states', async () => {
      // Create test country first
      const testCountry = await prisma.country.create({
        data: { name: 'India', code: 'IN' }
      })

      // Create test states
      await prisma.state.createMany({
        data: [
          { name: 'Maharashtra', code: 'MH', countryId: testCountry.id },
          { name: 'Karnataka', code: 'KA', countryId: testCountry.id },
          { name: 'Tamil Nadu', code: 'TN', countryId: testCountry.id }
        ]
      })

      const response = await request(app)
        .get('/api/v1/states')
        .set('X-API-Key', apiKey)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.count).toBe(3)
      expect(Array.isArray(response.body.data)).toBe(true)
      expect(response.body.data).toHaveLength(3)

      // Check sorting by name
      expect(response.body.data[0].name).toBe('Karnataka')
      expect(response.body.data[1].name).toBe('Maharashtra')
      expect(response.body.data[2].name).toBe('Tamil Nadu')

      // Check structure
      expect(response.body.data[0]).toHaveProperty('id')
      expect(response.body.data[0]).toHaveProperty('name')
      expect(response.body.data[0]).toHaveProperty('code')
      expect(response.body.data[0]).toHaveProperty('_count')
      expect(response.body.data[0]._count).toHaveProperty('districts')
    })

    it('should return empty array when no states exist', async () => {
      const response = await request(app)
        .get('/api/v1/states')
        .set('X-API-Key', apiKey)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.count).toBe(0)
      expect(response.body.data).toEqual([])
    })

    it('should reject request without API key', async () => {
      const response = await request(app)
        .get('/api/v1/states')
        .expect(401)

      expect(response.body.success).toBe(false)
    })
  })

  describe('GET /api/v1/states/:id', () => {
    let testState

    beforeEach(async () => {
      const testCountry = await prisma.country.create({
        data: { name: `TestCountry_${Date.now()}`, code: `TC${Date.now()}` }
      })
      testState = await prisma.state.create({
        data: { name: 'Maharashtra', code: 'MH', countryId: testCountry.id }
      })
    })

    it('should return a specific state by ID', async () => {
      const response = await request(app)
        .get(`/api/v1/states/${testState.id}`)
        .set('X-API-Key', apiKey)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.id).toBe(testState.id)
      expect(response.body.data.name).toBe('Maharashtra')
      expect(response.body.data.code).toBe('MH')
      expect(response.body.data).toHaveProperty('_count')
      expect(response.body.data._count).toHaveProperty('districts')
    })

    it('should return 404 for non-existent state', async () => {
      const response = await request(app)
        .get('/api/v1/states/99999')
        .set('X-API-Key', apiKey)
        .expect(404)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('State not found')
    })

    it('should return 400 for invalid ID', async () => {
      const response = await request(app)
        .get('/api/v1/states/invalid')
        .set('X-API-Key', apiKey)
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('Invalid state ID')
    })
  })
})