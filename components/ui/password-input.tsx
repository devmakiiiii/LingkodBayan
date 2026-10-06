import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'

function PasswordInput({ className, ...props }: React.ComponentProps<'input'>) {
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="relative">
      <Input
        {...props}
        type={showPassword ? 'text' : 'password'}
        className={cn('pr-10', className)}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={showPassword ? 'Hide password' : 'Show password'}
        aria-pressed={showPassword}
        aria-controls={props.id ? `${props.id}-description` : undefined}
        onClick={() => setShowPassword((prev) => !prev)}
        className="absolute inset-y-0 right-0 flex items-center justify-center w-10 text-gray-500 dark:text-muted-foreground hover:text-gray-700"
      >
        {showPassword ? (
          <EyeOff className="h-5 w-5" />
        ) : (
          <Eye className="h-5 w-5" />
        )}
      </button>
      {/* Visually hidden hint so the accessible name of the input stays
          unambiguous for assistive tech (the sibling toggle button's own
          aria-label would otherwise leak into name computation on some
          label-for + nested-control layouts). */}
      <span id={props.id ? `${props.id}-description` : undefined} className="sr-only">
        Password visibility toggle
      </span>
    </div>
  )
}

export { PasswordInput }
