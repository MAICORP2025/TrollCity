
-- Migration: Add is_deleted column to conversation_messages
-- Description: Adds soft delete support for messages

ALTER TABLE public.conversation_messages 
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- Optional: If we want per-user deletion later, we would need:
-- ADD COLUMN IF NOT EXISTS deleted_by_users UUID[] DEFAULT '{}';

-- For now, consistent with "soft delete" requirement (e.g., deleted_at or is_deleted):
ALTER TABLE public.conversation_messages 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
