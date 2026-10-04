import test from 'node:test'
import assert from 'node:assert/strict'
import { createAuthRateLimiter } from '../src/security.js'

test('auth limiter blocks repeated requests and resets after the window', () => {
  let time = 0
  const limiter = createAuthRateLimiter({ limit: 2, windowMs: 1000, now: () => time })
  const req = { ip: '192.0.2.1' }
  const result = { status: 0, retryAfter: '' }
  const res = {
    set: (_name, value) => { result.retryAfter = value; return res },
    status: (code) => { result.status = code; return res },
    json: () => res,
  }
  let passed = 0
  const next = () => { passed += 1 }
  limiter(req, res, next)
  limiter(req, res, next)
  assert.equal(passed, 2)
  limiter(req, res, next)
  assert.equal(result.status, 429)
  assert.equal(result.retryAfter, '1')
  time = 1000
  limiter(req, res, next)
  assert.equal(passed, 3)
})
