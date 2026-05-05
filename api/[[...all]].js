const app = require('../src/app')
const { bootstrapAdmin } = require('../src/lib/adminBootstrap')

let initialized = false

const ensureInitialized = async () => {
  if (initialized) {
    return
  }

  await bootstrapAdmin()
  initialized = true
}

module.exports = async (req, res) => {
  if (typeof req.url === 'string' && req.url.startsWith('/api')) {
    req.url = req.url.replace(/^\/api/, '') || '/'
  }

  try {
    await ensureInitialized()
  } catch (error) {
    console.error('Initialization failed:', error)
    res.statusCode = 500
    res.end('Server initialization failed')
    return
  }

  app(req, res)
}
