"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { useNexus } from "@/contexts/nexus-context"
import Link from "next/link"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { getShardDistribution } from "@/lib/api"
import type { ShardDistributionResponse } from "@/lib/types"

interface ShardNode {
  id: string
  name: string
  nameAr: string
  x: number
  y: number
  shards: number
}

interface ShardMapProps {
  nodes?: ShardNode[]
  className?: string
  interactive?: boolean
  showBadge?: boolean
}

const defaultNodes: ShardNode[] = [
  { id: "uae-1", name: "UAE Node 1", nameAr: "عقدة الإمارات ١", x: 50, y: 20, shards: 4 },
  { id: "uae-2", name: "UAE Node 2", nameAr: "عقدة الإمارات ٢", x: 20, y: 60, shards: 4 },
  { id: "uae-3", name: "UAE Node 3", nameAr: "عقدة الإمارات ٣", x: 80, y: 60, shards: 4 },
]

// Map node IDs from API to component node format
const NODE_ID_MAP: Record<string, { id: string; x: number; y: number }> = {
  "uae-1": { id: "uae-1", x: 50, y: 20 },
  "uae-2": { id: "uae-2", x: 20, y: 60 },
  "uae-3": { id: "uae-3", x: 80, y: 60 },
}

const LOCATION_NAME_AR: Record<string, string> = {
  "UAE Node 1": "عقدة الإمارات ١",
  "UAE Node 2": "عقدة الإمارات ٢",
  "UAE Node 3": "عقدة الإمارات ٣",
}

export function ShardMap({
  nodes = defaultNodes,
  className,
  interactive = true,
  showBadge = true,
}: ShardMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const { language } = useNexus()
  const animationRef = useRef<number | null>(null)
  const pulseRef = useRef(0)
  const isVisibleRef = useRef(true)
  const [shardData, setShardData] = useState<ShardDistributionResponse | null>(null)

  // Fetch real shard data from API
  useEffect(() => {
    let cancelled = false
    getShardDistribution().then((data) => {
      if (cancelled) return
      if (data) setShardData(data)
    }).catch(() => {
      // Silently handle fetch errors - defaults will remain
    })
    return () => { cancelled = true }
  }, [])

  // Map node data from API response or use prop/defaults
  const displayNodes: ShardNode[] = shardData ? shardData.nodes.map(node => {
    const mappedNode = NODE_ID_MAP[node.node_id] || { id: node.node_id, x: 50, y: 50 }
    return {
      id: mappedNode.id,
      name: node.location,
      nameAr: LOCATION_NAME_AR[node.location] || node.location,
      x: mappedNode.x,
      y: mappedNode.y,
      shards: node.shard_count,
    }
  }) : (nodes || defaultNodes)

  // Intersection observer to pause animation when off-screen (FIX 29)
  useEffect(() => {
    if (!containerRef.current) return
    const observer = new IntersectionObserver(
      ([entry]) => { isVisibleRef.current = entry.isIntersecting },
      { threshold: 0.1 }
    )
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    const goldColor = "#9B7A58"
    const goldDim = "rgba(155, 122, 88, 0.3)"

    // FIX 16: Check reduced motion preference
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    const draw = () => {
      // Skip drawing when off-screen to save battery (FIX 29)
      if (!isVisibleRef.current) {
        animationRef.current = requestAnimationFrame(draw)
        return
      }
      
      // FIX 16: If reduced motion, draw static frame and stop
      if (prefersReducedMotion) {
        ctx.clearRect(0, 0, rect.width, rect.height)
        // Draw static connections
        ctx.strokeStyle = "rgba(155, 122, 88, 0.5)"
        ctx.lineWidth = 1
        for (let i = 0; i < displayNodes.length; i++) {
          for (let j = i + 1; j < displayNodes.length; j++) {
            ctx.beginPath()
            ctx.moveTo((displayNodes[i].x / 100) * rect.width, (displayNodes[i].y / 100) * rect.height)
            ctx.lineTo((displayNodes[j].x / 100) * rect.width, (displayNodes[j].y / 100) * rect.height)
            ctx.stroke()
          }
        }
        // Draw static nodes
        displayNodes.forEach((node) => {
          const x = (node.x / 100) * rect.width
          const y = (node.y / 100) * rect.height
          ctx.fillStyle = goldColor
          ctx.beginPath()
          ctx.arc(x, y, 6, 0, Math.PI * 2)
          ctx.fill()
        })
        return // Don't continue animation
      }
      
      ctx.clearRect(0, 0, rect.width, rect.height)

      // Calculate pulse opacity (72 BPM = 833ms = 50 frames at 60fps)
      pulseRef.current = (pulseRef.current + 1) % 50
      const pulseOpacity = 0.3 + 0.4 * Math.sin((pulseRef.current / 50) * Math.PI * 2)

      // Draw connections between all nodes
      ctx.strokeStyle = `rgba(155, 122, 88, ${pulseOpacity})`
      ctx.lineWidth = 1

      for (let i = 0; i < displayNodes.length; i++) {
        for (let j = i + 1; j < displayNodes.length; j++) {
          const x1 = (displayNodes[i].x / 100) * rect.width
          const y1 = (displayNodes[i].y / 100) * rect.height
          const x2 = (displayNodes[j].x / 100) * rect.width
          const y2 = (displayNodes[j].y / 100) * rect.height

          ctx.beginPath()
          ctx.moveTo(x1, y1)
          ctx.lineTo(x2, y2)
          ctx.stroke()
        }
      }

      // Draw nodes and their shard dots
      displayNodes.forEach((node) => {
        const x = (node.x / 100) * rect.width
        const y = (node.y / 100) * rect.height

        // Draw main node (star shape)
        ctx.fillStyle = goldColor
        ctx.beginPath()
        for (let i = 0; i < 5; i++) {
          const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2
          const radius = i % 2 === 0 ? 8 : 4
          const px = x + Math.cos(angle) * radius
          const py = y + Math.sin(angle) * radius
          if (i === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        }
        ctx.closePath()
        ctx.fill()

        // Draw shard dots around node
        for (let i = 0; i < node.shards; i++) {
          const angle = (i / node.shards) * Math.PI * 2 - Math.PI / 2
          const distance = 20 + Math.sin(pulseRef.current / 10 + i) * 2
          const sx = x + Math.cos(angle) * distance
          const sy = y + Math.sin(angle) * distance

          // Glow effect
          const gradient = ctx.createRadialGradient(sx, sy, 0, sx, sy, 6)
          gradient.addColorStop(0, goldColor)
          gradient.addColorStop(1, "transparent")
          ctx.fillStyle = gradient
          ctx.beginPath()
          ctx.arc(sx, sy, 6, 0, Math.PI * 2)
          ctx.fill()

          // Solid center
          ctx.fillStyle = goldColor
          ctx.beginPath()
          ctx.arc(sx, sy, 3, 0, Math.PI * 2)
          ctx.fill()

          // Connection line to main node
          ctx.strokeStyle = goldDim
          ctx.beginPath()
          ctx.moveTo(x, y)
          ctx.lineTo(sx, sy)
          ctx.stroke()
        }

        // Draw node label with UAE flag
        const foregroundColor = getComputedStyle(document.documentElement).getPropertyValue('--foreground').trim() || "#F5F5F7"
        ctx.fillStyle = foregroundColor
        ctx.font = "11px Inter, sans-serif"
        ctx.textAlign = "center"
        const label = language === "ar" ? `🇦🇪 ${node.nameAr}` : `🇦🇪 ${node.name}`
        ctx.fillText(label, x, y + 35)
      })

      animationRef.current = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [displayNodes, language])

  const totalShards = displayNodes.reduce((sum, node) => sum + node.shards, 0)

  const content = (
    <TooltipProvider>
      <div
        ref={containerRef}
        className={cn(
          "relative bg-card rounded-2xl overflow-hidden",
          interactive && "cursor-pointer hover:ring-1 hover:ring-nexus-jade/30 transition-all",
          className
        )}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ minHeight: 150 }}
          aria-label={`Shard map showing ${totalShards} shards across ${displayNodes.length} nodes`}
        />
        
        {/* Tooltip overlay areas for each node */}
        {displayNodes.map((node) => (
          <Tooltip key={node.id}>
            <TooltipTrigger asChild>
              <div 
                className="absolute w-12 h-12 -translate-x-1/2 -translate-y-1/2 cursor-pointer"
                style={{ left: `${node.x}%`, top: `${node.y}%` }}
                aria-label={`${node.name}: ${node.shards} shards`}
              />
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-card border-nexus-gold/20">
              <p className="font-medium">{language === "ar" ? node.nameAr : node.name}</p>
              <p className="text-xs text-muted-foreground">
                {node.shards} {language === "ar" ? "أجزاء نشطة" : "active shards"}
              </p>
            </TooltipContent>
          </Tooltip>
        ))}
        
        {showBadge && (
          <div className="absolute bottom-3 start-3 px-2 py-1 bg-black/60 rounded-md backdrop-blur-sm">
            <span className="text-xs text-white">
              {language === "ar"
                ? `${totalShards} جزء عبر ${displayNodes.length} عقد إماراتية`
                : `${totalShards} shards across ${displayNodes.length} UAE nodes`}
            </span>
          </div>
        )}
      </div>
    </TooltipProvider>
  )

  if (interactive) {
    return <Link href="/vault">{content}</Link>
  }

  return content
}
