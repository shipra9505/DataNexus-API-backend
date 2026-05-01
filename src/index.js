const express = require('express')
const cors    = require('cors')
require('dotenv').config()

const statesRouter       = require('./routes/states')
const districtsRouter    = require('./routes/districts')
const subdistrictsRouter = require('./routes/subdistricts')
const villagesRouter     = require('./routes/villages')
const searchRouter       = require('./routes/search')
const { rateLimit }      = require('./middleware/rateLimit')  

const app  = express()
const PORT = process.env.PORT || 3000

app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'X-API-Key', 'Authorization']
}))
app.use(express.json())

// Health check
app.get('/', (req, res) => {
  res.json({ success: true, message: 'Bluestock Village API is running!', version: 'v1' })
})

// Routes — each with rate limiting applied
app.use('/api/v1/states',       rateLimit('FREE'), statesRouter)       // ← updated
app.use('/api/v1/districts',    rateLimit('FREE'), districtsRouter)    // ← updated
app.use('/api/v1/subdistricts', rateLimit('FREE'), subdistrictsRouter) // ← updated
app.use('/api/v1/villages',     rateLimit('FREE'), villagesRouter)     // ← updated
app.use('/api/v1/search',       rateLimit('FREE'), searchRouter)       // ← updated

const { handleError } = require('./utils/errorHandler')

// GLOBAL ERROR HANDLER (must be last)
app.use((err, req, res, next) => {
  handleError(res, err)
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})

