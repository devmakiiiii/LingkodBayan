import Image from 'next/image'
import { Spinner } from '@/components/ui/spinner'

interface LoadingScreenProps {
  message?: string
}

export function LoadingScreen({ message = 'Loading...' }: LoadingScreenProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#001a4d] px-4">
      <div className="flex flex-col items-center gap-5 rounded-2xl border border-white/10 bg-white/95 px-8 py-10 shadow-2xl backdrop-blur-sm">
        <Image
          src="/barangay.png"
          alt="Barangay logo"
          width={72}
          height={72}
          className="h-16 w-16 object-contain"
          priority
        />
        <div className="flex items-center justify-center">
          <Spinner className="size-8 text-[#28A745]" />
        </div>
        <p className="text-sm font-medium text-gray-600">{message}</p>
      </div>
    </div>
  )
}
