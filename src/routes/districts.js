const express = require('express')
const prisma  = require('../lib/prisma')
const router  = express.Router()

const { AppError } = require('../utils/errorHandler')

// Simple in-memory cache
const cache = new Map()
const CACHE_TTL = 60 * 1000 // 1 minute

// Utility
const isValidInt = (val) => {
  const num = parseInt(val)
  return !isNaN(num) && num >= 0
}


// GET /api/v1/districts?stateId=5&page=1&limit=20
router.get('/', async (req, res, next) => {
  try {
    let { stateId, page = 1, limit = 20 } = req.query

    // ✅ Validation
    if (stateId && !isValidInt(stateId)) {
      throw new AppError('Invalid stateId', 400)
    }

    if (!isValidInt(page) || !isValidInt(limit)) {
      throw new AppError('Invalid pagination params', 400)
    }

    page = parseInt(page)
    limit = Math.min(parseInt(limit), 100)

    const stateIdNum = stateId ? parseInt(stateId) : undefined
    const where = stateIdNum ? { stateId: stateIdNum } : {}

    // Cache key
    const cacheKey = `districts:${stateId || 'all'}:${page}:${limit}`

    // ✅ Cache check
    if (cache.has(cacheKey)) {
      const cached = cache.get(cacheKey)
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        return res.json(cached.data)
      } else {
        cache.delete(cacheKey)
      }
    }

    const [districts, totalCount] = await Promise.all([
      prisma.district.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          code: true,
          stateId: true,
          state: { select: { name: true } },
          _count: { select: { subDistricts: true } }
        }
      }),
      prisma.district.count({ where })
    ])

    const response = {
      success: true,
      meta: {
        total: totalCount,
        count: districts.length,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit)
      },
      data: districts
    }

    // Store cache
    cache.set(cacheKey, {
      data: response,
      timestamp: Date.now()
    })

    res.json(response)

  } catch (error) {
    next(error) // ✅ ONLY THIS
  }
})


// GET /api/v1/districts/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params

    // ✅ Validate
    if (!isValidInt(id)) {
      throw new AppError('Invalid district ID', 400)
    }

    const district = await prisma.district.findUnique({
      where: { id: parseInt(id) },
      include: {
        state: true,
        _count: { select: { subDistricts: true } }
      }
    })

    if (!district) {
      throw new AppError('District not found', 404)
    }

    res.json({
      success: true,
      data: district
    })

  } catch (error) {
    next(error) // ✅ ONLY THIS
  }
})

module.exports = router