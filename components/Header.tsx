'use client'

interface HeaderProps {
  title: string
  onSearchChange?: (value: string) => void
  onAuthToggle?: () => void
  isAuthenticated?: boolean
  userEmail?: string
}

export default function Header({ title, onSearchChange, onAuthToggle, isAuthenticated = false, userEmail }: HeaderProps) {
  return (
    <header className="flex justify-between items-center px-7 py-[18px] border-b border-white/2">
      <div>
        <h2 className="m-0 text-xl font-semibold">{title}</h2>
      </div>
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Search documents..."
          onChange={(e) => onSearchChange?.(e.target.value)}
          className="input-field w-64"
        />
        <button className="btn-ghost text-xl">🔔</button>
        {isAuthenticated ? (
          <span className="btn-secondary cursor-default opacity-75">
            ✓ Signed In{userEmail && ` as ${userEmail.split('@')[0]}`}
          </span>
        ) : (
          <button onClick={onAuthToggle} className="btn-secondary">
            Sign In
          </button>
        )}
        <button className="btn-ghost text-xl">👤</button>
      </div>
    </header>
  )
}

