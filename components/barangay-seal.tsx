import Image from 'next/image'

interface BarangaySealProps {
  /** Width in CSS pixels */
  width?: number
  /** Height in CSS pixels */
  height?: number
  /** Tailwind className overrides */
  className?: string
  /** Optional caption shown below the seal */
  caption?: string
  /** When true, clips the image into a circle to hide box corners (default) */
  clipped?: boolean
}

export function BarangaySeal({
  width = 96,
  height = 96,
  className,
  caption,
  clipped = true,
}: BarangaySealProps) {
  return (
    <div className={`flex flex-col items-center gap-2 ${className ?? ''}`}>
      <div
        className={`relative shrink-0 overflow-hidden ${
          clipped ? 'rounded-full' : 'rounded-xl'
        }`}
        style={{ width, height }}
      >
        <Image
          src="/images/brgy-barretto-logo.png"
          alt="Official Seal of Barangay Barretto, Olongapo City"
          fill
          className="object-contain"
          priority
        />
      </div>
      {caption && (
        <p className="text-xs text-gray-500 dark:text-muted-foreground">{caption}</p>
      )}
    </div>
  )
}
