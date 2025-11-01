/**
 * Environment variable helper
 * Provides type-safe access to environment variables
 */

export const env = {
  // Supabase
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    storageBucket: process.env.SUPABASE_STORAGE_BUCKET || 'documents',
  },

  // API
  api: {
    baseUrl: typeof window !== 'undefined' 
      ? window.location.origin 
      : (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000'),
  },

  // Server
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0',
    nodeEnv: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
  },

  // CORS
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || [
      typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
      'https://grindflow.vercel.app',
    ],
  },

  // Database
  database: {
    url: process.env.DATABASE_URL || '',
  },

  // AI Services
  ai: {
    llmApiKey: process.env.LLM_API_KEY || '',
    imageApiKey: process.env.IMAGE_API_KEY || '',
  },

  // Optional: Redis
  redis: {
    url: process.env.REDIS_URL || '',
  },

  // Optional: Email
  email: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },

  // Optional: Analytics
  analytics: {
    enabled: process.env.ANALYTICS_ENABLED === 'true',
    key: process.env.ANALYTICS_KEY || '',
  },
} as const

