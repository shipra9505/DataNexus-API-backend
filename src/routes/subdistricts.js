const express = require('express')
const prisma  = require('../lib/prisma')
const router  = express.Router()

const { AppError } = require('../utils/errorHandler')

// Utility
const isValidInt = (val) => {
  const num = parseInt(val)
  return !isNaN(num) && num >= 0
}


// GET /api/v1/subdistricts?districtId=12
router.get('/', async (req, res, next) => {
  try {
    const { districtId } = req.query

    // ✅ Validate districtId (if provided)
    if (districtId && !isValidInt(districtId)) {
      throw new AppError('Invalid districtId', 400)
    }

    const where = districtId
      ? { districtId: parseInt(districtId) }
      : {}

    const subs = await prisma.subDistrict.findMany({
      where,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        code: true,
        districtId: true,
        district: {
          select: {
            name: true,
            state: { select: { name: true } }
          }
        },
        _count: { select: { villages: true } }
      }
    })

    res.json({
      success: true,
      count: subs.length,
      data: subs
    })

  } catch (error) {
    next(error) // ✅ centralized error handling
  }
})


// GET /api/v1/subdistricts/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params

    // ✅ Validate ID
    if (!isValidInt(id)) {
      throw new AppError('Invalid sub-district ID', 400)
    }

    const sub = await prisma.subDistrict.findUnique({
      where: { id: parseInt(id) },
      include: {
        district: { include: { state: true } },
        _count: { select: { villages: true } }
      }
    })

    if (!sub) {
      throw new AppError('Sub-district not found', 404)
    }

    res.json({
      success: true,
      data: sub
    })

  } catch (error) {
    next(error) // ✅ consistent
  }
})

module.exports = router