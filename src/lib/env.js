const getRequiredEnv = (key) => {
  const value = process.env[key]
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

const getEnv = (key, fallback = undefined) => {
  return process.env[key] ?? fallback
}

const getIntEnv = (key, fallback = undefined) => {
  const value = process.env[key]
  if (value === undefined || value === null || value === '') {
    return fallback
  }

  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be an integer, got: ${value}`)
  }
  return parsed
}

module.exports = {
  getRequiredEnv,
  getEnv,
  getIntEnv,
}
