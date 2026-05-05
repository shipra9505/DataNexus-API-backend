const bcrypt = require('bcryptjs')
const prisma = require('./prisma')
const { getEnv } = require('./env')

const ADMIN_EMAIL = getEnv('ADMIN_EMAIL')
const ADMIN_PASSWORD = getEnv('ADMIN_PASSWORD')
const ADMIN_BUSINESS_NAME = getEnv('ADMIN_BUSINESS_NAME', 'Bluestock Admin')
const ADMIN_PHONE = getEnv('ADMIN_PHONE', null)
const ADMIN_GST = getEnv('ADMIN_GST', null)

const bootstrapAdmin = async () => {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.log('Admin bootstrap skipped: ADMIN_EMAIL or ADMIN_PASSWORD not provided.')
    return
  }

  const existingAdmin = await prisma.user.findFirst({
    where: {
      OR: [
        { role: 'ADMIN' },
        { role: 'SUPERADMIN' }
      ]
    }
  })

  if (existingAdmin) {
    console.log(`Admin bootstrap skipped: existing admin user found (${existingAdmin.email}).`)
    return
  }

  const existingUser = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } })
  if (existingUser) {
    console.warn(`Admin bootstrap warning: user with email ${ADMIN_EMAIL} already exists. Skipping creation.`)
    return
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10)

  const admin = await prisma.user.create({
    data: {
      businessName: ADMIN_BUSINESS_NAME,
      email: ADMIN_EMAIL,
      phone: ADMIN_PHONE,
      gst: ADMIN_GST,
      passwordHash,
      role: 'SUPERADMIN',
      plan: 'UNLIMITED',
      status: 'ACTIVE',
      dailyLimit: 1000000,
      twoFactorEnabled: false,
    }
  })

  console.log(`Admin bootstrap complete: ${admin.email} created as SUPERADMIN.`)
}

if (require.main === module) {
  bootstrapAdmin()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Admin bootstrap failed:', error)
      process.exit(1)
    })
}

module.exports = { bootstrapAdmin }
