"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
import { motion } from "motion/react"
import {
  TrendingUp,
  Building2,
  Globe,
  Home,
  FileText,
  Search,
  RefreshCw,
  ChevronRight,
  AlertCircle,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import {
  getCompetitorAnalysis,
  getMarketData,
  getUAECPI,
  getUAERegulations,
  getUAERealEstate,
  searchIntelligence,
  type CompetitorAnalysis,
  type MarketIntelligence,
  type UAECPIData,
  type UAERegulation,
  type UAERealEstateData,
} from "@/lib/intelligence-api"
import { toast } from "sonner"

export default function IntelligencePage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState("competitors")

  // Data states
  const [competitors, setCompetitors] = useState<CompetitorAnalysis[]>([])
  const [marketData, setMarketData] = useState<MarketIntelligence[]>([])
  const [cpiData, setCpiData] = useState<UAECPIData | null>(null)
  const [regulations, setRegulations] = useState<UAERegulation[]>([])
  const [realEstate, setRealEstate] = useState<UAERealEstateData[]>([])

  useEffect(() => {
    if (user?.id) {
      loadIntelligenceData()
    }
  }, [user])

  async function loadIntelligenceData() {
    setLoading(true)
    try {
      const [competitorData, marketIntel, cpi, regs, reData] = await Promise.all([
        getCompetitorAnalysis(user!.id, { include_financials: true }),
        getMarketData(user!.id),
        getUAECPI(),
        getUAERegulations({ compliance_status: "upcoming" }),
        getUAERealEstate({ locations: ["Dubai", "Abu Dhabi"] }),
      ])

      setCompetitors(competitorData)
      setMarketData(marketIntel)
      setCpiData(cpi)
      setRegulations(regs)
      setRealEstate(reData)
    } catch (error) {
      console.error("Failed to load intelligence data:", error)
      toast.error("Failed to load intelligence data")
    } finally {
      setLoading(false)
    }
  }

  async function handleRefresh() {
    setRefreshing(true)
    await loadIntelligenceData()
    setRefreshing(false)
    toast.success("Intelligence data refreshed")
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return

    try {
      const results = await searchIntelligence(searchQuery, { limit: 20 })
      toast.success(`Found ${results.length} results`)
      // TODO: Display search results in a modal or dedicated section
    } catch (error) {
      toast.error("Search failed")
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Intelligence Dashboard</h1>
          <p className="text-muted-foreground">
            Real-time market intelligence and competitive analysis
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex gap-2">
            <Input
              placeholder="Search intelligence..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="w-64"
            />
            <Button onClick={handleSearch} size="icon" variant="ghost">
              <Search className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Market Growth</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {marketData[0]?.growth_rate || 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              YoY in your primary sector
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inflation (CPI)</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {cpiData?.yoy_change || 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              UAE year-over-year change
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New Regulations</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{regulations.length}</div>
            <p className="text-xs text-muted-foreground">
              Requiring compliance action
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Competitors Tracked</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{competitors.length}</div>
            <p className="text-xs text-muted-foreground">
              In your market sectors
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="competitors">Competitors</TabsTrigger>
          <TabsTrigger value="market">Market Trends</TabsTrigger>
          <TabsTrigger value="regulations">Regulations</TabsTrigger>
          <TabsTrigger value="economics">Economics</TabsTrigger>
          <TabsTrigger value="realestate">Real Estate</TabsTrigger>
        </TabsList>

        {/* Competitors Tab */}
        <TabsContent value="competitors" className="space-y-4">
          {competitors.map((competitor) => (
            <Card key={competitor.competitor_id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{competitor.name}</CardTitle>
                    <CardDescription>
                      {competitor.sector} • {competitor.market_share}% market share
                    </CardDescription>
                  </div>
                  {competitor.financial_metrics && (
                    <Badge variant="outline" className="text-xs">
                      {competitor.financial_metrics.growth_rate}% growth
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Recent Activities */}
                {competitor.recent_activities.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Recent Activities</h4>
                    <div className="space-y-2">
                      {competitor.recent_activities.slice(0, 3).map((activity, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-sm">
                          <Badge variant="secondary" className="text-xs">
                            {activity.type}
                          </Badge>
                          <div className="flex-1">
                            <p>{activity.description}</p>
                            <p className="text-xs text-muted-foreground">
                              Impact: {activity.impact_score}/10
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* SWOT Summary */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <h5 className="font-medium text-green-600 mb-1">Strengths</h5>
                    <ul className="list-disc list-inside text-muted-foreground">
                      {competitor.strengths.slice(0, 2).map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h5 className="font-medium text-red-600 mb-1">Weaknesses</h5>
                    <ul className="list-disc list-inside text-muted-foreground">
                      {competitor.weaknesses.slice(0, 2).map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Market Trends Tab */}
        <TabsContent value="market" className="space-y-4">
          {marketData.map((market, idx) => (
            <Card key={idx}>
              <CardHeader>
                <CardTitle>{market.sector}</CardTitle>
                <CardDescription>
                  Market size: ${(market.market_size / 1000000000).toFixed(1)}B •
                  Growth: {market.growth_rate}%
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Key Trends */}
                <div>
                  <h4 className="text-sm font-medium mb-2">Key Trends</h4>
                  <div className="space-y-2">
                    {market.key_trends.map((trend, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Badge
                          variant={
                            trend.impact === "positive"
                              ? "default"
                              : trend.impact === "negative"
                              ? "destructive"
                              : "secondary"
                          }
                          className="text-xs"
                        >
                          {trend.impact}
                        </Badge>
                        <span className="text-sm">{trend.trend}</span>
                        <span className="text-xs text-muted-foreground">
                          ({trend.timeframe})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Opportunities */}
                {market.opportunities.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Opportunities</h4>
                    {market.opportunities.map((opp, i) => (
                      <Alert key={i} className="mb-2">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          <div className="font-medium">{opp.opportunity}</div>
                          <div className="text-xs mt-1">
                            Potential: ${(opp.potential_value / 1000000).toFixed(1)}M •
                            Timeline: {opp.time_to_capture}
                          </div>
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Regulations Tab */}
        <TabsContent value="regulations" className="space-y-4">
          {regulations.map((regulation) => (
            <Card key={regulation.regulation_id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{regulation.title}</CardTitle>
                    <CardDescription>
                      {regulation.authority} • Effective: {new Date(regulation.effective_date).toLocaleDateString()}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant={regulation.impact_assessment.urgency === "high" ? "destructive" : "secondary"}>
                      {regulation.impact_assessment.urgency} urgency
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm mb-4">{regulation.summary}</p>

                {regulation.compliance_deadline && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Compliance deadline: {new Date(regulation.compliance_deadline).toLocaleDateString()}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="mt-4">
                  <h5 className="text-sm font-medium mb-2">Key Requirements</h5>
                  <ul className="list-disc list-inside text-sm text-muted-foreground">
                    {regulation.key_requirements.map((req, i) => (
                      <li key={i}>{req}</li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Economics Tab */}
        <TabsContent value="economics" className="space-y-4">
          {cpiData && (
            <Card>
              <CardHeader>
                <CardTitle>UAE Consumer Price Index</CardTitle>
                <CardDescription>
                  Latest data: {new Date(cpiData.date).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div>
                    <p className="text-sm text-muted-foreground">Overall CPI</p>
                    <p className="text-2xl font-bold">{cpiData.overall_cpi}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">YoY Change</p>
                    <p className="text-2xl font-bold">{cpiData.yoy_change}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">MoM Change</p>
                    <p className="text-2xl font-bold">{cpiData.mom_change}%</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h5 className="text-sm font-medium">Category Breakdown</h5>
                  {cpiData.categories.map((cat) => (
                    <div key={cat.category}>
                      <div className="flex justify-between text-sm mb-1">
                        <span>{cat.category}</span>
                        <span className="font-medium">{cat.change}%</span>
                      </div>
                      <Progress value={cat.index - 100} className="h-2" />
                    </div>
                  ))}
                </div>

                <Alert className="mt-4">
                  <TrendingUp className="h-4 w-4" />
                  <AlertDescription>
                    <div className="font-medium">Forecast</div>
                    <div className="text-sm">
                      Next quarter: {cpiData.forecast.next_quarter} ({(cpiData.forecast.confidence * 100).toFixed(0)}% confidence)
                    </div>
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Real Estate Tab */}
        <TabsContent value="realestate" className="space-y-4">
          {realEstate.map((property, idx) => (
            <Card key={idx}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{property.location}</CardTitle>
                    <CardDescription>
                      {property.property_type} • AED {property.avg_price_sqft}/sqft
                    </CardDescription>
                  </div>
                  <Badge variant={property.yoy_change > 0 ? "default" : "destructive"}>
                    {property.yoy_change > 0 ? "+" : ""}{property.yoy_change}% YoY
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <h5 className="text-sm font-medium mb-2">Supply Metrics</h5>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <div>Current: {property.supply.current.toLocaleString()} units</div>
                      <div>Upcoming: {property.supply.upcoming.toLocaleString()} units</div>
                      <div>Absorption: {(property.supply.absorption_rate * 100).toFixed(0)}%</div>
                    </div>
                  </div>
                  <div>
                    <h5 className="text-sm font-medium mb-2">Demand Indicators</h5>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <div>Occupancy: {(property.demand_indicators.occupancy_rate * 100).toFixed(0)}%</div>
                      <div>Rental Yield: {property.demand_indicators.rental_yield}%</div>
                      <div>Transactions: {property.demand_indicators.transaction_volume}/month</div>
                    </div>
                  </div>
                </div>

                <Alert>
                  <Home className="h-4 w-4" />
                  <AlertDescription>
                    <div className="font-medium">Forecast</div>
                    <div className="text-sm">
                      Next year: AED {property.forecast.next_year}/sqft
                      <div className="text-xs mt-1">
                        Drivers: {property.forecast.drivers.join(", ")}
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  )
}