import { useState } from 'react'
import { motion } from 'framer-motion'
import { Download, RefreshCw, TrendingUp, TrendingDown, Loader2 } from 'lucide-react'
import { exportElementToPdf } from '@/lib/exportElementPdf'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { Button, Card, Badge } from '@/components/ui'
import { fadeInUp } from '@/lib/motion'
import { useReports } from '@/hooks/useReports'
import type { Period } from '@/hooks/useReports'

export function ReportsPage() {
  const [period, setPeriod] = useState<Period>('12m')
  const [exporting, setExporting] = useState(false)
  const { data, loading, usingFallback, refresh } = useReports(period)
  const { kpiCards, revenueData, revenueByService, projectPerformance, invoiceStatus, teamUtilization } = data

  const avgUtilization =
    teamUtilization.length > 0
      ? Math.round(teamUtilization.reduce((s, t) => s + t.utilization, 0) / teamUtilization.length)
      : 0

  const handleExport = async () => {
    setExporting(true)
    try {
      const stamp = new Date().toISOString().slice(0, 10)
      await exportElementToPdf({ elementId: 'reports-pdf-root', fileNameBase: `reports-${period}-${stamp}` })
    } catch (err) {
      console.error('PDF export failed:', err)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-8" id="reports-pdf-root">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Reports & Analytics</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Business performance insights and trends
            {usingFallback && (
              <span className="ml-2 text-2xs uppercase tracking-wider text-warning-600 font-semibold">Offline — demo data</span>
            )}
            {loading && !usingFallback && (
              <Loader2 className="inline-block ml-2 h-3 w-3 animate-spin text-neutral-400" />
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-neutral-100 rounded-lg p-0.5">
            {(['7d', '30d', '90d', '12m'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                  period === p ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <Button variant="secondary" size="sm" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={refresh}>
            Refresh
          </Button>
          <Button
            size="sm"
            icon={exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? 'Exporting…' : 'Export PDF'}
          </Button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpiCards.map((kpi) => (
          <motion.div key={kpi.label} {...fadeInUp}>
            <Card>
              <p className="text-[10px] font-medium text-neutral-400 uppercase tracking-wider mb-1">{kpi.label}</p>
              <p className="text-lg font-bold text-neutral-900">{kpi.value}</p>
              <div className="flex items-center gap-1 mt-1">
                {kpi.change !== 0 && (
                  <>
                    {kpi.change > 0 ? (
                      <TrendingUp className="h-3 w-3 text-success-500" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-danger-500" />
                    )}
                    <span className={`text-[10px] font-medium ${kpi.change > 0 ? 'text-success-600' : 'text-danger-600'}`}>
                      {kpi.change > 0 ? '+' : ''}{kpi.change}%
                    </span>
                  </>
                )}
                <span className="text-[10px] text-neutral-400">{kpi.period}</span>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Revenue Chart + Revenue by Service */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-semibold text-neutral-900">Revenue & Expenses</h3>
              <p className="text-xs text-neutral-500 mt-0.5">Monthly trend over the last 8 months · expenses estimated from project cost roll-up</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-brand-500" />
                <span className="text-neutral-500">Revenue</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-neutral-300" />
                <span className="text-neutral-500">Expenses</span>
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={revenueData}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ff5b01" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#ff5b01" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#a3a3a3' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#a3a3a3' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v / 1000}k`} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: '1px solid #e5e5e5', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: 12 }}
                formatter={(value) => [`$${Number(value ?? 0).toLocaleString()}`, '']}
              />
              <Area type="monotone" dataKey="revenue" stroke="#ff5b01" strokeWidth={2} fill="url(#revenueGradient)" />
              <Area type="monotone" dataKey="expenses" stroke="#d4d4d4" strokeWidth={1.5} fill="transparent" strokeDasharray="4 4" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-neutral-900 mb-1">Revenue by Service</h3>
          <p className="text-xs text-neutral-500 mb-4">Distribution across service lines</p>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={revenueByService}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={75}
                paddingAngle={3}
                dataKey="value"
              >
                {revenueByService.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ borderRadius: 8, border: '1px solid #e5e5e5', fontSize: 12 }}
                formatter={(value) => [`${Number(value ?? 0)}%`, '']}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-2">
            {revenueByService.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-neutral-600">{item.name}</span>
                </div>
                <span className="font-medium text-neutral-900">{item.value}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Project Budget + Invoice Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-semibold text-neutral-900">Project Budget vs Spend</h3>
              <p className="text-xs text-neutral-500 mt-0.5">Active project financial health</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={projectPerformance} layout="vertical" barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#a3a3a3' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v / 1000}k`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#525252' }} axisLine={false} tickLine={false} width={100} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: '1px solid #e5e5e5', fontSize: 12 }}
                formatter={(value) => [`$${Number(value ?? 0).toLocaleString()}`, '']}
              />
              <Bar dataKey="budget" fill="#e5e5e5" radius={[0, 4, 4, 0]} barSize={14} name="Budget" />
              <Bar dataKey="spent" fill="#ff5b01" radius={[0, 4, 4, 0]} barSize={14} name="Spent" />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-neutral-900 mb-1">Invoice Status</h3>
          <p className="text-xs text-neutral-500 mb-4">Current invoice breakdown</p>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={invoiceStatus}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={75}
                paddingAngle={3}
                dataKey="value"
              >
                {invoiceStatus.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ borderRadius: 8, border: '1px solid #e5e5e5', fontSize: 12 }}
                formatter={(value) => [`${Number(value ?? 0)}%`, '']}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-2">
            {invoiceStatus.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-neutral-600">{item.name}</span>
                </div>
                <span className="font-medium text-neutral-900">{item.value}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Team Utilization */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">Team Utilization by Department</h3>
            <p className="text-xs text-neutral-500 mt-0.5">Billable hours as percentage of capacity</p>
          </div>
          <Badge variant={avgUtilization >= 80 ? 'success' : avgUtilization >= 60 ? 'warning' : 'danger'}>
            {avgUtilization}% avg
          </Badge>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={teamUtilization}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#525252' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#a3a3a3' }} axisLine={false} tickLine={false} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
            <Tooltip
              contentStyle={{ borderRadius: 8, border: '1px solid #e5e5e5', fontSize: 12 }}
              formatter={(value) => [`${Number(value ?? 0)}%`, 'Utilization']}
            />
            <Bar dataKey="utilization" radius={[4, 4, 0, 0]} barSize={40}>
              {teamUtilization.map((entry, i) => (
                <Cell key={i} fill={entry.utilization >= 80 ? '#ff5b01' : entry.utilization >= 60 ? '#f59e0b' : '#ef4444'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  )
}
