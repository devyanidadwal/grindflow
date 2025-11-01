-- Chat Database Schema for GrindFlow
-- Run this SQL in your Supabase SQL Editor

-- 1. Create chatrooms table
CREATE TABLE IF NOT EXISTS chatrooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  is_private BOOLEAN DEFAULT false,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create chatroom_members table (for private rooms)
CREATE TABLE IF NOT EXISTS chatroom_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chatroom_id UUID NOT NULL REFERENCES chatrooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(chatroom_id, user_id)
);

-- 3. Create chat_messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chatroom_id TEXT NOT NULL, -- Using TEXT to support 'public' as well as UUID
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL, -- Store email for quick display
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_chatroom ON chat_messages(chatroom_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chatroom_members_chatroom ON chatroom_members(chatroom_id);
CREATE INDEX IF NOT EXISTS idx_chatroom_members_user ON chatroom_members(user_id);
CREATE INDEX IF NOT EXISTS idx_chatrooms_created_by ON chatrooms(created_by);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE chatrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatroom_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS Policies for chatrooms
-- Anyone can see public chatrooms
CREATE POLICY "Public chatrooms are viewable by everyone"
  ON chatrooms FOR SELECT
  USING (is_private = false OR created_by = auth.uid());

-- Users can create chatrooms
CREATE POLICY "Users can create chatrooms"
  ON chatrooms FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- 7. Create RLS Policies for chatroom_members
-- Users can see members of rooms they belong to
CREATE POLICY "Users can view members of their rooms"
  ON chatroom_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chatrooms
      WHERE chatrooms.id = chatroom_members.chatroom_id
      AND (chatrooms.is_private = false OR chatrooms.created_by = auth.uid())
    )
    OR user_id = auth.uid()
  );

-- Users can join public rooms or be added to private rooms
CREATE POLICY "Users can join rooms"
  ON chatroom_members FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      EXISTS (
        SELECT 1 FROM chatrooms
        WHERE chatrooms.id = chatroom_members.chatroom_id
        AND chatrooms.is_private = false
      )
      OR EXISTS (
        SELECT 1 FROM chatrooms
        WHERE chatrooms.id = chatroom_members.chatroom_id
        AND chatrooms.created_by = auth.uid()
      )
    )
  );

-- 8. Create RLS Policies for chat_messages
-- Users can see messages in public rooms or rooms they're members of
CREATE POLICY "Users can view messages in accessible rooms"
  ON chat_messages FOR SELECT
  USING (
    chatroom_id = 'public'
    OR EXISTS (
      SELECT 1 FROM chatrooms
      WHERE chatrooms.id::text = chat_messages.chatroom_id
      AND chatrooms.is_private = false
    )
    OR EXISTS (
      SELECT 1 FROM chatroom_members
      WHERE chatroom_members.chatroom_id::text = chat_messages.chatroom_id
      AND chatroom_members.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM chatrooms
      WHERE chatrooms.id::text = chat_messages.chatroom_id
      AND chatrooms.created_by = auth.uid()
    )
  );

-- Users can send messages to rooms they have access to
CREATE POLICY "Users can send messages to accessible rooms"
  ON chat_messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      chatroom_id = 'public'
      OR EXISTS (
        SELECT 1 FROM chatrooms
        WHERE chatrooms.id::text = chat_messages.chatroom_id
        AND chatrooms.is_private = false
      )
      OR EXISTS (
        SELECT 1 FROM chatroom_members
        WHERE chatroom_members.chatroom_id::text = chat_messages.chatroom_id
        AND chatroom_members.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM chatrooms
        WHERE chatrooms.id::text = chat_messages.chatroom_id
        AND chatrooms.created_by = auth.uid()
      )
    )
  );

-- Enable Realtime for chat tables (optional - if Realtime is available in your Supabase plan)
-- If Realtime is not available, the app will automatically use polling as a fallback
-- Uncomment these lines if you have Realtime enabled:
-- ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
-- ALTER PUBLICATION supabase_realtime ADD TABLE chatrooms;
-- ALTER PUBLICATION supabase_realtime ADD TABLE chatroom_members;

