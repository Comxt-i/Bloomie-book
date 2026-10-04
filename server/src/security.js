export function createAuthRateLimiter({ limit = 20, windowMs = 15 * 60 * 1000, now = Date.now } = {}) {
  const attempts = new Map()
  return (req, res, next) => {
    const time = now()
    const key = req.ip || req.socket.remoteAddress || 'unknown'
    let entry = attempts.get(key)
    if (!entry || entry.resetAt <= time) {
      entry = { count: 0, resetAt: time + windowMs }
      attempts.set(key, entry)
    }
    if (entry.count >= limit) {
      res.set('Retry-After', String(Math.max(1, Math.ceil((entry.resetAt - time) / 1000))))
      return res.status(429).json({ message: 'ลองเข้าสู่ระบบหรือสมัครใหม่อีกครั้งในภายหลัง' })
    }
    entry.count += 1
    // Bound memory even if many different addresses hit the public endpoint.
    if (attempts.size > 10000) attempts.delete(attempts.keys().next().value)
    next()
  }
}
