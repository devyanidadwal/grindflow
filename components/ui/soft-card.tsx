"use client"

import { ReactNode, CSSProperties } from 'react'
import { motion } from 'motion/react'

interface SoftCardProps {
  className?: string
  children: ReactNode
  style?: CSSProperties
}

export default function SoftCard({ className = '', children, style }: SoftCardProps) {
  return (
    <motion.div
      className={`card ${className}`}
      style={style}
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-10% 0px -10% 0px' }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      whileHover={{ y: -2 }}
    >
      {children}
    </motion.div>
  )
}


