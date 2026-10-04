import test from 'node:test'
import assert from 'node:assert/strict'
import { validateProductionConfig } from '../src/config.js'
import { PostgresStore } from '../src/store.js'

const valid = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://reader:password@db:5432/punaan',
  JWT_SECRET: 'a-unique-secret-with-more-than-32-characters',
  CLIENT_ORIGIN: 'https://books.example.com',
}

test('production requires a durable database, a strong secret, and an HTTPS origin', () => {
  assert.doesNotThrow(() => validateProductionConfig(valid))
  assert.throws(() => validateProductionConfig({ ...valid, DATABASE_URL: '' }), /DATABASE_URL/)
  assert.throws(() => validateProductionConfig({ ...valid, DATABASE_URL: 'sqlite:memory' }), /PostgreSQL URL/)
  assert.throws(() => validateProductionConfig({ ...valid, DATABASE_URL: 'postgresql://reader:REPLACE_WITH_RANDOM_HEX@db/punaan' }), /Replace the example/)
  assert.throws(() => validateProductionConfig({ ...valid, JWT_SECRET: 'short' }), /JWT_SECRET/)
  assert.throws(() => validateProductionConfig({ ...valid, CLIENT_ORIGIN: 'http://books.example.com' }), /HTTPS origin/)
  assert.throws(() => validateProductionConfig({ ...valid, CLIENT_ORIGIN: 'https://books.example.com/path' }), /HTTPS origin/)
  assert.doesNotThrow(() => validateProductionConfig({ NODE_ENV: 'development' }))
})

test('external PostgreSQL connections verify TLS and reject URL options that override it', async () => {
  const store = new PostgresStore('postgresql://reader:password@db.example.com:5432/punaan')
  assert.deepEqual(store.pool.options.ssl, { rejectUnauthorized: true, servername: 'db.example.com' })
  await store.pool.end()
  assert.throws(() => new PostgresStore('postgresql://reader:password@db.example.com/punaan?sslmode=require'), /Remove sslmode/)
})
