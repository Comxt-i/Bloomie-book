// Run locally by the project owner. No public endpoint exposes training records.
import 'dotenv/config'
import { writeFile } from 'node:fs/promises'
import pg from 'pg'
if (!process.env.DATABASE_URL || !process.argv[2]) throw new Error('Usage: node src/export-swipes.js OUTPUT.json with DATABASE_URL set')
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
try {
 const { rows } = await pool.query('SELECT user_id,book_id,subject_match,level_match,distance_km,label,created_at FROM swipe_events ORDER BY created_at')
 await writeFile(process.argv[2], JSON.stringify(rows.map((r) => ({ userId:r.user_id,bookId:r.book_id,subjectMatch:r.subject_match,levelMatch:r.level_match,distanceKm:r.distance_km,label:r.label,createdAt:r.created_at })),null,2))
 console.log(`Exported ${rows.length} events without names, emails, coordinates or messages.`)
} finally { await pool.end() }
