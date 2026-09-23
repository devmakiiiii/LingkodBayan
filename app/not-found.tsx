import Link from 'next/link'
import { Compass, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <main
      id="main-content"
      className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center"
    >
      <div className="rounded-full bg-muted p-4">
        <Compass className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
      </div>
      <h1 className="mt-6 text-4xl font-bold tracking-tight text-foreground">404</h1>
      <p className="mt-2 text-lg font-medium text-foreground">Page not found</p>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        The page you are looking for doesn&apos;t exist or may have been moved.
        Use the button below to get back on track.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button asChild>
          <Link href="/">
            <Home className="h-4 w-4" aria-hidden="true" />
            Back to Home
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/citizen/dashboard">Go to Citizen Dashboard</Link>
        </Button>
      </div>
    </main>
  )
}
