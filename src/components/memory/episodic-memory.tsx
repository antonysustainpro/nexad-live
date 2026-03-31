"use client"

import { useState, useEffect } from "react"
import { Clock, Search, MessageSquare, Calendar, Trash2 } from "lucide-react"
import { format, formatDistanceToNow } from "date-fns"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  listConversations,
  searchConversations,
  deleteConversation,
  getMemoryStats,
  type Conversation,
  type ConversationSearchResult,
} from "@/lib/conversations-api"
import { toast } from "sonner"

interface EpisodicMemoryProps {
  userId: string
}

export function EpisodicMemory({ userId }: EpisodicMemoryProps) {
  const [loading, setLoading] = useState(true)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<ConversationSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [stats, setStats] = useState<any>(null)
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null)

  useEffect(() => {
    loadConversations()
    loadStats()
  }, [userId])

  async function loadConversations() {
    try {
      const result = await listConversations(userId, { limit: 20, sort: "updated" })
      setConversations(result.conversations)
    } catch (error) {
      console.error("Failed to load conversations:", error)
      // If endpoint not implemented, show demo data
      setConversations([
        {
          id: "demo-1",
          user_id: userId,
          title: "UAE Business Setup Discussion",
          created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
          updated_at: new Date(Date.now() - 86400000 * 2).toISOString(),
          message_count: 15,
          last_message: "The DIFC offers excellent benefits for fintech startups...",
          emotion_summary: { dominant: "interested", range: ["curious", "optimistic"] },
        },
        {
          id: "demo-2",
          user_id: userId,
          title: "Investment Strategy Analysis",
          created_at: new Date(Date.now() - 86400000 * 14).toISOString(),
          updated_at: new Date(Date.now() - 86400000 * 5).toISOString(),
          message_count: 8,
          last_message: "Based on current market conditions, diversification is key...",
          emotion_summary: { dominant: "analytical", range: ["focused", "cautious"] },
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  async function loadStats() {
    try {
      const memoryStats = await getMemoryStats(userId)
      setStats(memoryStats)
    } catch (error) {
      // Fallback demo stats
      setStats({
        total_conversations: 12,
        total_messages: 156,
        avg_messages_per_conversation: 13,
        most_active_times: [
          { hour: 9, count: 24 },
          { hour: 14, count: 31 },
          { hour: 16, count: 28 },
        ],
        emotion_distribution: {
          curious: 35,
          analytical: 28,
          optimistic: 22,
          cautious: 15,
        },
      })
    }
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return

    setSearching(true)
    try {
      const results = await searchConversations(userId, searchQuery, { limit: 10 })
      setSearchResults(results)
    } catch (error) {
      // Demo search results
      setSearchResults([
        {
          conversation_id: "demo-1",
          message_id: "msg-1",
          content: "...setting up a business in the UAE requires careful planning...",
          similarity: 0.92,
          context: {
            before: "When you asked about",
            after: "I recommended starting with DIFC",
          },
        },
      ])
    } finally {
      setSearching(false)
    }
  }

  async function handleDelete(conversationId: string) {
    try {
      await deleteConversation(userId, conversationId)
      setConversations(conversations.filter((c) => c.id !== conversationId))
      toast.success("Conversation deleted")
    } catch (error) {
      toast.error("Failed to delete conversation")
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Total Conversations</div>
            <div className="text-2xl font-semibold">{stats.total_conversations}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Total Messages</div>
            <div className="text-2xl font-semibold">{stats.total_messages}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Avg Messages</div>
            <div className="text-2xl font-semibold">{stats.avg_messages_per_conversation}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Most Active Hour</div>
            <div className="text-2xl font-semibold">
              {stats.most_active_times?.[0]?.hour || 0}:00
            </div>
          </Card>
        </div>
      )}

      {/* Search */}
      <Card className="p-4">
        <div className="flex gap-2">
          <Input
            placeholder="Search your conversation history..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="flex-1"
          />
          <Button onClick={handleSearch} disabled={searching}>
            <Search className="h-4 w-4 mr-2" />
            Search
          </Button>
        </div>

        {searchResults.length > 0 && (
          <div className="mt-4 space-y-2">
            <div className="text-sm font-medium">Search Results</div>
            {searchResults.map((result, idx) => (
              <Card key={idx} className="p-3 cursor-pointer hover:bg-accent">
                <div className="text-sm">{result.content}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Similarity: {(result.similarity * 100).toFixed(0)}%
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>

      {/* Conversations List */}
      <Card>
        <div className="p-4 border-b">
          <h3 className="font-semibold flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Recent Conversations
          </h3>
        </div>
        <ScrollArea className="h-[400px]">
          <div className="p-4 space-y-2">
            {conversations.map((conversation) => (
              <Card
                key={conversation.id}
                className={`p-4 cursor-pointer transition-colors ${
                  selectedConversation === conversation.id ? "bg-accent" : "hover:bg-accent/50"
                }`}
                onClick={() => setSelectedConversation(conversation.id)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="font-medium">{conversation.title}</div>
                    {conversation.last_message && (
                      <div className="text-sm text-muted-foreground line-clamp-1 mt-1">
                        {conversation.last_message}
                      </div>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(conversation.updated_at), {
                          addSuffix: true,
                        })}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        {conversation.message_count} messages
                      </span>
                    </div>
                    {conversation.emotion_summary && (
                      <div className="flex gap-1 mt-2">
                        <Badge variant="secondary" className="text-xs">
                          {conversation.emotion_summary.dominant}
                        </Badge>
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(conversation.id)
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </Card>
    </div>
  )
}