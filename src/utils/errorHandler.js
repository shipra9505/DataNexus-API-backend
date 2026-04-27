// utils/errorHandler.js

class AppError extends Error {
  constructor(message, statusCode) {
    super(message)
    this.statusCode = statusCode
    this.isOperational = true
  }
}

const handleError = (res, error) => {
  console.error('API Error:', error)

  // Known (expected) errors
  if (error.isOperational) {
    return res.status(error.statusCode).json({
      success: false,
      error: error.message
    })
  }

  // Prisma errors (optional but useful)
  if (error.code && typeof error.code === 'string' && error.code.startsWith('P')) {
    return res.status(500).json({
      success: false,
      error: 'Database error'
    })
  }

  // Unknown errors
  return res.status(500).json({
    success: false,
    error: 'Internal Server Error'
  })
}

module.exports = { AppError, handleError }