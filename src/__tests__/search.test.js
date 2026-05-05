const request = require('supertest')
const app = require('../app')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

describe('Search API', () => {
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

    // Create test data
    const country = await prisma.country.create({
      data: { name: `TestCountry_${Date.now()}`, code: `TC${Date.now()}` }
    })

    const state = await prisma.state.create({
      data: { name: 'Maharashtra', code: 'MH', countryId: country.id }
    })

    const district = await prisma.district.create({
      data: {
        name: 'Pune',
        code: 'PU',
        stateId: state.id
      }
    })

    const subDistrict = await prisma.subDistrict.create({
      data: {
        name: 'Pune City',
        code: 'PC',
        districtId: district.id
      }
    })

    await prisma.village.createMany({
      data: [
        { name: 'Manibeli', code: '123456', subDistrictId: subDistrict.id },
        { name: 'Manjri', code: '123457', subDistrictId: subDistrict.id },
        { name: 'Kothrud', code: '123458', subDistrictId: subDistrict.id },
        { name: 'Aundh', code: '123459', subDistrictId: subDistrict.id }
      ]
    })
  })

  describe('GET /api/v1/search', () => {
    it('should search villages by name', async () => {
      const response = await request(app)
        .get('/api/v1/search?q=man')
        .set('X-API-Key', apiKey)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.count).toBeGreaterThan(0)
      expect(Array.isArray(response.body.data)).toBe(true)

      // Check structure
      const firstResult = response.body.data[0]
      expect(firstResult).toHaveProperty('value')
      expect(firstResult).toHaveProperty('label')
      expect(firstResult).toHaveProperty('code')
      expect(firstResult).toHaveProperty('fullAddress')
      expect(firstResult).toHaveProperty('hierarchy')
      expect(firstResult.hierarchy).toHaveProperty('village')
      expect(firstResult.hierarchy).toHaveProperty('subDistrict')
      expect(firstResult.hierarchy).toHaveProperty('district')
      expect(firstResult.hierarchy).toHaveProperty('state')
    })

    it('should filter by stateId', async () => {
      const state = await prisma.state.findFirst({ where: { name: 'Maharashtra' } })

      const response = await request(app)
        .get(`/api/v1/search?q=man&stateId=${state.id}`)
        .set('X-API-Key', apiKey)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.count).toBeGreaterThan(0)

      // All results should be from Maharashtra
      response.body.data.forEach(result => {
        expect(result.hierarchy.state).toBe('Maharashtra')
      })
    })

    it('should filter by districtId', async () => {
      const district = await prisma.district.findFirst({ where: { name: 'Pune' } })

      const response = await request(app)
        .get(`/api/v1/search?q=man&districtId=${district.id}`)
        .set('X-API-Key', apiKey)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.count).toBeGreaterThan(0)

      // All results should be from Pune district
      response.body.data.forEach(result => {
        expect(result.hierarchy.district).toBe('Pune')
      })
    })

    it('should respect limit parameter', async () => {
      const response = await request(app)
        .get('/api/v1/search?q=man&limit=2')
        .set('X-API-Key', apiKey)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.count).toBeLessThanOrEqual(2)
    })

    it('should return empty results for short query', async () => {
      const response = await request(app)
        .get('/api/v1/search?q=m')
        .set('X-API-Key', apiKey)
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toContain('at least 2 characters')
    })

    it('should return empty results for no matches', async () => {
      const response = await request(app)
        .get('/api/v1/search?q=nonexistentvillage')
        .set('X-API-Key', apiKey)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.count).toBe(0)
      expect(response.body.data).toEqual([])
    })

    it('should validate stateId parameter', async () => {
      const response = await request(app)
        .get('/api/v1/search?q=man&stateId=invalid')
        .set('X-API-Key', apiKey)
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('Invalid stateId')
    })

    it('should validate districtId parameter', async () => {
      const response = await request(app)
        .get('/api/v1/search?q=man&districtId=invalid')
        .set('X-API-Key', apiKey)
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('Invalid districtId')
    })

    it('should reject request without API key', async () => {
      const response = await request(app)
        .get('/api/v1/search?q=man')
        .expect(401)

      expect(response.body.success).toBe(false)
    })
  })

  describe('GET /api/v1/search/autocomplete', () => {
    it('should return autocomplete suggestions', async () => {
      const response = await request(app)
        .get('/api/v1/search/autocomplete?q=man')
        .set('X-API-Key', apiKey)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(Array.isArray(response.body.data)).toBe(true)

      if (response.body.count > 0) {
        const firstResult = response.body.data[0]
        expect(firstResult).toHaveProperty('value')
        expect(firstResult).toHaveProperty('label')
        expect(firstResult).toHaveProperty('code')
        expect(firstResult).toHaveProperty('address')
      }
    })

    it('should return empty results for short query', async () => {
      const response = await request(app)
        .get('/api/v1/search/autocomplete?q=m')
        .set('X-API-Key', apiKey)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.count).toBe(0)
      expect(response.body.data).toEqual([])
    })

    it('should limit results to 10', async () => {
      // Create more villages for testing
      const subDistrict = await prisma.subDistrict.findFirst()
      const villages = []
      for (let i = 0; i < 15; i++) {
        villages.push({
          name: `ManVillage${i}`,
          code: `123${i.toString().padStart(3, '0')}`,
          subDistrictId: subDistrict.id
        })
      }
      await prisma.village.createMany({ data: villages })

      const response = await request(app)
        .get('/api/v1/search/autocomplete?q=man')
        .set('X-API-Key', apiKey)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.count).toBeLessThanOrEqual(10)
    })
  })
})