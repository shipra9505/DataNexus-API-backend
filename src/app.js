require('dotenv').config()

const express = require('express')
const cors = require('cors')
const swaggerUi = require('swagger-ui-express')
const swaggerSpec = require('./swagger')

const statesRouter = require('./routes/states')
const districtsRouter = require('./routes/districts')
const subdistrictsRouter = require('./routes/subdistricts')
const villagesRouter = require('./routes/villages')
const searchRouter = require('./routes/search')
const authRouter = require('./routes/auth')
const adminRouter = require('./routes/admin')
const usageRouter = require('./routes/usage')

const { rateLimit } = require('./middleware/rateLimit')
const { requireApiKey } = require('./middleware/auth')
const { requestLogger } = require('./middleware/logger')
const { handleError } = require('./utils/errorHandler')
const { getRequiredEnv } = require('./lib/env')

// Environment validation for startup
getRequiredEnv('DATABASE_URL')
getRequiredEnv('JWT_SECRET')

const app = express()

app.disable('x-powered-by')

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'https://data-nexus-demo-app.vercel.app',
  process.env.FRONTEND_URL,
  process.env.DEMO_APP_URL,
  process.env.ADMIN_DASHBOARD_URL
].filter(Boolean)

// CORS Configuration
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (Postman, mobile apps, curl, etc.)
    if (!origin) return callback(null, true)

    if (allowedOrigins.includes(origin)) {
      return callback(null, true)
    }

    return callback(new Error('CORS not allowed for this origin'))
  },

  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],

  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-API-Key',
    'X-2FA-Code'
  ],

  credentials: true
}))

// Handle preflight requests
app.options(/.*/, cors())

app.use(express.json())

app.use(requestLogger)

// Health check route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Bluestock Village API is running!',
    version: 'v1'
  })
})

// Public routes — no API key required
app.use('/api/v1/auth', authRouter)
app.use('/api/v1/admin', adminRouter)
app.use('/api/v1/usage', usageRouter)
app.use('/api/v1/search', searchRouter)

// Protected routes — API key required
app.use(
  '/api/v1/states',
  requireApiKey,
  rateLimit(),
  statesRouter
)

app.use(
  '/api/v1/districts',
  requireApiKey,
  rateLimit(),
  districtsRouter
)

app.use(
  '/api/v1/subdistricts',
  requireApiKey,
  rateLimit(),
  subdistrictsRouter
)

app.use(
  '/api/v1/villages',
  requireApiKey,
  rateLimit(),
  villagesRouter
)

// Swagger docs
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec)
)

app.get('/openapi.json', (req, res) => {
  res.json(swaggerSpec)
})

// Global error handler
app.use((err, req, res, next) => {
  console.error(err)

  handleError(res, err)
})

module.exports = app