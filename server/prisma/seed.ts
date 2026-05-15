import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

// ───────────────────────────────────────────
// LixiOps seed script.
//
// Safe modes:
//   npm run db:seed         → minimal seed (CEO + departments only).
//                             Safe to run in production for first boot.
//   npm run db:seed:demo    → full demo dataset (clients, leads, projects,
//                             tasks, invoices, OKRs, etc.). Dev/staging only.
//
// All writes are idempotent via upserts — re-running won't error or
// duplicate. Existing rows are left as-is.
//
// First-boot credentials (CEO):
//   email:    ceo@lixiops.local
//   password: ChangeMe123!
// ── Rotate this password immediately after first login. ──
// ───────────────────────────────────────────

const prisma = new PrismaClient()
const BCRYPT_COST = 12

// Read CEO bootstrap creds from env so production never has the default in code.
// IMPORTANT: lowercase the email — the login route normalizes via Zod's
// toLowerCase(), so the stored email must match the lowercased form or lookups
// fail silently with a 401.
const CEO_EMAIL = (process.env.SEED_CEO_EMAIL ?? 'ceo@lixiops.local').trim().toLowerCase()
const CEO_PASSWORD = process.env.SEED_CEO_PASSWORD ?? 'ChangeMe123!'
const CEO_NAME = process.env.SEED_CEO_NAME ?? 'CEO'

const DEMO_MODE = process.argv.includes('--demo')

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('LixiOps — seeding database')
  console.log(`Mode: ${DEMO_MODE ? 'DEMO (full dataset)' : 'MINIMAL (CEO + departments)'}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  // 1. Departments — required so users can be assigned + OKRs can be created
  const departments = await seedDepartments()

  // 2. CEO user — bootstrap login. Always required.
  const ceo = await seedCEO(departments.management.id)

  if (!DEMO_MODE) {
    console.log('\n✓ Minimal seed complete.')
    console.log('\nLogin with:')
    console.log(`  email:    ${CEO_EMAIL}`)
    console.log(`  password: ${CEO_PASSWORD}`)
    console.log('\n⚠ Rotate this password immediately after first login.')
    return
  }

  // 3. Demo team — additional employees with different roles
  const team = await seedTeam(departments)

  // 4. Demo clients
  const clients = await seedClients()

  // 5. Demo leads (pipeline)
  await seedLeads(team)

  // 6. Demo projects (CLOSED_WON leads converted) + milestones
  const projects = await seedProjects(clients)

  // 7. Demo invoices
  await seedInvoices(clients, projects, ceo.id)

  // 8. Demo OKRs for the current quarter
  await seedOKRs(departments)

  // 9. Demo tasks for the sprint board
  await seedTasks(projects, team)

  // 10. Demo knowledge articles
  await seedKnowledge(ceo.id)

  console.log('\n✓ Full demo seed complete.')
  console.log(`  Departments: ${Object.keys(departments).length}`)
  console.log(`  Users:       ${Object.keys(team).length + 1}`)
  console.log(`  Clients:     ${clients.length}`)
  console.log(`  Projects:    ${projects.length}`)
  console.log('\nLogin as the CEO with:')
  console.log(`  email:    ${CEO_EMAIL}`)
  console.log(`  password: ${CEO_PASSWORD}`)
}

// ─────────────────────────────────────────────────────────
async function seedDepartments() {
  console.log('\n→ Departments')
  const defs = [
    { key: 'company', name: 'Company', description: 'Org-wide objectives' },
    { key: 'management', name: 'Management', description: 'Leadership team' },
    { key: 'development', name: 'Development', description: 'Engineering' },
    { key: 'design', name: 'Design', description: 'Brand and product design' },
    { key: 'sales', name: 'Sales', description: 'Pipeline + revenue' },
    { key: 'operations', name: 'Operations', description: 'Delivery + client success' },
    { key: 'people', name: 'People', description: 'HR and culture' },
  ]
  const out: Record<string, { id: string; name: string }> = {}
  for (const d of defs) {
    const dept = await prisma.department.upsert({
      where: { name: d.name },
      create: { name: d.name, description: d.description, budget: 0 },
      update: {},
    })
    out[d.key] = { id: dept.id, name: dept.name }
    console.log(`  · ${d.name}`)
  }
  return out as Record<'company' | 'management' | 'development' | 'design' | 'sales' | 'operations' | 'people', { id: string; name: string }>
}

async function seedCEO(managementDeptId: string) {
  console.log('\n→ CEO user')
  const passwordHash = bcrypt.hashSync(CEO_PASSWORD, BCRYPT_COST)
  const ceo = await prisma.user.upsert({
    where: { email: CEO_EMAIL },
    create: {
      email: CEO_EMAIL,
      name: CEO_NAME,
      role: 'CEO',
      passwordHash,
      departmentId: managementDeptId,
      isActive: true,
    },
    update: {
      // Don't overwrite the password on re-seed — keep whatever the user set.
      isActive: true,
    },
  })
  console.log(`  · ${ceo.email}`)
  return ceo
}

// ─────────────────────────────────────────────────────────
// DEMO data below — only runs with --demo flag
// ─────────────────────────────────────────────────────────

async function seedTeam(departments: Record<string, { id: string }>) {
  console.log('\n→ Team members (demo)')
  const team = [
    { key: 'sarah', email: 'sarah@codelixi.com', name: 'Sarah Chen', role: 'MANAGER', dept: 'development' },
    { key: 'amir', email: 'amir@codelixi.com', name: 'Amir Khan', role: 'EMPLOYEE', dept: 'design' },
    { key: 'emily', email: 'emily@codelixi.com', name: 'Emily Torres', role: 'MANAGER', dept: 'operations' },
    { key: 'raj', email: 'raj@codelixi.com', name: 'Raj Patel', role: 'EMPLOYEE', dept: 'development' },
    { key: 'david', email: 'david@codelixi.com', name: 'David Park', role: 'EMPLOYEE', dept: 'development' },
    { key: 'zara', email: 'zara@codelixi.com', name: 'Zara Ahmed', role: 'MANAGER', dept: 'sales' },
    { key: 'hira', email: 'hira@codelixi.com', name: 'Hira Malik', role: 'MANAGER', dept: 'people' },
  ] as const

  const out: Record<string, { id: string; name: string; role: string }> = {}
  const sharedHash = bcrypt.hashSync('Demo1234!', BCRYPT_COST)

  for (const t of team) {
    const u = await prisma.user.upsert({
      where: { email: t.email },
      create: {
        email: t.email,
        name: t.name,
        role: t.role as any,
        passwordHash: sharedHash,
        departmentId: departments[t.dept].id,
        isActive: true,
      },
      update: {},
    })
    out[t.key] = { id: u.id, name: u.name, role: u.role }
    console.log(`  · ${t.name} (${t.role})`)
  }
  return out
}

async function seedClients() {
  console.log('\n→ Clients (demo)')
  const defs = [
    { company: 'Bella Cucina', contactName: 'Marco Rossi', email: 'marco@bellacucina.com', vertical: 'Hospitality', contractValue: 6000, healthScore: 92, npsScore: 8 },
    { company: 'CareFirst Health', contactName: 'Dr. Patel', email: 'patel@carefirst.com', vertical: 'Healthcare', contractValue: 8000, healthScore: 72, npsScore: 7 },
    { company: 'DataFlow Inc', contactName: 'Megan Park', email: 'megan@dataflow.io', vertical: 'SaaS', contractValue: 12000, healthScore: 58, npsScore: 5 },
    { company: 'Urban Threads', contactName: 'Lara Kim', email: 'lara@urbanthreads.co', vertical: 'Retail', contractValue: 4500, healthScore: 85, npsScore: 7 },
    { company: 'Swift Logistics', contactName: 'Carlos Reyes', email: 'carlos@swiftlog.com', vertical: 'Logistics', contractValue: 9200, healthScore: 88, npsScore: 8 },
  ]
  const out = []
  for (const c of defs) {
    const client = await prisma.client.upsert({
      where: { email: c.email },
      create: { ...c, status: 'active' },
      update: {},
    })
    out.push(client)
    console.log(`  · ${c.company}`)
  }
  return out
}

async function seedLeads(team: Record<string, { id: string }>) {
  console.log('\n→ Leads (demo)')
  const leads = [
    { company: 'GreenTech Solutions', contactName: 'Sam Reed', email: 'sam@greentech.io', stage: 'NEGOTIATION', value: 28000, rep: 'zara' },
    { company: 'NorthStar Studio', contactName: 'Lia Wang', email: 'lia@northstar.studio', stage: 'PROPOSAL_SENT', value: 18000, rep: 'zara' },
    { company: 'Atlas Build Co', contactName: 'Jon Ferrari', email: 'jon@atlasbuild.com', stage: 'CONTACTED', value: 35000, rep: 'zara' },
    { company: 'Pivot Marketing', contactName: 'Ana Souza', email: 'ana@pivot.mx', stage: 'PROSPECT', value: 12000, rep: 'zara' },
  ]
  for (const l of leads) {
    const existing = await prisma.lead.findFirst({ where: { email: l.email } })
    if (existing) continue
    await prisma.lead.create({
      data: {
        company: l.company,
        contactName: l.contactName,
        email: l.email,
        stage: l.stage as any,
        value: l.value,
        repId: team[l.rep]?.id ?? null,
        lastActivityAt: new Date(Date.now() - Math.floor(Math.random() * 20) * 86_400_000),
      },
    })
    console.log(`  · ${l.company} (${l.stage})`)
  }
}

async function seedProjects(clients: { id: string; company: string }[]) {
  console.log('\n→ Projects + milestones (demo)')
  const out: { id: string; name: string }[] = []
  const defs = [
    { client: 'Bella Cucina', name: 'Bella Cucina Rebrand', contractValue: 25000, milestones: ['Discovery', 'Concepts', 'Final brand assets'] },
    { client: 'CareFirst Health', name: 'CareFirst Patient Portal', contractValue: 60000, milestones: ['Wireframes', 'Beta launch', 'Production rollout'] },
    { client: 'DataFlow Inc', name: 'DataFlow Dashboard v2', contractValue: 80000, milestones: ['Sprint 7', 'Sprint 8 deliverables', 'Sprint 9'] },
    { client: 'Urban Threads', name: 'Urban Threads E-Commerce', contractValue: 35000, milestones: ['Product catalog', 'Checkout flow', 'Launch'] },
  ]

  for (const p of defs) {
    const client = clients.find((c) => c.company === p.client)
    if (!client) continue
    const existing = await prisma.project.findFirst({ where: { clientId: client.id, name: p.name } })
    if (existing) {
      out.push({ id: existing.id, name: existing.name })
      continue
    }
    const project = await prisma.project.create({
      data: {
        name: p.name,
        clientId: client.id,
        contractValue: p.contractValue,
        startDate: new Date(Date.now() - 30 * 86_400_000),
        goLiveDate: new Date(Date.now() + 60 * 86_400_000),
      },
    })
    for (let i = 0; i < p.milestones.length; i++) {
      await prisma.milestone.create({
        data: {
          projectId: project.id,
          title: p.milestones[i],
          sortOrder: i,
          dueDate: new Date(Date.now() + (i + 1) * 14 * 86_400_000),
          isComplete: i === 0,
          completedAt: i === 0 ? new Date(Date.now() - 7 * 86_400_000) : null,
        },
      })
    }
    out.push({ id: project.id, name: project.name })
    console.log(`  · ${p.name}`)
  }
  return out
}

async function seedInvoices(clients: { id: string; company: string }[], projects: { id: string; name: string }[], ceoId: string) {
  console.log('\n→ Invoices (demo)')
  const defs = [
    { number: 'INV-2026-001', client: 'Bella Cucina', total: 6000, status: 'paid', daysOffset: -10, project: 'Bella Cucina Rebrand' },
    { number: 'INV-2026-002', client: 'CareFirst Health', total: 8000, status: 'sent', daysOffset: 5, project: 'CareFirst Patient Portal' },
    { number: 'INV-2026-003', client: 'Urban Threads', total: 4500, status: 'overdue', daysOffset: -3, project: 'Urban Threads E-Commerce' },
  ]
  for (const inv of defs) {
    const existing = await prisma.invoice.findUnique({ where: { invoiceNumber: inv.number } })
    if (existing) continue
    const client = clients.find((c) => c.company === inv.client)
    const project = projects.find((p) => p.name === inv.project)
    if (!client) continue
    await prisma.invoice.create({
      data: {
        invoiceNumber: inv.number,
        clientId: client.id,
        projectId: project?.id,
        subtotal: inv.total,
        total: inv.total,
        paidAmount: inv.status === 'paid' ? inv.total : 0,
        status: inv.status,
        dueDate: new Date(Date.now() + inv.daysOffset * 86_400_000),
        sentAt: inv.status !== 'draft' ? new Date(Date.now() + (inv.daysOffset - 14) * 86_400_000) : null,
        paidAt: inv.status === 'paid' ? new Date(Date.now() + (inv.daysOffset - 3) * 86_400_000) : null,
        createdById: ceoId,
      },
    })
    console.log(`  · ${inv.number} (${inv.status})`)
  }
}

async function seedOKRs(departments: Record<string, { id: string }>) {
  console.log('\n→ OKRs (current quarter, demo)')
  const now = new Date()
  const q = `Q${Math.floor(now.getMonth() / 3) + 1}`
  const year = now.getFullYear()

  const defs = [
    {
      objective: 'Scale revenue to $100K MRR',
      dept: 'company',
      krs: [
        { title: 'Close enterprise deals', target: 5, current: 3, unit: 'deals' },
        { title: 'Raise average deal size', target: 10000, current: 7800, unit: '$' },
        { title: 'Reduce churn rate', target: 100, current: 40, unit: '%' },
      ],
    },
    {
      objective: 'Build world-class engineering team',
      dept: 'development',
      krs: [
        { title: 'Hire senior engineers', target: 3, current: 2, unit: 'hires' },
        { title: 'Sprint completion rate', target: 95, current: 88, unit: '%' },
        { title: 'Deployment success rate', target: 98, current: 96.9, unit: '%' },
      ],
    },
    {
      objective: 'Achieve 95% client satisfaction',
      dept: 'operations',
      krs: [
        { title: 'NPS score', target: 70, current: 72, unit: 'score' },
        { title: 'SLA compliance', target: 98, current: 96.5, unit: '%' },
      ],
    },
  ]

  for (const def of defs) {
    const dept = departments[def.dept]
    if (!dept) continue
    const existing = await prisma.oKR.findFirst({
      where: { objective: def.objective, quarter: q, year },
    })
    if (existing) continue
    await prisma.oKR.create({
      data: {
        objective: def.objective,
        departmentId: dept.id,
        quarter: q,
        year,
        keyResults: { create: def.krs },
      },
    })
    console.log(`  · ${def.objective}`)
  }
}

async function seedTasks(projects: { id: string; name: string }[], team: Record<string, { id: string }>) {
  console.log('\n→ Tasks (sprint board, demo)')
  const defs = [
    { title: 'Implement payment webhook handler', project: 'CareFirst Patient Portal', assignee: 'raj', status: 'todo', priority: 'high', est: 6 },
    { title: 'API rate limiting middleware', project: 'DataFlow Dashboard v2', assignee: 'sarah', status: 'in_progress', priority: 'high', est: 8, act: 5 },
    { title: 'Fix invoice PDF generation', project: 'CareFirst Patient Portal', assignee: 'david', status: 'in_progress', priority: 'critical', est: 4, act: 6 },
    { title: 'User authentication flow', project: 'Urban Threads E-Commerce', assignee: 'sarah', status: 'in_review', priority: 'high', est: 10, act: 9 },
    { title: 'Database migration scripts', project: 'DataFlow Dashboard v2', assignee: 'raj', status: 'done', priority: 'medium', est: 5, act: 4 },
  ] as const

  for (const t of defs) {
    const project = projects.find((p) => p.name === t.project)
    const assignee = team[t.assignee]
    if (!project || !assignee) continue
    const existing = await prisma.task.findFirst({ where: { title: t.title, projectId: project.id } })
    if (existing) continue
    await prisma.task.create({
      data: {
        title: t.title,
        projectId: project.id,
        assigneeId: assignee.id,
        status: t.status,
        priority: t.priority,
        estimatedHours: t.est,
        actualHours: 'act' in t ? t.act : null,
        dueDate: new Date(Date.now() + 7 * 86_400_000),
        completedAt: t.status === 'done' ? new Date(Date.now() - 2 * 86_400_000) : null,
      },
    })
    console.log(`  · ${t.title} (${t.status})`)
  }
}

async function seedKnowledge(authorId: string) {
  console.log('\n→ Knowledge articles (demo)')
  const defs = [
    { title: 'Client Onboarding Checklist', category: 'Operations', content: 'Standard onboarding flow:\n\n1. Welcome call within 24 hours\n2. Shared workspace setup\n3. Kickoff meeting scheduled\n4. SOW signed' },
    { title: 'Sprint Planning Best Practices', category: 'Development', content: 'Plan by capacity, not by ambition. Reserve 20% for the unknown. Move scope, never move the date.' },
    { title: 'Employee Leave Policy 2026', category: 'HR', content: 'Annual leave: 21 days.\nSick leave: 10 days.\nRemote work: 3 days/week by default.' },
  ]
  for (const a of defs) {
    const existing = await prisma.knowledgeArticle.findFirst({ where: { title: a.title } })
    if (existing) continue
    await prisma.knowledgeArticle.create({
      data: { ...a, authorId },
    })
    console.log(`  · ${a.title}`)
  }
}

// ─────────────────────────────────────────────────────────

main()
  .catch((err) => {
    console.error('\n✗ Seed failed:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
