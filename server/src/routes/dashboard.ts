import { Router } from 'express'

export const dashboardRouter = Router()

dashboardRouter.get('/metrics', (_req, res) => {
  res.json({
    data: {
      mrr: 47200,
      mrrChange: 12.5,
      activeProjects: 12,
      newProjectsThisWeek: 2,
      openInvoices: 18400,
      invoiceChange: -8,
      teamOnline: 8,
      teamTotal: 11,
    },
  })
})

dashboardRouter.get('/projects', (_req, res) => {
  res.json({
    data: [
      { id: '1', name: 'RestaurantOS', client: 'Bella Cucina', progress: 72, health: 'on-track', value: 18000 },
      { id: '2', name: 'BookingApp', client: 'CareFirst Health', progress: 45, health: 'at-risk', value: 24000 },
      { id: '3', name: 'E-Commerce v3', client: 'Urban Threads', progress: 90, health: 'on-track', value: 12000 },
      { id: '4', name: 'SaaS Dashboard', client: 'DataFlow Inc', progress: 28, health: 'on-track', value: 32000 },
      { id: '5', name: 'Mobile App', client: 'FitTrack', progress: 15, health: 'delayed', value: 22000 },
    ],
  })
})

dashboardRouter.get('/pulse', (_req, res) => {
  res.json({
    data: {
      mrr: 47200,
      openInvoices: 18400,
      tasksInProgress: 34,
      hotLeads: 7,
      overdueBugs: 3,
    },
  })
})

dashboardRouter.get('/team-today', (_req, res) => {
  res.json({
    data: [
      { id: '1', name: 'Sarah Chen', role: 'Lead Developer', status: 'online', task: 'API Integration', hours: '4h 32m' },
      { id: '2', name: 'James Wilson', role: 'Designer', status: 'busy', task: 'Brand Kit Review', hours: '3h 15m' },
      { id: '3', name: 'Maria Garcia', role: 'Sales Rep', status: 'online', task: 'Client Outreach', hours: '5h 08m' },
      { id: '4', name: 'Alex Kim', role: 'Developer', status: 'away', task: 'Bug Fix #247', hours: '2h 45m' },
      { id: '5', name: 'David Park', role: 'Operations', status: 'online', task: 'SLA Audit', hours: '4h 10m' },
    ],
  })
})
