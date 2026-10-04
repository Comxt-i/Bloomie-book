CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  education_level TEXT NOT NULL,
  interests TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'อื่น ๆ',
  education_level TEXT NOT NULL,
  condition TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'AVAILABLE'
    CHECK (status IN ('AVAILABLE', 'RESERVED', 'EXCHANGED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Preserve the original subject of existing books while introducing broad shelves.
ALTER TABLE books ADD COLUMN IF NOT EXISTS category TEXT;
UPDATE books SET category = CASE
  WHEN subject IN ('คณิตศาสตร์', 'ภาษาอังกฤษ', 'ชีววิทยา', 'เคมี', 'ฟิสิกส์', 'TGAT') THEN 'การเรียนและสอบ'
  WHEN subject IN ('นิยายและวรรณกรรม', 'การ์ตูนและมังงะ', 'ความรู้และพัฒนาตนเอง', 'การเรียนและสอบ', 'ธุรกิจและการเงิน', 'เด็กและเยาวชน') THEN subject
  ELSE 'อื่น ๆ'
END WHERE category IS NULL;
ALTER TABLE books ALTER COLUMN category SET DEFAULT 'อื่น ๆ';
ALTER TABLE books ALTER COLUMN category SET NOT NULL;

CREATE TABLE IF NOT EXISTS book_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  preference TEXT NOT NULL CHECK (preference IN ('LIKE', 'DISLIKE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, book_id)
);

CREATE TABLE IF NOT EXISTS exchange_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  offered_book_id UUID NOT NULL REFERENCES books(id),
  requested_book_id UUID NOT NULL REFERENCES books(id),
  message TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'COMPLETED', 'CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (offered_book_id <> requested_book_id)
);

CREATE INDEX IF NOT EXISTS idx_books_owner ON books(owner_id);
CREATE INDEX IF NOT EXISTS idx_books_status ON books(status);
CREATE INDEX IF NOT EXISTS idx_books_category ON books(category);
CREATE INDEX IF NOT EXISTS idx_requests_requester ON exchange_requests(requester_id);
