# GrindFlow - Next.js

A peer-powered study notes platform built with Next.js, TypeScript, and Supabase.

## Features

- ✨ AI-assisted note scoring & suggestions
- 🧭 Flow maps & adaptive study steps
- 🧠 Auto-generated quizzes
- 💸 Earn coins for sharing high-quality notes
- 📤 Document upload and management
- 🔐 Authentication with Supabase
- 💰 Wallet system for transactions

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

### Installation

1. Install dependencies:
```bash
npm install
```

2. Environment variables are configured in `.env.local` (already set up):

**Supabase Configuration:**
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anonymous key (safe for client-side)
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (server-side only, never expose to client)
- `SUPABASE_STORAGE_BUCKET` - Supabase storage bucket name

**Authentication:**
- `GUEST_EMAIL` / `GUEST_PASSWORD` - Guest account for development auto sign-in

**Server Configuration:**
- `PORT` - Server port (default: 3000)
- `HOST` - Server host
- `NODE_ENV` - Environment (development/production)
- `LOG_LEVEL` - Logging level

**API Configuration:**
- `NEXT_PUBLIC_API_BASE_URL` - Backend API URL (default: http://localhost:3000)
- `CORS_ORIGIN` - Allowed CORS origins

**Database:**
- `DATABASE_URL` - Direct PostgreSQL connection string (optional, for migrations/admin tools)

**AI Services (Mock):**
- `LLM_API_KEY` - LLM API key
- `IMAGE_API_KEY` - Image generation API key

**Optional Services:**
- `REDIS_URL` - Redis connection (for BullMQ)
- `SMTP_*` - Email configuration
- `ANALYTICS_*` - Analytics configuration

**Note:** The `.env.local` file is already created with all your credentials. Variables with `NEXT_PUBLIC_` prefix are exposed to the client-side. Never expose service role keys or API keys without the prefix!

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
grindflow/
├── app/
│   ├── api/          # API routes
│   ├── login/        # Login page
│   ├── signin/       # Sign up page
│   ├── layout.tsx    # Root layout
│   ├── page.tsx      # Dashboard page
│   └── globals.css   # Global styles
├── components/       # React components
│   ├── Sidebar.tsx
│   ├── Header.tsx
│   └── Footer.tsx
├── lib/             # Utilities
│   ├── supabase.ts  # Supabase client
│   └── api.ts       # API helpers
└── public/          # Static assets
```

## Technologies Used

- **Next.js 14** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Supabase** - Authentication and database
- **Sonner** - Toast notifications

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## License

ISC

