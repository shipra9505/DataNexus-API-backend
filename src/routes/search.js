const express = require('express')
const prisma  = require('../lib/prisma')
const router  = express.Router()

const { AppError } = require('../utils/errorHandler')

// Utility
const isValidInt = (val) => {
  const num = parseInt(val)
  return !isNaN(num) && num >= 0
}


// GET /api/v1/search?q=manibeli
router.get('/', async (req, res, next) => {
  try {
    const { q, stateId, districtId } = req.query
    const limit = Math.min(parseInt(req.query.limit) || 10, 50)

    // ✅ Validation
    if (!q || q.trim().length < 2) {
      throw new AppError('Query must be at least 2 characters', 400)
    }

    if (stateId && !isValidInt(stateId)) {
      throw new AppError('Invalid stateId', 400)
    }

    if (districtId && !isValidInt(districtId)) {
      throw new AppError('Invalid districtId', 400)
    }

    const where = {
      name: { contains: q.trim(), mode: 'insensitive' },
    }

    if (districtId) {
      where.subDistrict = { districtId: parseInt(districtId) }
    } else if (stateId) {
      where.subDistrict = { district: { stateId: parseInt(stateId) } }
    }

    if (req.demoMode) {
      where.subDistrict = {
        ...where.subDistrict,
        district: {
          ...((where.subDistrict && where.subDistrict.district) || {}),
          state: { name: req.demoStateName }
        }
      }
    }

    const villages = await prisma.village.findMany({
      where,
      take: limit,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        code: true,
        subDistrict: {
          select: {
            name: true,
            district: {
              select: {
                name: true,
                state: { select: { name: true } }
              }
            }
          }
        }
      }
    })

    const formatted = villages.map(v => ({
      value: v.id,
      label: v.name,
      code: v.code,
      fullAddress: `${v.name}, ${v.subDistrict.name}, ${v.subDistrict.district.name}, ${v.subDistrict.district.state.name}, India`,
      hierarchy: {
        village: v.name,
        subDistrict: v.subDistrict.name,
        district: v.subDistrict.district.name,
        state: v.subDistrict.district.state.name,
      }
    }))

    res.json({
      success: true,
      count: formatted.length,
      data: formatted
    })

  } catch (error) {
    next(error) // ✅ ONLY THIS
  }
})


// GET /api/v1/search/autocomplete?q=man
router.get('/autocomplete', async (req, res, next) => {
  try {
    const { q } = req.query

    if (!q || q.trim().length < 2) {
      return res.json({ success: true, count: 0, data: [] })
    }

    const villages = await prisma.village.findMany({
      where: {
        name: { startsWith: q.trim(), mode: 'insensitive' },
        ...(req.demoMode && {
          subDistrict: { district: { state: { name: req.demoStateName } } }
        })
      },
      take: 10,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        code: true,
        subDistrict: {
          select: {
            name: true,
            district: {
              select: {
                name: true,
                state: { select: { name: true } }
              }
            }
          }
        }
      }
    })

    const data = villages.map(v => ({
      value: v.id,
      label: v.name,
      code: v.code,
      address: `${v.subDistrict.name}, ${v.subDistrict.district.name}, ${v.subDistrict.district.state.name}`
    }))

    res.json({
      success: true,
      count: data.length,
      data
    })

  } catch (error) {
    next(error) // ✅ ONLY THIS
  }
})

module.exports = router