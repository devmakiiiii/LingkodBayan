'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Application error:', error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-red-600" />
        <h2 className="mt-4 text-lg font-semibold text-red-900">
          Something went wrong
        </h2>
        <p className="mt-2 text-sm text-red-700">
          {error.message || 'An unexpected error occurred. Please try again.'}
        </p>
        <div className="mt-4 flex gap-3 justify-center">
          <Button
            variant="outline"
            onClick={reset}
            className="border-red-300 text-red-700 hover:bg-red-100"
          >
            Try again
          </Button>
          <Button
            onClick={() => (window.location.href = '/')}
            className="bg-red-600 text-white hover:bg-red-700"
          >
            Go home
          </Button>
        </div>
      </div>
    </div>
  )
}
