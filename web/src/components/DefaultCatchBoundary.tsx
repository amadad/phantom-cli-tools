import {
  Link,
  rootRouteId,
  useMatch,
  useRouter,
} from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'

export function DefaultCatchBoundary({ error }: ErrorComponentProps) {
  const router = useRouter()
  const isRoot = useMatch({
    strict: false,
    select: (state) => state.id === rootRouteId,
  })

  console.error('DefaultCatchBoundary Error:', error)

  return (
    <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <h1 className="text-6xl font-light mb-4">Error</h1>
        <div className="text-neutral-500 dark:text-neutral-400 mb-8">
          <p className="mb-2">Something went wrong.</p>
          {error instanceof Error && (
            <p className="text-sm font-mono">{error.message}</p>
          )}
        </div>
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => router.invalidate()}
            className="btn-outline"
          >
            Try Again
          </button>
          {isRoot ? (
            <Link to="/" className="btn">
              Home
            </Link>
          ) : (
            <button
              onClick={() => window.history.back()}
              className="btn"
            >
              Go Back
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
