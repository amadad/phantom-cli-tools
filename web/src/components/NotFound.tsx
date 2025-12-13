import { Link } from '@tanstack/react-router'

export function NotFound({ children }: { children?: any }) {
  return (
    <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <h1 className="text-6xl font-light mb-4">404</h1>
        <div className="text-neutral-500 dark:text-neutral-400 mb-8">
          {children || <p>The page you are looking for does not exist.</p>}
        </div>
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => window.history.back()}
            className="btn-outline"
          >
            Go back
          </button>
          <Link to="/" className="btn">
            Home
          </Link>
        </div>
      </div>
    </div>
  )
}
