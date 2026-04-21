-- Additional tables for GrindFlow Neon migration
-- Run this AFTER database-schema.neon.sql in the Neon SQL Editor
-- Reverse-engineered from API route code — verify against your Supabase dashboard if possible

-- 1. documents — uploaded files metadata
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_user_created ON documents(user_id, created_at DESC);

-- 2. documents_text — extracted + normalized text per document
CREATE TABLE IF NOT EXISTS documents_text (
  document_id UUID PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
  text TEXT,
  normalized_text TEXT,
  short_text TEXT,
  extracted_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. documents_metadata — AI analysis results
CREATE TABLE IF NOT EXISTS documents_metadata (
  document_id UUID PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
  ai_rating INTEGER,
  ai_critique TEXT
);

-- 4. public_library — shared/published documents
CREATE TABLE IF NOT EXISTS public_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID UNIQUE NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  unit TEXT,
  year TEXT,
  degree TEXT,
  score INTEGER,
  analysis_keyword TEXT,
  verdict TEXT,
  rationale TEXT,
  focus_topics TEXT,
  repetitive_topics TEXT,
  suggested_plan TEXT,
  uploaded_by TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_public_library_uploaded_at ON public_library(uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_public_library_document ON public_library(document_id);
