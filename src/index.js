require('dotenv').config()
const app = require('./app')
const { bootstrapAdmin } = require('./lib/adminBootstrap')

const PORT = process.env.PORT || 3000

const startServer = async () => {
  await bootstrapAdmin()

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`)
  })
}

startServer().catch((error) => {
  console.error('Failed to start server:', error)
  process.exit(1)
})

