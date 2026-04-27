const express = require('express')
const prisma  = require('../lib/prisma')
const router  = express.Router()

const { AppError } = require('../utils/errorHandler')
const { cached } = require('../lib/redis')


// GET /api/v1/states
// Returns all states (cached)
router.get('/', async (req, res, next) => {
  try {
    const states = await cached(
      'states:all',
      async () => {
        return prisma.state.findMany({
          orderBy: { name: 'asc' },
          select: {
            id: true,
            name: true,
            code: true,
            _count: { select: { districts: true } }
          }
        })
      },
      86400 // 24 hours
    )

    res.json({
      success: true,
      count: states.length,
      data: states
    })

  } catch (error) {
    next(error) // ✅ centralized error handling
  }
})


// GET /api/v1/states/:id
// Returns one state by ID
router.get('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id)

    if (isNaN(id)) {
      throw new AppError('Invalid state ID', 400)
    }

    const state = await prisma.state.findUnique({
      where: { id },
      include: {
        _count: { select: { districts: true } }
      }
    })

    if (!state) {
      throw new AppError('State not found', 404)
    }

    res.json({
      success: true,
      data: state
    })

  } catch (error) {
    next(error) // ✅ consistent
  }
})

module.exports = router