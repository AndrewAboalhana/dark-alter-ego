-- Add host-controlled timer to rooms
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS timer_seconds integer DEFAULT 30;

-- Verify
SELECT id, code, timer_seconds FROM rooms LIMIT 5;
