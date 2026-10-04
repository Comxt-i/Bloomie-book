export function validateProductionConfig(env) {
  if (env.NODE_ENV !== 'production') return
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required in production')
  let database
  try { database = new URL(env.DATABASE_URL) }
  catch {
    throw new Error('DATABASE_URL must be a PostgreSQL URL in production')
  }
  if (!['postgres:', 'postgresql:'].includes(database.protocol) || !database.hostname) {
    throw new Error('DATABASE_URL must be a PostgreSQL URL in production')
  }
  if (database.password.startsWith('REPLACE_')) throw new Error('Replace the example PostgreSQL password before deployment')
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32 || env.JWT_SECRET === 'change-this-before-production') {
    throw new Error('A unique JWT_SECRET of at least 32 characters is required in production')
  }
  try {
    const origin = new URL(env.CLIENT_ORIGIN)
    if (origin.protocol !== 'https:' || origin.origin !== env.CLIENT_ORIGIN) throw new Error('Invalid origin')
  } catch {
    throw new Error('CLIENT_ORIGIN must be an HTTPS origin in production')
  }
}
