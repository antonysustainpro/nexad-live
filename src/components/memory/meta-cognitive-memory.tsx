"use client"

import { useState, useEffect } from "react"
import { Brain, TrendingUp, AlertTriangle, Zap, ThumbsUp, Activity } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  getBrainHealth,
  getUserSatisfaction,
  getPerformanceInsights,
  recordFeedback,
  triggerOptimization,
  type BrainHealthMetrics,
  type UserSatisfactionMetrics,
  type PerformanceInsight,
} from "@/lib/meta-cognitive-api"
import { toast } from "sonner"

interface MetaCognitiveMemoryProps {
  userId: string
}

export function MetaCognitiveMemory({ userId }: MetaCognitiveMemoryProps) {
  const [loading, setLoading] = useState(true)
  const [brainHealth, setBrainHealth] = useState<BrainHealthMetrics | null>(null)
  const [satisfaction, setSatisfaction] = useState<UserSatisfactionMetrics | null>(null)
  const [insights, setInsights] = useState<PerformanceInsight[]>([])
  const [optimizing, setOptimizing] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedbackType, setFeedbackType] = useState<"positive" | "negative" | "suggestion">("positive")
  const [feedbackCategory, setFeedbackCategory] = useState<"accuracy" | "helpfulness" | "speed" | "relevance" | "other">("accuracy")
  const [feedbackComment, setFeedbackComment] = useState("")

  useEffect(() => {
    loadMetrics()
  }, [userId])

  async function loadMetrics() {
    try {
      const [health, satisfactionData, performanceInsights] = await Promise.all([
        getBrainHealth(userId),
        getUserSatisfaction(userId),
        getPerformanceInsights(userId, { unresolved_only: true }),
      ])
      setBrainHealth(health)
      setSatisfaction(satisfactionData)
      setInsights(performanceInsights)
    } catch (error) {
      // Fallback demo data
      setBrainHealth({
        overall_health: 87,
        layer_status: [
          {
            layer_id: 0,
            name: "Sensory Memory",
            health: 95,
            last_active: new Date().toISOString(),
            activity_count: 156,
          },
          {
            layer_id: 1,
            name: "Working Memory",
            health: 92,
            last_active: new Date().toISOString(),
            activity_count: 143,
          },
          {
            layer_id: 2,
            name: "Episodic Memory",
            health: 85,
            last_active: new Date(Date.now() - 3600000).toISOString(),
            activity_count: 48,
            issues: ["Conversation indexing delayed"],
          },
          {
            layer_id: 3,
            name: "Semantic Memory",
            health: 90,
            last_active: new Date().toISOString(),
            activity_count: 89,
          },
          {
            layer_id: 4,
            name: "Procedural Memory",
            health: 88,
            last_active: new Date().toISOString(),
            activity_count: 67,
          },
          {
            layer_id: 5,
            name: "Emotional Memory",
            health: 78,
            last_active: new Date().toISOString(),
            activity_count: 34,
            issues: ["Emotion tracking incomplete"],
          },
          {
            layer_id: 6,
            name: "Meta-Cognitive Memory",
            health: 82,
            last_active: new Date().toISOString(),
            activity_count: 21,
          },
        ],
        performance: {
          avg_response_time: 2.3,
          success_rate: 94.5,
          error_rate: 5.5,
          user_satisfaction: 88,
        },
        recommendations: [
          "Optimize episodic memory indexing for faster retrieval",
          "Increase emotional memory tracking coverage",
          "Schedule memory consolidation during off-peak hours",
        ],
        last_optimization: new Date(Date.now() - 86400000 * 3).toISOString(),
      })

      setSatisfaction({
        user_id: userId,
        overall_satisfaction: 88,
        interaction_quality: {
          helpful: 92,
          accurate: 89,
          relevant: 87,
          timely: 84,
        },
        feedback_summary: {
          positive_count: 124,
          negative_count: 14,
          themes: [
            { theme: "Quick responses", count: 45, sentiment: "positive" },
            { theme: "Accurate information", count: 38, sentiment: "positive" },
            { theme: "Response time", count: 8, sentiment: "negative" },
          ],
        },
        improvement_areas: ["Reduce response latency", "Improve context retention"],
      })

      setInsights([
        {
          insight_id: "ins-1",
          category: "speed",
          title: "Response Time Degradation",
          description: "Average response time has increased by 15% during peak hours",
          severity: "warning",
          recommendations: ["Enable response caching", "Optimize query routing"],
          detected_at: new Date(Date.now() - 7200000).toISOString(),
        },
        {
          insight_id: "ins-2",
          category: "relevance",
          title: "Context Loss in Long Conversations",
          description: "Relevance scores drop after 10+ message exchanges",
          severity: "info",
          recommendations: ["Implement conversation summarization", "Increase context window"],
          detected_at: new Date(Date.now() - 14400000).toISOString(),
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  async function handleOptimize() {
    setOptimizing(true)
    try {
      const result = await triggerOptimization(userId, "all")
      toast.success(`Optimization started: ${result.improvements.join(", ")}`)
      // Reload metrics after a delay
      setTimeout(() => loadMetrics(), 5000)
    } catch (error) {
      toast.error("We couldn't start the optimization. Please try again in a moment.")
    } finally {
      setOptimizing(false)
    }
  }

  async function submitFeedback() {
    try {
      await recordFeedback(userId, {
        type: feedbackType,
        category: feedbackCategory,
        comment: feedbackComment,
      })
      toast.success("Thank you for your feedback!")
      setShowFeedback(false)
      setFeedbackComment("")
    } catch (error) {
      toast.error("We couldn't submit your feedback. Please try again.")
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  const getHealthColor = (health: number) => {
    if (health >= 90) return "text-green-500"
    if (health >= 70) return "text-yellow-500"
    return "text-red-500"
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "destructive"
      case "warning":
        return "secondary"
      default:
        return "outline"
    }
  }

  return (
    <div className="space-y-6">
      {/* Overall Brain Health */}
      {brainHealth && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Brain className="h-5 w-5" />
              Brain Health Overview
            </h3>
            <Button onClick={handleOptimize} disabled={optimizing} size="sm">
              <Zap className="h-4 w-4 mr-2" />
              {optimizing ? "Optimizing..." : "Optimize Now"}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Overall Health</span>
                <span className={`text-2xl font-bold ${getHealthColor(brainHealth.overall_health)}`}>
                  {brainHealth.overall_health}%
                </span>
              </div>
              <Progress value={brainHealth.overall_health} className="h-3" />
            </div>

            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Performance Metrics</div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>Response Time: {brainHealth.performance.avg_response_time}s</div>
                <div>Success Rate: {brainHealth.performance.success_rate}%</div>
                <div>Error Rate: {brainHealth.performance.error_rate}%</div>
                <div>Satisfaction: {brainHealth.performance.user_satisfaction}%</div>
              </div>
            </div>
          </div>

          {/* Layer Status */}
          <div className="mt-6">
            <h4 className="text-sm font-medium mb-3">Memory Layer Status</h4>
            <div className="space-y-2">
              {brainHealth.layer_status.map((layer) => (
                <div key={layer.layer_id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{layer.name}</span>
                    {layer.issues && (
                      <AlertTriangle className="h-3 w-3 text-yellow-500" />
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-muted-foreground">
                      {layer.activity_count} activities
                    </span>
                    <div className="w-24">
                      <Progress value={layer.health} className="h-2" />
                    </div>
                    <span className={`text-sm font-medium ${getHealthColor(layer.health)}`}>
                      {layer.health}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recommendations */}
          {brainHealth.recommendations.length > 0 && (
            <div className="mt-4 p-3 bg-muted/50 rounded-lg">
              <div className="text-sm font-medium mb-2">Recommendations</div>
              <ul className="text-sm text-muted-foreground space-y-1">
                {brainHealth.recommendations.map((rec, idx) => (
                  <li key={idx}>• {rec}</li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      {/* User Satisfaction */}
      {satisfaction && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <ThumbsUp className="h-5 w-5" />
              User Satisfaction
            </h3>
            <Button onClick={() => setShowFeedback(!showFeedback)} variant="outline" size="sm">
              Give Feedback
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Overall</div>
              <div className="text-2xl font-bold">{satisfaction.overall_satisfaction}%</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Helpful</div>
              <div className="text-xl font-semibold">{satisfaction.interaction_quality.helpful}%</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Accurate</div>
              <div className="text-xl font-semibold">{satisfaction.interaction_quality.accurate}%</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Relevant</div>
              <div className="text-xl font-semibold">{satisfaction.interaction_quality.relevant}%</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Timely</div>
              <div className="text-xl font-semibold">{satisfaction.interaction_quality.timely}%</div>
            </div>
          </div>

          {showFeedback && (
            <div className="mt-4 p-4 border rounded-lg space-y-4">
              <RadioGroup value={feedbackType} onValueChange={(v) => setFeedbackType(v as "positive" | "negative" | "suggestion")}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="positive" id="positive" />
                  <Label htmlFor="positive">Positive Feedback</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="negative" id="negative" />
                  <Label htmlFor="negative">Improvement Suggestion</Label>
                </div>
              </RadioGroup>

              <RadioGroup value={feedbackCategory} onValueChange={(value) => setFeedbackCategory(value as "accuracy" | "helpfulness" | "speed" | "relevance" | "other")}>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="accuracy" id="accuracy" />
                    <Label htmlFor="accuracy">Accuracy</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="helpfulness" id="helpfulness" />
                    <Label htmlFor="helpfulness">Helpfulness</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="speed" id="speed" />
                    <Label htmlFor="speed">Speed</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="relevance" id="relevance" />
                    <Label htmlFor="relevance">Relevance</Label>
                  </div>
                </div>
              </RadioGroup>

              <Textarea
                placeholder="Share your feedback..."
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
                rows={3}
              />

              <Button onClick={submitFeedback} className="w-full">
                Submit Feedback
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Performance Insights */}
      {insights.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Activity className="h-5 w-5" />
            Performance Insights
          </h3>
          <div className="space-y-3">
            {insights.map((insight) => (
              <div key={insight.insight_id} className="p-3 border rounded-lg">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{insight.title}</span>
                      <Badge variant={getSeverityColor(insight.severity)}>
                        {insight.severity}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{insight.description}</p>
                    {insight.recommendations.length > 0 && (
                      <div className="mt-2">
                        <span className="text-xs font-medium">Recommendations:</span>
                        <ul className="text-xs text-muted-foreground mt-1">
                          {insight.recommendations.map((rec, idx) => (
                            <li key={idx}>• {rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}