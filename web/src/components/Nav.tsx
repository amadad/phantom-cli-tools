import { Link, useLocation } from '@tanstack/react-router'

export function Nav() {
  const location = useLocation()
  const pathname = location.pathname

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-black/80 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link to="/" className="text-sm font-medium tracking-tight">
          Phantom Loom
        </Link>
        <div className="flex items-center gap-6">
          <Link
            to="/dashboard"
            className={`text-sm transition-colors ${
              pathname === '/dashboard'
                ? 'text-black dark:text-white'
                : 'text-neutral-500 hover:text-black dark:hover:text-white'
            }`}
          >
            Dashboard
          </Link>
          <Link
            to="/generate"
            className={`text-sm transition-colors ${
              pathname === '/generate'
                ? 'text-black dark:text-white'
                : 'text-neutral-500 hover:text-black dark:hover:text-white'
            }`}
          >
            Create
          </Link>
        </div>
      </div>
    </nav>
  )
}
