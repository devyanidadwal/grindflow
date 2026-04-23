<div align="center">

<h1>GrindFlow</h1>

Peer‑powered study notes platform built with Next.js, TypeScript, Tailwind, Neon, Drizzle, Clerk, and UploadThing.

<p>
  <a href="https://github.com/puravbhatt0504/grindflow"><img alt="Repo" src="https://img.shields.io/badge/GitHub-grindflow-24292f?logo=github&logoColor=white"></a>
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-14-black?logo=nextdotjs">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white">
  <img alt="Tailwind" src="https://img.shields.io/badge/TailwindCSS-3-38bdf8?logo=tailwindcss&logoColor=white">
  <img alt="Neon" src="https://img.shields.io/badge/Neon-Postgres-00e699?logo=postgresql&logoColor=white">
  <img alt="Drizzle" src="https://img.shields.io/badge/Drizzle-ORM-c5f74f?logo=drizzle&logoColor=black">
  <img alt="Clerk" src="https://img.shields.io/badge/Clerk-Auth-6c47ff?logo=clerk&logoColor=white">
  <img alt="UploadThing" src="https://img.shields.io/badge/UploadThing-Storage-ff4400">
</p>

<img alt="GrindFlow Logo" src="./public/49081F90-0AE7-46AD-BAF4-D21147D31B37_1_201_a.jpeg" width="220" />

</div>

## ✨ Features

- AI‑assisted note scoring & suggestions (Gemini 2.5)
- Study flows with adaptive steps
- Auto‑generated quizzes and practice
- Document upload, management, and public library
- Clerk auth (Google OAuth + email)
- Per-user rate limiting with shared Gemini retry helper
- Minimal, modern UI with tasteful animations

## 📦 Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 App Router (server components + server actions) |
| Language | TypeScript 5, ESLint |
| Styling | Tailwind CSS |
| Database | Neon (serverless Postgres) + Drizzle ORM |
| Auth | Clerk |
| Storage | UploadThing |
| AI | Google Gemini 2.5 Flash / Flash-Lite |
| UI extras | framer‑motion, sonner |

## 🔄 Migration Summary (complete)

The project has been fully migrated off Supabase in three phases:

| Phase | What changed | Branch commit |
|---|---|---|
| Phase 1 | Supabase Postgres → **Neon + Drizzle ORM** | `004b3b3` |
| Phase 2 | Supabase Auth → **Clerk** | `2b6d293` |
| Phase 3 | Supabase Storage → **UploadThing** | `2b6d293` |
| Post-migration | Per-user rate limiting + Gemini retry helper | `8dd183f` |
| Gemini upgrade | `gemini-1.5-*` → `gemini-2.5-flash-lite`; API path `v1` → `v1beta` | latest |

Supabase is no longer a dependency.

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create `.env.local` with the following variables:

**Database (Neon):**
- `DATABASE_URL` - Neon connection string (pooled)
- `DATABASE_URL_UNPOOLED` - Direct connection string (for migrations)

**Authentication (Clerk):**
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL` (e.g. `/sign-in`)
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL` (e.g. `/sign-up`)

**Storage (UploadThing):**
- `UPLOADTHING_SECRET`
- `UPLOADTHING_APP_ID`

**AI:**
- `GEMINI_API_KEY` - Google Gemini API key

**GitHub (server-only, optional):**
- `GITHUB_TOKEN` - Used to fetch team avatars on `/about`

> Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser. Never expose secret keys with that prefix.

3. Run migrations:
```bash
npx drizzle-kit push
```

4. Start the dev server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🧭 Project Structure

```
grindflow/
├── app/
│   ├── api/          # API routes (studyflow, uploadthing, etc.)
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
├── drizzle/          # Drizzle migrations
├── lib/
│   ├── db.ts         # Neon + Drizzle client
│   ├── gemini.ts     # Gemini retry helper
│   └── api.ts        # API helpers
├── drizzle.config.ts
└── public/           # Static assets
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
- `npx drizzle-kit push` - Push schema changes to Neon
- `npx drizzle-kit studio` - Open Drizzle Studio (DB browser)

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
