<div align="center">

<h1>GrindFlow</h1>

Peer‑powered study notes platform built with Next.js, TypeScript, Tailwind, and Supabase.



<p>
  <a href="https://github.com/puravbhatt0504/grindflow"><img alt="Repo" src="https://img.shields.io/badge/GitHub-grindflow-24292f?logo=github&logoColor=white"></a>
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-14-black?logo=nextdotjs">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white">
  <img alt="Tailwind" src="https://img.shields.io/badge/TailwindCSS-3-38bdf8?logo=tailwindcss&logoColor=white">
  <img alt="Supabase" src="https://img.shields.io/badge/Supabase-Platform-3fcf8e?logo=supabase&logoColor=white">
</p>

<img alt="GrindFlow Logo" src="./public/49081F90-0AE7-46AD-BAF4-D21147D31B37_1_201_a.jpeg" width="220" />

</div>

## ✨ Features

- AI‑assisted note scoring & suggestions
- Study flows with adaptive steps
- Auto‑generated quizzes and practice
- Document upload, management, and public library
- Supabase auth (Google OAuth)
- Minimal, modern UI with tasteful animations

## 📦 Tech Stack

- Next.js App Router (server components + server actions)
- TypeScript, ESLint
- Tailwind CSS
- Supabase (Auth, Storage)
- framer‑motion (micro‑interactions on About page)
- sonner (toasts)

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create `.env.local` with the following variables:

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

**GitHub (server-only):**
- `GITHUB_TOKEN` - Used to fetch team avatars on `/about`

**Note:** Variables prefixed with `NEXT_PUBLIC_` are exposed to the client. Never expose service role keys or tokens without this prefix.

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🧭 Project Structure

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
│   ├── Footer.tsx
│   └── about/TeamGrid.tsx
├── lib/             # Utilities
│   ├── supabase.ts  # Supabase client
│   └── api.ts       # API helpers
└── public/          # Static assets
```

## 🛡️ Image domains

External images used by Next/Image are configured in `next.config.js`:

- `avatars.githubusercontent.com`
- `ui-avatars.com`

## 🧪 Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## 🔗 Official Repository

- Project code: [puravbhatt0504/grindflow](https://github.com/puravbhatt0504/grindflow)

## 🙌 Team

- Purav Bhatt — Project Coordinator — GitHub: `puravbhatt0504`
- Shreya Jha — Full Stack developer and lots of moral support — GitHub: `whoshrey`
- Devyani Dadawal — AI Lead & Full Stack developer — GitHub: `devyanidadwal`
- Piyush Thakur — Flutter Developer (Mobile apps) — GitHub: `Piyush-Fr`
- Tushar Kaushik — Full Stack developer — GitHub: `Tusharkaushik1106`

## License

ISC

