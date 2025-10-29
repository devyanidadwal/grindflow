'use client'

import React from 'react'

type ContainerTextFlipProps = {
  words: string[]
  className?: string
}

/**
 * Minimal "Container Text Flip" inspired component.
 * - Flips through provided words using CSS steps animation
 * - Container uses a soft frosted look matching the hero
 */
export function ContainerTextFlip({ words, className }: ContainerTextFlipProps) {
  const count = Math.max(1, words.length)

  return (
    <span
      className={
        `relative inline-flex items-center rounded-xl px-3 md:px-4 py-1 md:py-2 ` +
        `shadow-[0_8px_24px_rgba(2,6,23,0.35)] backdrop-blur-[2px] ${className || ''}`
      }
      style={{ backgroundColor: 'rgba(255,255,255,0.9)', color: '#071129' }}
    >
      <span
        className="relative overflow-hidden h-[1.95em] leading-[1.9] font-extrabold text-[0.9em] md:text-[1em]"
        style={{ width: 'auto' }}
      >
        <span
          className="text-flip-inner block"
          style={{
            // CSS vars used by globals.css animation
            // @ts-ignore - custom property
            ['--count' as any]: count,
            // @ts-ignore - custom property
            ['--duration' as any]: '6s',
          }}
        >
          {words.map((w, i) => (
            <span key={w + i} className="block">
              {w}
            </span>
          ))}
          {/* duplicate first for smooth loop */}
          <span className="block">{words[0]}</span>
        </span>
      </span>
    </span>
  )
}

export default ContainerTextFlip


