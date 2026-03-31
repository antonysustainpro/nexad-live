"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Bitcoin,
  Globe2,
  Search,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getStock, getForex, getCrypto, searchFinance } from "@/lib/api"
import { toast } from "sonner"

interface WatchlistItem {
  type: "stock" | "forex" | "crypto"
  symbol: string
  name?: string
  price?: number
  change?: number
  changePercent?: number
  lastUpdate?: string
}

const POPULAR_STOCKS = ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA"]
const FOREX_PAIRS = [
  { from: "USD", to: "AED", name: "USD/AED" },
  { from: "EUR", to: "AED", name: "EUR/AED" },
  { from: "GBP", to: "AED", name: "GBP/AED" },
  { from: "USD", to: "EUR", name: "USD/EUR" },
  { from: "GBP", to: "USD", name: "GBP/USD" },
]
const POPULAR_CRYPTO = ["BTC", "ETH", "BNB", "ADA", "SOL"]

export default function FinancePage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState("stocks")
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])

  // Stock state
  const [stockSymbol, setStockSymbol] = useState("AAPL")
  const [stockData, setStockData] = useState<any>(null)

  // Forex state
  const [forexFrom, setForexFrom] = useState("USD")
  const [forexTo, setForexTo] = useState("AED")
  const [forexData, setForexData] = useState<any>(null)

  // Crypto state
  const [cryptoSymbol, setCryptoSymbol] = useState("BTC")
  const [cryptoData, setCryptoData] = useState<any>(null)

  useEffect(() => {
    // Load initial data for each tab
    if (activeTab === "stocks" && !stockData) {
      loadStockData(stockSymbol)
    } else if (activeTab === "forex" && !forexData) {
      loadForexData(forexFrom, forexTo)
    } else if (activeTab === "crypto" && !cryptoData) {
      loadCryptoData(cryptoSymbol)
    }
  }, [activeTab])

  async function loadStockData(symbol: string) {
    setLoading(true)
    try {
      const data = await getStock(symbol)
      setStockData(data)
    } catch (error) {
      toast.error(`We couldn't load ${symbol} data. Showing demo values.`)
      // Demo fallback data
      setStockData({
        symbol,
        price: 185.92,
        open: 183.41,
        high: 186.10,
        low: 182.93,
        volume: 54116725,
        change: 2.51,
        changePercent: 1.37,
        marketCap: 2865000000000,
        pe: 31.5,
      })
    } finally {
      setLoading(false)
    }
  }

  async function loadForexData(from: string, to: string) {
    setLoading(true)
    try {
      const data = await getForex(from, to)
      setForexData(data)
    } catch (error) {
      toast.error(`We couldn't load the ${from}/${to} rate. Showing demo values.`)
      // Demo fallback data
      setForexData({
        from,
        to,
        rate: from === "USD" && to === "AED" ? 3.6725 : 0.8523,
        timestamp: new Date().toISOString(),
        change: 0.0012,
        changePercent: 0.03,
      })
    } finally {
      setLoading(false)
    }
  }

  async function loadCryptoData(symbol: string) {
    setLoading(true)
    try {
      const data = await getCrypto(symbol)
      setCryptoData(data)
    } catch (error) {
      toast.error(`We couldn't load ${symbol} data. Showing demo values.`)
      // Demo fallback data
      setCryptoData({
        symbol,
        price: symbol === "BTC" ? 68450 : symbol === "ETH" ? 3850 : 580,
        market: "Binance",
        volume24h: 28500000000,
        marketCap: symbol === "BTC" ? 1340000000000 : 463000000000,
        change24h: 1250,
        changePercent24h: 1.86,
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return

    setLoading(true)
    try {
      const results = await searchFinance(searchQuery)
      setSearchResults(results)
    } catch (error) {
      toast.error("Search didn't complete. Please try again.")
      // Demo results
      setSearchResults([
        { symbol: "AAPL", name: "Apple Inc.", type: "stock", exchange: "NASDAQ" },
        { symbol: "MSFT", name: "Microsoft Corporation", type: "stock", exchange: "NASDAQ" },
      ])
    } finally {
      setLoading(false)
    }
  }

  function addToWatchlist(item: WatchlistItem) {
    if (watchlist.find(w => w.symbol === item.symbol && w.type === item.type)) {
      toast.info("Already in watchlist")
      return
    }
    setWatchlist([...watchlist, item])
    toast.success(`Added ${item.symbol} to watchlist`)
  }

  function removeFromWatchlist(symbol: string, type: string) {
    setWatchlist(watchlist.filter(w => !(w.symbol === symbol && w.type === type)))
  }

  const formatPrice = (price: number, currency?: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(price)
  }

  const formatChange = (change: number, percent: number) => {
    const isPositive = change >= 0
    return (
      <div className={`flex items-center gap-1 ${isPositive ? "text-green-600" : "text-red-600"}`}>
        {isPositive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
        <span>{isPositive ? "+" : ""}{change.toFixed(2)}</span>
        <span className="text-sm">({isPositive ? "+" : ""}{percent.toFixed(2)}%)</span>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Finance Dashboard</h1>
          <p className="text-muted-foreground">
            Real-time market data and financial insights
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex gap-2">
            <Input
              placeholder="Search stocks, forex, crypto..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="w-64"
            />
            <Button onClick={handleSearch} size="icon" variant="ghost">
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Search Results</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Exchange</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {searchResults.map((result) => (
                  <TableRow key={`${result.type}-${result.symbol}`}>
                    <TableCell className="font-medium">{result.symbol}</TableCell>
                    <TableCell>{result.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{result.type}</Badge>
                    </TableCell>
                    <TableCell>{result.exchange || "Global"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => addToWatchlist({
                          type: result.type,
                          symbol: result.symbol,
                          name: result.name,
                        })}
                      >
                        Add to Watchlist
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Market Data */}
        <div className="lg:col-span-2">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="stocks">
                <TrendingUp className="mr-2 h-4 w-4" />
                Stocks
              </TabsTrigger>
              <TabsTrigger value="forex">
                <Globe2 className="mr-2 h-4 w-4" />
                Forex
              </TabsTrigger>
              <TabsTrigger value="crypto">
                <Bitcoin className="mr-2 h-4 w-4" />
                Crypto
              </TabsTrigger>
            </TabsList>

            {/* Stocks Tab */}
            <TabsContent value="stocks" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Stock Market</CardTitle>
                    <Select value={stockSymbol} onValueChange={(v) => {
                      setStockSymbol(v)
                      loadStockData(v)
                    }}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {POPULAR_STOCKS.map((symbol) => (
                          <SelectItem key={symbol} value={symbol}>
                            {symbol}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-48" />
                  ) : stockData ? (
                    <div className="space-y-4">
                      <div className="flex items-baseline justify-between">
                        <div>
                          <h2 className="text-3xl font-bold">{formatPrice(stockData.price)}</h2>
                          {formatChange(stockData.change, stockData.changePercent)}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => addToWatchlist({
                            type: "stock",
                            symbol: stockData.symbol,
                            price: stockData.price,
                            change: stockData.change,
                            changePercent: stockData.changePercent,
                          })}
                        >
                          Add to Watchlist
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Open</span>
                          <p className="font-medium">{formatPrice(stockData.open)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Volume</span>
                          <p className="font-medium">{(stockData.volume / 1000000).toFixed(1)}M</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">High</span>
                          <p className="font-medium">{formatPrice(stockData.high)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Low</span>
                          <p className="font-medium">{formatPrice(stockData.low)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Market Cap</span>
                          <p className="font-medium">${(stockData.marketCap / 1000000000000).toFixed(2)}T</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">P/E Ratio</span>
                          <p className="font-medium">{stockData.pe}</p>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Forex Tab */}
            <TabsContent value="forex" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Foreign Exchange</CardTitle>
                    <div className="flex gap-2">
                      <Select value={`${forexFrom}/${forexTo}`} onValueChange={(v) => {
                        const [from, to] = v.split("/")
                        setForexFrom(from)
                        setForexTo(to)
                        loadForexData(from, to)
                      }}>
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FOREX_PAIRS.map((pair) => (
                            <SelectItem key={pair.name} value={pair.name}>
                              {pair.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-48" />
                  ) : forexData ? (
                    <div className="space-y-4">
                      <div className="flex items-baseline justify-between">
                        <div>
                          <h2 className="text-3xl font-bold">{forexData.rate.toFixed(4)}</h2>
                          <p className="text-sm text-muted-foreground">
                            1 {forexData.from} = {forexData.rate} {forexData.to}
                          </p>
                          {forexData.change && formatChange(forexData.change, forexData.changePercent)}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => addToWatchlist({
                            type: "forex",
                            symbol: `${forexData.from}/${forexData.to}`,
                            price: forexData.rate,
                            change: forexData.change,
                            changePercent: forexData.changePercent,
                          })}
                        >
                          Add to Watchlist
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <Card>
                          <CardContent className="p-4">
                            <p className="text-sm text-muted-foreground">From</p>
                            <p className="text-lg font-semibold">{forexData.from}</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-4">
                            <p className="text-sm text-muted-foreground">To</p>
                            <p className="text-lg font-semibold">{forexData.to}</p>
                          </CardContent>
                        </Card>
                      </div>

                      <div className="text-xs text-muted-foreground">
                        Last updated: {new Date(forexData.timestamp).toLocaleString()}
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Crypto Tab */}
            <TabsContent value="crypto" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Cryptocurrency</CardTitle>
                    <Select value={cryptoSymbol} onValueChange={(v) => {
                      setCryptoSymbol(v)
                      loadCryptoData(v)
                    }}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {POPULAR_CRYPTO.map((symbol) => (
                          <SelectItem key={symbol} value={symbol}>
                            {symbol}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-48" />
                  ) : cryptoData ? (
                    <div className="space-y-4">
                      <div className="flex items-baseline justify-between">
                        <div>
                          <h2 className="text-3xl font-bold">{formatPrice(cryptoData.price)}</h2>
                          {cryptoData.change24h && formatChange(cryptoData.change24h, cryptoData.changePercent24h)}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => addToWatchlist({
                            type: "crypto",
                            symbol: cryptoData.symbol,
                            price: cryptoData.price,
                            change: cryptoData.change24h,
                            changePercent: cryptoData.changePercent24h,
                          })}
                        >
                          Add to Watchlist
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Market</span>
                          <p className="font-medium">{cryptoData.market}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">24h Volume</span>
                          <p className="font-medium">${(cryptoData.volume24h / 1000000000).toFixed(2)}B</p>
                        </div>
                        {cryptoData.marketCap && (
                          <>
                            <div>
                              <span className="text-muted-foreground">Market Cap</span>
                              <p className="font-medium">${(cryptoData.marketCap / 1000000000).toFixed(0)}B</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Symbol</span>
                              <p className="font-medium">{cryptoData.symbol}</p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Watchlist */}
        <div>
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Watchlist</CardTitle>
              <CardDescription>Your tracked assets</CardDescription>
            </CardHeader>
            <CardContent>
              {watchlist.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Add assets to your watchlist to track them here
                </p>
              ) : (
                <div className="space-y-2">
                  {watchlist.map((item, idx) => (
                    <div
                      key={`${item.type}-${item.symbol}-${idx}`}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {item.type}
                          </Badge>
                          <span className="font-medium">{item.symbol}</span>
                        </div>
                        {item.price && (
                          <div className="text-sm text-muted-foreground">
                            {formatPrice(item.price)}
                            {item.change !== undefined && item.changePercent !== undefined && (
                              <span className={item.change >= 0 ? "text-green-600" : "text-red-600"}>
                                {" "}({item.changePercent >= 0 ? "+" : ""}{item.changePercent.toFixed(2)}%)
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeFromWatchlist(item.symbol, item.type)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}