import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import Link from 'next/link'

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>
}) {
  const params = await searchParams
  const email = params?.email?.trim() ?? ''
  const verifyHref = email
    ? `/auth/verify-otp?email=${encodeURIComponent(email)}`
    : '/auth/verify-otp'

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <div className="text-center mb-6">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-xl">
                L
              </div>
            </div>
            <h1 className="text-2xl font-bold">LingkodBayan</h1>
            <p className="text-sm text-muted-foreground">Civic Services Portal</p>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl text-center">Account Created!</CardTitle>
              <CardDescription className="text-center">
                Check your email for the verification code.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Welcome to LingkodBayan! You&apos;ve successfully created your account.
                </p>
                <p className="text-sm text-muted-foreground">
                  We now send a numeric verification code instead of a confirmation link. Enter the code on the verification page to activate your account.
                </p>
                <p className="text-sm text-muted-foreground">
                  Once verified, you&apos;ll be able to submit service requests, file complaints, and track your submissions.
                </p>
                <div className="pt-2">
                  <Link
                    href={verifyHref}
                    className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    Open verification page
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
