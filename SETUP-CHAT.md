# Chat Feature Setup Guide

## Quick Setup

The chat feature requires database tables to be created in Supabase. Follow these steps:

### Step 1: Open Supabase SQL Editor

1. Go to your Supabase Dashboard
2. Click on "SQL Editor" in the left sidebar
3. Click "New query"

### Step 2: Run the Schema

Copy and paste the entire contents of `database-schema.sql` into the SQL Editor, then click "Run" (or press Ctrl+Enter).

### Step 3: Verify Tables Were Created

After running the SQL, verify the tables exist:

1. Go to "Table Editor" in Supabase
2. You should see these tables:
   - `chatrooms`
   - `chatroom_members`
   - `chat_messages`

### Step 4: Enable Realtime (Optional - if available in your plan)

**Note**: If Realtime is not available in your Supabase plan, the chat will automatically use polling (checking for new messages every 2 seconds) instead. This works perfectly fine!

If you have Realtime enabled:
1. Go to "Database" → "Replication" in Supabase
2. Enable replication for these tables:
   - `chat_messages`
   - `chatrooms`
   - `chatroom_members`

OR run this SQL in the SQL Editor:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE chatrooms;
ALTER PUBLICATION supabase_realtime ADD TABLE chatroom_members;
```

**If Realtime is not available**: No action needed! The app will automatically detect this and use polling instead.

## What the Schema Creates

1. **chatrooms** - Stores public and private chatrooms
2. **chatroom_members** - Tracks which users are in which private rooms
3. **chat_messages** - Stores all chat messages
4. **RLS Policies** - Security rules to control who can see/send messages
5. **Indexes** - For better query performance
6. **Realtime** (Optional) - Enables instant message updates if available, otherwise uses polling

## Troubleshooting

If you see errors like:
- `"Could not find the table 'public.chat_messages' in the schema cache"`
- `"relation does not exist"`

**Solution**: Run the `database-schema.sql` file in Supabase SQL Editor.

If messages aren't appearing in real-time:
**Solution**: If Realtime is not available, the app uses polling (checks every 2 seconds). This is automatic and requires no setup. If you have Realtime enabled, make sure it's configured (see Step 4 above).

## Testing

After setup:
1. Open the Chat page in your app
2. You should see "Public Chat" room
3. Try sending a message - it should appear instantly
4. Create a private room using the "+" button
5. Messages should appear in real-time for all users in the room

