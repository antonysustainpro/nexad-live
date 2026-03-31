'use client'

import * as React from 'react'
import * as ProgressPrimitive from '@radix-ui/react-progress'

import { cn } from '@/lib/utils'

function Progress({
  className,
  value,
  variant = 'default',
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & {
  variant?: 'default' | 'sovereignty' | 'jade'
}) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        'relative h-2 w-full overflow-hidden rounded-full',
        'bg-secondary/60 dark:bg-secondary/40',
        className,
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn(
          'h-full w-full flex-1 transition-all duration-300 ease-out',
          variant === 'sovereignty' && 'bg-gradient-to-r from-nexus-gold/80 via-nexus-gold to-nexus-gold/80',
          variant === 'jade' && 'bg-gradient-to-r from-nexus-jade/80 via-nexus-jade to-nexus-jade/80',
          variant === 'default' && 'bg-primary',
        )}
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
