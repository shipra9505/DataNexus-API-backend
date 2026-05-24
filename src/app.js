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
  process.env.FRONTEND_URL,
  process.env.DEMO_APP_URL,
  process.env.ADMIN_DASHBOARD_URL
].filter(Boolean)

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: [
    'Content-Type',
    'X-API-Key',
    'X-2FA-Code',
    'Authorization'
  ]
}))

app.use(express.json())
app.use(requestLogger)

app.get('/', (req, res) => {
  res.json({ success: true, message: 'Bluestock Village API is running!', version: 'v1' })
})

app.use('/api/v1/auth', authRouter)
app.use('/api/v1/admin', adminRouter)
app.use('/api/v1/usage', usageRouter)
app.use('/api/v1/states', requireApiKey, rateLimit(), statesRouter)
app.use('/api/v1/districts', requireApiKey, rateLimit(), districtsRouter)
app.use('/api/v1/subdistricts', requireApiKey, rateLimit(), subdistrictsRouter)
app.use('/api/v1/villages', requireApiKey, rateLimit(), villagesRouter)
app.use('/api/v1/search', requireApiKey, rateLimit(), searchRouter)
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))
app.get('/openapi.json', (req, res) => res.json(swaggerSpec))

app.use((err, req, res, next) => {
  handleError(res, err)
})

module.exports = app
