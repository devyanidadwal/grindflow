
# 📚 GrindFlow

> **A peer-powered AI study platform that transforms how students create, analyze, and share academic notes.**

GrindFlow is a modern web application that leverages artificial intelligence to help students improve their study notes, generate practice quizzes, visualize learning flows, and build a collaborative learning community.

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)
![Supabase](https://img.shields.io/badge/Supabase-2.77-green)

---

## 🎯 Overview

GrindFlow solves a critical problem: **Students spend hours creating study notes but have no way to know if they're good enough before exams.**

Instead of guessing, students can now:
- Upload their PDF notes and get instant AI-powered scoring (0-100)
- Receive actionable feedback on what to improve
- Generate personalized quizzes from their documents
- Visualize learning progression with study flow diagrams
- Share high-quality notes in a public library
- Discover peer-reviewed study materials

---

## ✨ Key Features

### 🧠 AI-Powered Note Analysis
- **Instant Scoring**: Upload PDF notes and receive a score out of 100
- **Smart Feedback**: Get detailed analysis including:
  - Focus topics to emphasize
  - Repetitive or low-value content to remove
  - Suggested improvement plans
  - Rationale explaining the score
- **Context-Aware**: Analysis tailored to your specific exam goals (e.g., "Midsem exam for MAIT University, Chapters 5-7")

### 📊 Visual Study Flows
- **Flow Diagrams**: Generate ASCII/text diagrams showing:
  - Main topics and subtopics
  - Concept dependencies and prerequisites
  - Optimal learning progression
  - Hierarchical topic structure
- **Flow Analysis**: Get comprehensive text analysis (500-1000 words) explaining:
  - Learning progression mapping
  - Concept relationships
  - Suggested study sequence

### 🎯 Auto-Generated Quizzes
- **Keyword-Based Generation**: Focus quizzes on specific topics (e.g., "derivatives, chain rule")
- **Multiple Choice Questions**: Generate up to 10 questions with 4 options each
- **Instant Results**: Check your score and see correct answers
- **Targeted Practice**: Filter document content by keywords for relevant questions

### 📚 Public Library
- **Share High-Quality Notes**: Documents scoring 80+ can be shared publicly
- **Organized by Subject/Year/Degree**: Browse notes by:
  - Subject (e.g., Mathematics, Computer Science)
  - Academic Year
  - Degree/Course (e.g., BTech, BSc, MBA)
  - Unit/Chapter
- **View & Download**: Access peer-reviewed notes with full analysis details
- **Community-Driven**: Discover and contribute to a growing library of quality study materials

### 🔐 Authentication & Security
- **Google OAuth**: Seamless sign-in with Google accounts
- **Secure Document Storage**: Files stored in Supabase with proper access control
- **User-Specific Data**: Each user can only access their own documents
- **Row Level Security**: Database policies ensure data privacy

### 💬 Real-Time Chat (Optional Feature)
- **Public & Private Rooms**: Create chatrooms for study groups
- **Real-Time Messaging**: Instant message updates (with polling fallback)
- **User Management**: Invite members to private rooms

---

## 🛠️ Technology Stack

### Frontend
- **Next.js 16** - React framework with App Router
- **TypeScript** - Type safety and better developer experience
- **React 19** - Latest React features
- **Tailwind CSS 4** - Utility-first CSS framework
- **Framer Motion** - Smooth animations and transitions
- **Sonner** - Beautiful toast notifications

### Backend & Services
- **Supabase** - Backend as a Service:
  - PostgreSQL database
  - Authentication
  - File storage
  - Row Level Security policies
- **Google Gemini AI** - AI-powered analysis:
  - Document scoring and feedback
  - Quiz generation
  - Study flow analysis
- **Stripe** - Payment processing (optional)

### Development Tools
... (347 lines left)
Collapse
message.txt
15 KB
﻿
# 📚 GrindFlow

> **A peer-powered AI study platform that transforms how students create, analyze, and share academic notes.**

GrindFlow is a modern web application that leverages artificial intelligence to help students improve their study notes, generate practice quizzes, visualize learning flows, and build a collaborative learning community.

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)
![Supabase](https://img.shields.io/badge/Supabase-2.77-green)

---

## 🎯 Overview

GrindFlow solves a critical problem: **Students spend hours creating study notes but have no way to know if they're good enough before exams.**

Instead of guessing, students can now:
- Upload their PDF notes and get instant AI-powered scoring (0-100)
- Receive actionable feedback on what to improve
- Generate personalized quizzes from their documents
- Visualize learning progression with study flow diagrams
- Share high-quality notes in a public library
- Discover peer-reviewed study materials

---

## ✨ Key Features

### 🧠 AI-Powered Note Analysis
- **Instant Scoring**: Upload PDF notes and receive a score out of 100
- **Smart Feedback**: Get detailed analysis including:
  - Focus topics to emphasize
  - Repetitive or low-value content to remove
  - Suggested improvement plans
  - Rationale explaining the score
- **Context-Aware**: Analysis tailored to your specific exam goals (e.g., "Midsem exam for MAIT University, Chapters 5-7")

### 📊 Visual Study Flows
- **Flow Diagrams**: Generate ASCII/text diagrams showing:
  - Main topics and subtopics
  - Concept dependencies and prerequisites
  - Optimal learning progression
  - Hierarchical topic structure
- **Flow Analysis**: Get comprehensive text analysis (500-1000 words) explaining:
  - Learning progression mapping
  - Concept relationships
  - Suggested study sequence

### 🎯 Auto-Generated Quizzes
- **Keyword-Based Generation**: Focus quizzes on specific topics (e.g., "derivatives, chain rule")
- **Multiple Choice Questions**: Generate up to 10 questions with 4 options each
- **Instant Results**: Check your score and see correct answers
- **Targeted Practice**: Filter document content by keywords for relevant questions

### 📚 Public Library
- **Share High-Quality Notes**: Documents scoring 80+ can be shared publicly
- **Organized by Subject/Year/Degree**: Browse notes by:
  - Subject (e.g., Mathematics, Computer Science)
  - Academic Year
  - Degree/Course (e.g., BTech, BSc, MBA)
  - Unit/Chapter
- **View & Download**: Access peer-reviewed notes with full analysis details
- **Community-Driven**: Discover and contribute to a growing library of quality study materials

### 🔐 Authentication & Security
- **Google OAuth**: Seamless sign-in with Google accounts
- **Secure Document Storage**: Files stored in Supabase with proper access control
- **User-Specific Data**: Each user can only access their own documents
- **Row Level Security**: Database policies ensure data privacy

### 💬 Real-Time Chat (Optional Feature)
- **Public & Private Rooms**: Create chatrooms for study groups
- **Real-Time Messaging**: Instant message updates (with polling fallback)
- **User Management**: Invite members to private rooms

---

## 🛠️ Technology Stack

### Frontend
- **Next.js 16** - React framework with App Router
- **TypeScript** - Type safety and better developer experience
- **React 19** - Latest React features
- **Tailwind CSS 4** - Utility-first CSS framework
- **Framer Motion** - Smooth animations and transitions
- **Sonner** - Beautiful toast notifications

### Backend & Services
- **Supabase** - Backend as a Service:
  - PostgreSQL database
  - Authentication
  - File storage
  - Row Level Security policies
- **Google Gemini AI** - AI-powered analysis:
  - Document scoring and feedback
  - Quiz generation
  - Study flow analysis
- **Stripe** - Payment processing (optional)

### Development Tools
- **pdf-parse** - PDF text extraction
- **ESLint** - Code linting
- **PostCSS** - CSS processing

---

## 📋 Prerequisites

Before you begin, ensure you have:

- **Node.js 18+** installed ([Download](https://nodejs.org/))
- **npm** or **yarn** package manager
- **Supabase Account** ([Sign up](https://supabase.com))
- **Google Cloud Project** with Gemini API enabled ([Get API Key](https://ai.google.dev/))
- (Optional) **Stripe Account** for payment features

---

## 🚀 Getting Started

### Step 1: Clone the Repository

```bash
git clone <your-repo-url>
cd grindflow
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the schema from `database-schema.sql`
3. Create a storage bucket named `documents` (or update `SUPABASE_STORAGE_BUCKET`)
4. Go to **Settings** → **API** to get your keys

### Step 4: Configure Environment Variables

Create a `.env.local` file in the root directory:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_STORAGE_BUCKET=documents

# Google Gemini AI
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash

# Optional: Stripe (for payments)
# Get these from https://dashboard.stripe.com/apikeys
STRIPE_SECRET_KEY=your_stripe_secret_key_here
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key_here

# Server Configuration
PORT=3000
NODE_ENV=development
```

**⚠️ Important:** 
- Never commit `.env.local` to version control
- `NEXT_PUBLIC_*` variables are exposed to the client-side
- Keep `SUPABASE_SERVICE_ROLE_KEY` and API keys secret

### Step 5: Set Up Database Schema

1. Open your Supabase Dashboard
2. Go to **SQL Editor**
3. Copy and paste the entire contents of `database-schema.sql`
4. Click **Run** (or press `Ctrl+Enter`)

This creates:
- `documents` - User-uploaded PDF files metadata
- `documents_text` - Extracted and cached PDF text
- `documents_metadata` - AI analysis results
- `public_library` - Shared documents
- `chatrooms` - Chat rooms
- `chatroom_members` - Room membership
- `chat_messages` - Chat messages
- RLS policies for security

### Step 6: Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📁 Project Structure

```
grindflow/
├── app/                          # Next.js App Router
│   ├── api/                      # API routes
│   │   ├── analyze/              # AI document analysis
│   │   ├── quiz/                 # Quiz generation
│   │   ├── studyflow/            # Study flow generation
│   │   ├── documents/            # Document CRUD operations
│   │   ├── upload/               # File upload handling
│   │   ├── public-library/       # Public library endpoints
│   │   ├── chat/                 # Chat functionality
│   │   └── text/                 # Text extraction
│   ├── auth/                     # Authentication pages
│   ├── dashboard/                # Main dashboard
│   ├── explore/                  # Public library browser
│   ├── public-upload/            # Share to public library
│   ├── chat/                     # Chat interface
│   ├── login/                    # Login page
│   ├── signin/                   # Sign up page
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Landing page
│   └── globals.css               # Global styles
├── components/                  # React components
│   ├── ui/                       # Reusable UI components
│   ├── Sidebar.tsx               # Navigation sidebar
│   ├── Header.tsx                # Page header
│   ├── Footer.tsx                # Footer component
│   └── PaymentModal.tsx          # Payment modal
├── lib/                          # Utility libraries
│   ├── supabase.ts               # Supabase client setup
│   ├── supabase-server.ts        # Server-side Supabase
│   ├── api.ts                    # API helper functions
│   ├── text.ts                   # Text processing utilities
│   ├── utils.ts                  # General utilities
│   └── env.ts                    # Environment variables
├── database-schema.sql            # Database schema
├── middleware.ts                 # Next.js middleware
├── next.config.js                # Next.js configuration
├── tailwind.config.ts            # Tailwind CSS config
├── tsconfig.json                  # TypeScript config
├── package.json                   # Dependencies
└── README.md                      # This file
```

---

## 🔌 API Endpoints

### Document Management

- `POST /api/upload` - Upload a PDF document
- `GET /api/documents` - Get user's documents
- `GET /api/documents/[id]` - Get specific document
- `DELETE /api/documents/[id]` - Delete a document
- `GET /api/text/[id]` - Get extracted text from document

### AI Features

- `POST /api/analyze` - Analyze document and get score/feedback
  ```json
  {
    "id": "document-id",
    "context": "Midsem exam for MAIT University, Chapters 5-7"
  }
  ```

- `POST /api/quiz` - Generate quiz from document
  ```json
  {
    "id": "document-id",
    "keyword": "derivatives, chain rule"
  }
  ```

- `POST /api/studyflow` - Generate study flow
  ```json
  {
    "id": "document-id",
    "type": "diagram" | "analysis" | "both"
  }
  ```

### Public Library

- `GET /api/public-library` - Browse public documents
- `POST /api/public-library/submit` - Share document to public library
- `GET /api/public-library/view?id=...` - Get view URL for document
- `GET /api/public-library/download?id=...` - Download public document

### Chat (Optional)

- `POST /api/chat/create-room` - Create a chat room
- `GET /api/chat/users` - Get available users

---

## 🎨 Features in Detail

### AI Document Analysis Flow

1. **Upload**: User uploads PDF (max 20MB)
2. **Extract**: Text is extracted using `pdf-parse`
3. **Cache**: Extracted text is cached in `documents_text` table
4. **Analyze**: Google Gemini AI analyzes the document
5. **Score**: Returns score (0-100) with detailed feedback
6. **Store**: Analysis saved in `documents_metadata` table

### Quiz Generation Process

1. **Select Document**: User selects uploaded PDF
2. **Enter Keywords**: Optional keywords to focus quiz on specific topics
3. **Filter Content**: Document text filtered by keywords if provided
4. **Generate**: Gemini AI creates multiple-choice questions
5. **Display**: Interactive quiz interface with scoring

### Study Flow Generation

1. **Select Document**: Choose PDF to analyze
2. **Generate Diagram**: Creates ASCII flow diagram showing topic structure
3. **Generate Analysis**: Optional detailed text analysis
4. **Visualize**: Beautiful UI renders the flow structure

---

## 🔧 Configuration

### Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anonymous key (client-safe) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service role key (server-only) |
| `SUPABASE_STORAGE_BUCKET` | ✅ | Storage bucket name for documents |
| `GEMINI_API_KEY` | ✅ | Google Gemini API key |
| `GEMINI_MODEL` | ❌ | Gemini model name (default: `gemini-2.5-flash`) |
| `STRIPE_SECRET_KEY` | ❌ | Stripe secret key (for payments) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | ❌ | Stripe publishable key |

### Google Gemini Models

The app supports multiple Gemini models with fallback:
- `gemini-2.5-flash` (default, fastest)
- `gemini-1.5-pro` (fallback, more accurate)
- `gemini-pro` (legacy fallback)

---

## 🧪 Development

### Available Scripts

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Run linter
npm run lint
```

### Development Tips

1. **Fast Mode**: Set `FAST_MODE=1` in `.env.local` to use smaller text chunks (faster but less accurate)
2. **Quiz Timeout**: Adjust `QUIZ_TIMEOUT_MS` in environment (default: 18000ms for fast mode)
3. **Text Caching**: Extracted PDF text is cached to avoid re-parsing
4. **Error Handling**: API routes include comprehensive error handling and retries

---

## 📊 Database Schema

Key tables:

- **documents** - User documents metadata
- **documents_text** - Cached extracted text
- **documents_metadata** - AI analysis results
- **public_library** - Shared documents
- **chatrooms** - Chat rooms
- **chat_messages** - Chat messages

See `database-schema.sql` for complete schema with RLS policies.

---

## 🚢 Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Deploy!

### Other Platforms

The app can be deployed to any platform supporting Next.js:
- Netlify
- Railway
- Render
- AWS Amplify

**Note**: Ensure all environment variables are set in your hosting platform.

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📝 License

ISC License - see LICENSE file for details

---

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) - Amazing React framework
- [Supabase](https://supabase.com) - Great BaaS platform
- [Google Gemini](https://ai.google.dev/) - Powerful AI API
- [Tailwind CSS](https://tailwindcss.com/) - Beautiful utility CSS

---

## 📞 Support

For issues, questions, or suggestions:
- Open an issue on GitHub
- Check existing documentation
- Review the codebase

---
