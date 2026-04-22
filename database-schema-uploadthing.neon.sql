-- Phase 3: UploadThing migration
-- Adds a file_url column to documents to hold UploadThing public URLs.
-- Run this in Neon SQL Editor.

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS file_url TEXT;

-- Wipe any rows that still reference dead Supabase storage_path values.
-- Skip this if you want to keep old records (they'll just fail to open).
DELETE FROM documents;
