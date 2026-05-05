const express = require('express')
const prisma  = require('../lib/prisma')
const router  = express.Router()
const { AppError } = require('../utils/errorHandler')

// GET /api/v1/villages?subDistrictId=45&page=1&limit=20
router.get('/', async (req, res, next) => {
  try {
    const { subDistrictId } = req.query
    const page  = parseInt(req.query.page)  || 1
    const limit = parseInt(req.query.limit) || 20
    const skip  = (page - 1) * limit

    if (!subDistrictId) {
      throw new AppError(
        'subDistrictId query param is required. Example: /villages?subDistrictId=45',
        400
      )
    }

    const where = { subDistrictId: parseInt(subDistrictId) }

    if (req.demoMode) {
      where.subDistrict = { district: { state: { name: req.demoStateName } } }
    }

    const [villages, total] = await Promise.all([
      prisma.village.findMany({
        where,
        skip,
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
      }),
      prisma.village.count({ where })
    ])

    res.json({
      success: true,
      count: villages.length,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      data: villages
    })

  } catch (error) {
    next(error) // ✅ correct
  }
})


// GET /api/v1/villages/:id
router.get('/:id', async (req, res, next) => {
  try {
    const village = await prisma.village.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        subDistrict: {
          include: {
            district: {
              include: {
                state: { include: { country: true } }
              }
            }
          }
        }
      }
    })

    if (!village) {
      throw new AppError('Village not found', 404)
    }

    if (req.demoMode && village.subDistrict.district.state.name !== req.demoStateName) {
      throw new AppError('Demo API key only grants access to Maharashtra villages', 403)
    }

    res.json({
      success: true,
      data: {
        value: village.id, // ✅ FIXED
        label: village.name,
        fullAddress: `${village.name}, ${village.subDistrict.name}, ${village.subDistrict.district.name}, ${village.subDistrict.district.state.name}, India`,
        hierarchy: {
          village: village.name,
          subDistrict: village.subDistrict.name,
          district: village.subDistrict.district.name,
          state: village.subDistrict.district.state.name,
          country: 'India'
        }
      }
    })

  } catch (error) {
    next(error) // ✅ consistent
  }
})

module.exports = router