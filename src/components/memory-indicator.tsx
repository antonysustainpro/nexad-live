"use client"

import { Brain, Eye, Clock, BookOpen, User, Heart, Sparkles } from "lucide-react"
import { motion, AnimatePresence } from "motion/react"
import { type MemoryLayerStatus } from "@/lib/api"
import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const layerIcons = [
  Eye,      // Layer 0: Sensory
  Clock,    // Layer 1: Working
  BookOpen, // Layer 2: Episodic
  Brain,    // Layer 3: Semantic
  User,     // Layer 4: Procedural
  Heart,    // Layer 5: Emotional
  Sparkles, // Layer 6: Meta-Cognitive
]

interface MemoryIndicatorProps {
  layers: MemoryLayerStatus[]
  className?: string
  showLabels?: boolean
}

export function MemoryIndicator({ layers, className, showLabels = false }: MemoryIndicatorProps) {
  const activeLayers = layers.filter(layer => layer.active)

  if (activeLayers.length === 0 && !showLabels) {
    return null
  }

  return (
    <TooltipProvider>
      <div className={cn("flex items-center gap-2", className)}>
        {showLabels && (
          <span className="text-xs text-muted-foreground">Memory:</span>
        )}
        <div className="flex items-center gap-1">
          <AnimatePresence>
            {layers.map((layer) => {
              const Icon = layerIcons[layer.layer] || Brain
              return (
                <Tooltip key={layer.layer}>
                  <TooltipTrigger asChild>
                    <motion.div
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{
                        opacity: layer.active ? 1 : 0.3,
                        scale: 1
                      }}
                      exit={{ opacity: 0, scale: 0.5 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div
                        className={cn(
                          "relative p-1 rounded-full transition-all",
                          layer.active
                            ? "bg-nexus-jade/20 text-nexus-jade"
                            : "bg-muted/50 text-muted-foreground"
                        )}
                      >
                        <Icon className="h-3 w-3" />
                        {layer.dataCount > 0 && (
                          <span className="absolute -top-1 -right-1 text-[9px] bg-background rounded-full px-1">
                            {layer.dataCount}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="space-y-1">
                      <p className="font-medium">Layer {layer.layer}: {layer.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {layer.active ? "Active" : "Inactive"}
                        {layer.dataCount > 0 && ` (${layer.dataCount} items)`}
                      </p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </AnimatePresence>
        </div>
      </div>
    </TooltipProvider>
  )
}

// Compact version for mobile
export function MemoryIndicatorCompact({ layers }: { layers: MemoryLayerStatus[] }) {
  const activeCount = layers.filter(l => l.active).length

  if (activeCount === 0) return null

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-nexus-jade/20 text-nexus-jade">
            <Brain className="h-3 w-3" />
            <span className="text-xs font-medium">{activeCount}/7</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{activeCount} memory layers active</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}