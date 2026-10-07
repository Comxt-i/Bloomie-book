-- Additive migration: preserve legacy exchanges and ownership records.
ALTER TABLE users ADD COLUMN IF NOT EXISTS search_location JSONB;
ALTER TABLE books DROP CONSTRAINT IF EXISTS books_status_check;
ALTER TABLE books ADD CONSTRAINT books_status_check CHECK (status IN ('AVAILABLE', 'RESERVED', 'ON_LOAN', 'EXCHANGED'));
ALTER TABLE exchange_requests DROP CONSTRAINT IF EXISTS exchange_requests_status_check;
ALTER TABLE exchange_requests ADD CONSTRAINT exchange_requests_status_check CHECK (status IN ('PENDING', 'ACCEPTED', 'ACTIVE', 'REJECTED', 'COMPLETED', 'CANCELLED'));
ALTER TABLE exchange_requests ADD COLUMN IF NOT EXISTS loan_days INTEGER NOT NULL DEFAULT 14 CHECK (loan_days BETWEEN 1 AND 60);
ALTER TABLE exchange_requests ADD COLUMN IF NOT EXISTS meeting_place TEXT NOT NULL DEFAULT '';
ALTER TABLE exchange_requests ADD COLUMN IF NOT EXISTS meeting_at TIMESTAMPTZ;
ALTER TABLE exchange_requests ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ;
ALTER TABLE exchange_requests ADD COLUMN IF NOT EXISTS received_by JSONB NOT NULL DEFAULT '[]';
ALTER TABLE exchange_requests ADD COLUMN IF NOT EXISTS returned_by JSONB NOT NULL DEFAULT '[]';
ALTER TABLE exchange_requests ADD COLUMN IF NOT EXISTS cancel_by JSONB NOT NULL DEFAULT '[]';
ALTER TABLE exchange_requests ADD COLUMN IF NOT EXISTS issue_report JSONB;
ALTER TABLE exchange_requests ADD COLUMN IF NOT EXISTS issue_resolution JSONB;
CREATE TABLE IF NOT EXISTS swipe_events (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id UUID NOT NULL REFERENCES users(id),
 book_id UUID NOT NULL REFERENCES books(id),
 subject_match INTEGER NOT NULL,
 level_match INTEGER NOT NULL,
 distance_km DOUBLE PRECISION,
 label INTEGER NOT NULL CHECK (label IN (0,1)),
 source TEXT NOT NULL DEFAULT 'DISCOVERY' CHECK (source IN ('DISCOVERY', 'CATALOG')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE swipe_events ALTER COLUMN distance_km DROP NOT NULL;
ALTER TABLE swipe_events ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'DISCOVERY' CHECK (source IN ('DISCOVERY', 'CATALOG'));
CREATE TABLE IF NOT EXISTS conversations (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 first_user_id UUID NOT NULL REFERENCES users(id),
 second_user_id UUID NOT NULL REFERENCES users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(first_user_id, second_user_id),
 CHECK(first_user_id < second_user_id)
);
CREATE TABLE IF NOT EXISTS chat_messages (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 conversation_id UUID NOT NULL REFERENCES conversations(id),
 sender_id UUID NOT NULL REFERENCES users(id),
 body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON chat_messages(conversation_id, created_at);
