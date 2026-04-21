-- Neon-compatible schema for GrindFlow (post Supabase migration)
-- Run this in the Neon SQL Editor.
--
-- Changes vs Supabase version:
--  - Removed REFERENCES auth.users (Clerk manages users, not Postgres)
--  - user_id / created_by columns switched from UUID to TEXT (Clerk IDs like "user_2abc...")
--  - All RLS policies dropped (authorization now handled in app code via Clerk)

-- 0. user_profiles
CREATE TABLE IF NOT EXISTS user_profiles (
  id TEXT PRIMARY KEY,                -- Clerk user ID
  username TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON user_profiles(username);

-- 1. chatrooms
CREATE TABLE IF NOT EXISTS chatrooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  is_private BOOLEAN DEFAULT false,
  created_by TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. chatroom_members
CREATE TABLE IF NOT EXISTS chatroom_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chatroom_id UUID NOT NULL REFERENCES chatrooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(chatroom_id, user_id)
);

-- 3. chat_messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chatroom_id TEXT NOT NULL,          -- TEXT to support 'public' plus UUID values
  user_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. indexes
CREATE INDEX IF NOT EXISTS idx_chat_messages_chatroom ON chat_messages(chatroom_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chatroom_members_chatroom ON chatroom_members(chatroom_id);
CREATE INDEX IF NOT EXISTS idx_chatroom_members_user ON chatroom_members(user_id);
CREATE INDEX IF NOT EXISTS idx_chatrooms_created_by ON chatrooms(created_by);

-- 5. notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'mention',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  related_message_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
