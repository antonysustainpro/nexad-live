"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
import {
  Shield,
  FileCheck,
  Download,
  Clock,
  AlertTriangle,
  AlertCircle,
  TrendingUp,
  Calendar,
  CheckCircle,
  XCircle,
  RefreshCw,
  FileText,
  DollarSign,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  getComplianceSummary,
  getCertificates,
  getAuditTrail,
  getCostBreakdown,
  getRetentionPolicies,
  downloadAuditTrail,
  downloadCertificate,
  exportComplianceData,
  type ComplianceSummary,
  type ComplianceCertificate,
  type AuditEntry,
  type CostBreakdown,
  type RetentionPolicy,
} from "@/lib/compliance-api"
import { toast } from "sonner"
import { formatDistanceToNow, format } from "date-fns"

export default function CompliancePage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("overview")

  // Data states
  const [summary, setSummary] = useState<ComplianceSummary | null>(null)
  const [certificates, setCertificates] = useState<ComplianceCertificate[]>([])
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([])
  const [costBreakdown, setCostBreakdown] = useState<CostBreakdown | null>(null)
  const [retentionPolicies, setRetentionPolicies] = useState<RetentionPolicy[]>([])

  useEffect(() => {
    if (user?.id) {
      loadComplianceData()
    }
  }, [user])

  async function loadComplianceData() {
    setLoading(true)
    try {
      const [summaryData, certs, audit, costs, policies] = await Promise.all([
        getComplianceSummary(user!.id),
        getCertificates(user!.id, { status: "all" }),
        getAuditTrail(user!.id, { limit: 50 }),
        getCostBreakdown(user!.id),
        getRetentionPolicies({ active_only: true }),
      ])

      setSummary(summaryData)
      setCertificates(certs)
      setAuditEntries(audit.entries)
      setCostBreakdown(costs)
      setRetentionPolicies(policies)
    } catch (error) {
      console.error("Failed to load compliance data:", error)
      toast.error("Failed to load compliance data")
    } finally {
      setLoading(false)
    }
  }

  async function handleDownloadAuditTrail() {
    try {
      const blob = await downloadAuditTrail(user!.id, {
        from_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        format: "pdf",
      })

      // Create download link
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `audit-trail-${new Date().toISOString().split("T")[0]}.pdf`
      a.click()
      URL.revokeObjectURL(url)

      toast.success("Audit trail downloaded")
    } catch (error) {
      toast.error("Failed to download audit trail")
    }
  }

  async function handleDownloadCertificate(certId: string) {
    try {
      const blob = await downloadCertificate(certId)

      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `certificate-${certId}.pdf`
      a.click()
      URL.revokeObjectURL(url)

      toast.success("Certificate downloaded")
    } catch (error) {
      toast.error("Failed to download certificate")
    }
  }

  async function handleExportAllData() {
    try {
      const blob = await exportComplianceData({
        include_audit: true,
        include_certificates: true,
        include_policies: true,
        format: "zip",
      })

      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `compliance-export-${new Date().toISOString().split("T")[0]}.zip`
      a.click()
      URL.revokeObjectURL(url)

      toast.success("Compliance data exported")
    } catch (error) {
      toast.error("Failed to export compliance data")
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "compliant":
      case "active":
        return "default"
      case "partial":
      case "pending":
        return "secondary"
      case "non-compliant":
      case "expired":
        return "destructive"
      default:
        return "outline"
    }
  }

  const getRiskColor = (level: string) => {
    switch (level) {
      case "low":
        return "text-green-600"
      case "medium":
        return "text-yellow-600"
      case "high":
        return "text-orange-600"
      case "critical":
        return "text-red-600"
      default:
        return "text-gray-600"
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
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
          <h1 className="text-3xl font-bold tracking-tight">Compliance Center</h1>
          <p className="text-muted-foreground">
            Enterprise compliance management and audit tracking
          </p>
        </div>
        <Button onClick={handleExportAllData}>
          <Download className="mr-2 h-4 w-4" />
          Export All Data
        </Button>
      </div>

      {/* Key Metrics */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overall Score</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.overall_score}%</div>
              <Progress value={summary.overall_score} className="mt-2 h-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Certificates</CardTitle>
              <FileCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {certificates.filter(c => c.status === "active").length}
              </div>
              <p className="text-xs text-muted-foreground">
                of {certificates.length} total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Critical Issues</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {summary.standards.reduce((sum, s) => sum + s.critical_issues, 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                Requires immediate attention
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monthly Cost</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {costBreakdown?.currency} {costBreakdown?.total_cost.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                Compliance operations
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Upcoming Deadlines Alert */}
      {summary && summary.upcoming_deadlines.length > 0 && (
        <Alert>
          <Clock className="h-4 w-4" />
          <AlertTitle>Upcoming Compliance Deadlines</AlertTitle>
          <AlertDescription>
            <div className="mt-2 space-y-1">
              {summary.upcoming_deadlines.slice(0, 3).map((deadline, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="text-sm">{deadline.requirement}</span>
                  <Badge variant={deadline.days_remaining < 30 ? "destructive" : "secondary"}>
                    {deadline.days_remaining} days
                  </Badge>
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="certificates">Certificates</TabsTrigger>
          <TabsTrigger value="audit">Audit Trail</TabsTrigger>
          <TabsTrigger value="costs">Cost Analysis</TabsTrigger>
          <TabsTrigger value="retention">Retention</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          {summary && (
            <>
              {/* Standards Compliance */}
              <Card>
                <CardHeader>
                  <CardTitle>Compliance Standards</CardTitle>
                  <CardDescription>
                    Current compliance status across all standards
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {summary.standards.map((standard, idx) => (
                      <div key={idx} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">{standard.standard}</h4>
                            <p className="text-sm text-muted-foreground">
                              Last audit: {format(new Date(standard.last_audit), "PPP")}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={getStatusColor(standard.status)}>
                              {standard.status}
                            </Badge>
                            {standard.critical_issues > 0 && (
                              <Badge variant="destructive">
                                {standard.critical_issues} critical
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Progress value={standard.score} className="h-2" />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Score: {standard.score}%</span>
                          <span>{standard.issues} total issues</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Risk Areas */}
              <Card>
                <CardHeader>
                  <CardTitle>Risk Areas</CardTitle>
                  <CardDescription>
                    Areas requiring attention and remediation
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {summary.risk_areas.map((risk, idx) => (
                      <Alert key={idx} variant="default">
                        <AlertTriangle className={`h-4 w-4 ${getRiskColor(risk.risk_level)}`} />
                        <AlertTitle className="flex items-center gap-2">
                          {risk.area}
                          <Badge variant="secondary" className="text-xs">
                            {risk.risk_level}
                          </Badge>
                        </AlertTitle>
                        <AlertDescription className="mt-2">
                          <p className="text-sm">{risk.description}</p>
                          <p className="text-sm font-medium mt-1">
                            Remediation: {risk.remediation}
                          </p>
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Certificates Tab */}
        <TabsContent value="certificates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Compliance Certificates</CardTitle>
              <CardDescription>
                Active and historical compliance certifications
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Issued</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {certificates.map((cert) => (
                    <TableRow key={cert.cert_id}>
                      <TableCell className="font-medium">
                        {cert.type.toUpperCase()}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusColor(cert.status)}>
                          {cert.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{format(new Date(cert.issued_date), "PP")}</TableCell>
                      <TableCell>{format(new Date(cert.expiry_date), "PP")}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {cert.scope.slice(0, 2).map((s, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {s}
                            </Badge>
                          ))}
                          {cert.scope.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{cert.scope.length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDownloadCertificate(cert.cert_id)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Trail Tab */}
        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Audit Trail</CardTitle>
                  <CardDescription>
                    Complete activity log for compliance tracking
                  </CardDescription>
                </div>
                <Button onClick={handleDownloadAuditTrail} size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  Download PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Risk</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditEntries.slice(0, 10).map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>
                        {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
                      </TableCell>
                      <TableCell>{entry.user_name}</TableCell>
                      <TableCell>{entry.action}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {entry.resource_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {entry.status === "success" ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={entry.risk_level === "high" ? "destructive" : "secondary"}>
                          {entry.risk_level}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cost Analysis Tab */}
        <TabsContent value="costs" className="space-y-4">
          {costBreakdown && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Compliance Cost Breakdown</CardTitle>
                  <CardDescription>
                    Monthly operational costs for compliance activities
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {costBreakdown.categories.map((category) => (
                      <div key={category.category}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{category.category}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm">
                              {costBreakdown.currency} {category.cost.toLocaleString()}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {category.percentage}%
                            </Badge>
                            {category.trend === "up" && <TrendingUp className="h-3 w-3 text-red-500" />}
                            {category.trend === "down" && <TrendingUp className="h-3 w-3 text-green-500 rotate-180" />}
                          </div>
                        </div>
                        <Progress value={category.percentage} className="h-2" />
                      </div>
                    ))}
                  </div>

                  {costBreakdown.optimization_suggestions.length > 0 && (
                    <Alert className="mt-6">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Cost Optimization Opportunities</AlertTitle>
                      <AlertDescription>
                        <ul className="list-disc list-inside mt-2 space-y-1">
                          {costBreakdown.optimization_suggestions.map((suggestion, idx) => (
                            <li key={idx} className="text-sm">{suggestion}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Retention Policies Tab */}
        <TabsContent value="retention" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Data Retention Policies</CardTitle>
              <CardDescription>
                Active data retention and deletion policies
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Policy Name</TableHead>
                    <TableHead>Data Type</TableHead>
                    <TableHead>Retention Period</TableHead>
                    <TableHead>Deletion Method</TableHead>
                    <TableHead>Auto Apply</TableHead>
                    <TableHead>Last Applied</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {retentionPolicies.map((policy) => (
                    <TableRow key={policy.policy_id}>
                      <TableCell className="font-medium">{policy.name}</TableCell>
                      <TableCell>{policy.data_type}</TableCell>
                      <TableCell>{policy.retention_period_days} days</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{policy.deletion_method}</Badge>
                      </TableCell>
                      <TableCell>
                        {policy.auto_apply ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-gray-400" />
                        )}
                      </TableCell>
                      <TableCell>
                        {policy.last_applied
                          ? formatDistanceToNow(new Date(policy.last_applied), { addSuffix: true })
                          : "Never"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}