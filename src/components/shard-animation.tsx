"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "motion/react"

interface ShardAnimationProps {
  text: string
  onComplete: () => void
  isActive: boolean
  // Optional real sovereignty data from backend
  sovereigntyData?: {
    fragments: Array<{
      fragment_id: string
      node_id: string
      size_bytes: number
    }>
    merkle_root: string
  }
}

interface Shard {
  id: number
  text: string
  x: number
  y: number
  rotation: number
  scale: number
}

export function ShardAnimation({ text, onComplete, isActive }: ShardAnimationProps) {
  const [shards, setShards] = useState<Shard[]>([])
  const [phase, setPhase] = useState<"idle" | "fracturing" | "scattering" | "done">("idle")
  const [reducedMotion, setReducedMotion] = useState(false)

  // FIX 14: Check prefers-reduced-motion
  useEffect(() => {
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches)
  }, [])

  useEffect(() => {
    if (!isActive) {
      setPhase("idle")
      setShards([])
      return
    }

    // FIX 14: Skip animation for users who prefer reduced motion
    if (reducedMotion) {
      onComplete()
      return
    }

    // Create shards from text
    const numShards = Math.min(5, Math.max(3, Math.ceil(text.length / 20)))
    const words = text.split(" ")
    const wordsPerShard = Math.ceil(words.length / numShards)
    
    const newShards: Shard[] = []
    for (let i = 0; i < numShards; i++) {
      const shardWords = words.slice(i * wordsPerShard, (i + 1) * wordsPerShard)
      if (shardWords.length > 0) {
        newShards.push({
          id: i,
          text: shardWords.join(" "),
          x: (Math.random() - 0.5) * 200,
          y: (Math.random() - 0.5) * 100 - 50,
          rotation: (Math.random() - 0.5) * 30,
          scale: 0.8 + Math.random() * 0.4,
        })
      }
    }

    setShards(newShards)
    setPhase("fracturing")

    // Transition to scattering
    const scatterTimer = setTimeout(() => {
      setPhase("scattering")
    }, 100)

    // Complete animation
    const completeTimer = setTimeout(() => {
      setPhase("done")
      onComplete()
    }, 600)

    return () => {
      clearTimeout(scatterTimer)
      clearTimeout(completeTimer)
    }
  }, [isActive, text, onComplete])

  if (phase === "idle" || phase === "done" || !isActive) {
    return null
  }

  return (
    <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
      <AnimatePresence>
        {shards.map((shard) => (
          <motion.div
            key={shard.id}
            initial={{ 
              x: 0, 
              y: 0, 
              rotate: 0, 
              scale: 1,
              opacity: 1,
            }}
            animate={{
              x: shard.x,
              y: shard.y,
              rotate: shard.rotation,
              scale: shard.scale,
              opacity: 0,
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 0.5,
              ease: "easeOut",
            }}
            className="absolute"
          >
            {/* Shard container with glass effect */}
            <div
              className="relative px-4 py-2 rounded-lg"
              style={{
                background: "rgba(155, 122, 88, 0.1)",
                border: "1px solid rgba(155, 122, 88, 0.3)",
                backdropFilter: "blur(4px)",
                clipPath: `polygon(
                  ${Math.random() * 10}% 0%,
                  ${90 + Math.random() * 10}% ${Math.random() * 15}%,
                  100% ${90 + Math.random() * 10}%,
                  ${Math.random() * 15}% 100%
                )`,
              }}
            >
              <span className="text-sm text-foreground/80 whitespace-nowrap">
                {shard.text}
              </span>
              
              {/* Gold trailing line */}
              <motion.div
                className="absolute h-px bg-gradient-to-r from-nexus-gold to-transparent"
                style={{
                  width: 60,
                  left: "100%",
                  top: "50%",
                  transformOrigin: "left center",
                }}
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: [0, 1, 0] }}
                transition={{ duration: 0.4 }}
              />
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
