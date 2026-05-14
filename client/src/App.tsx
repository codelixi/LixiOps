import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppLayout } from '@/components/layout/AppLayout'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { RouteLoader } from '@/components/RouteLoader'
import { useSocketLifecycle } from '@/hooks/useSocket'

// ───────────────────────────────────────────
// Route map — every page is lazy-loaded so the initial bundle
// only ships the layout shell + auth + dashboard. Each chunk lives
// in its own JS file vite emits at build time.
//
// Eager: AppLayout, AuthLayout, ErrorBoundary, RouteLoader — these
// are needed for first paint and the loading shell respectively.
// ───────────────────────────────────────────

const LoginPage = lazy(() => import('@/pages/auth/LoginPage').then((m) => ({ default: m.LoginPage })))
const OTPPage = lazy(() => import('@/pages/auth/OTPPage').then((m) => ({ default: m.OTPPage })))

const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const SalesPipelinePage = lazy(() => import('@/pages/sales/SalesPipelinePage').then((m) => ({ default: m.SalesPipelinePage })))
const SprintBoardPage = lazy(() => import('@/pages/development/SprintBoardPage').then((m) => ({ default: m.SprintBoardPage })))
const DesignBriefsPage = lazy(() => import('@/pages/design/DesignBriefsPage').then((m) => ({ default: m.DesignBriefsPage })))
const DeliveryTrackerPage = lazy(() => import('@/pages/operations/DeliveryTrackerPage').then((m) => ({ default: m.DeliveryTrackerPage })))
const ManagementDashboardPage = lazy(() => import('@/pages/management/ManagementDashboardPage').then((m) => ({ default: m.ManagementDashboardPage })))

const DocumentsPage = lazy(() => import('@/pages/documents/DocumentsPage').then((m) => ({ default: m.DocumentsPage })))
const InvoiceListPage = lazy(() => import('@/pages/invoicing/InvoiceListPage').then((m) => ({ default: m.InvoiceListPage })))
const CreateInvoicePage = lazy(() => import('@/pages/invoicing/CreateInvoicePage').then((m) => ({ default: m.CreateInvoicePage })))
const InvoiceDetailPage = lazy(() => import('@/pages/invoicing/InvoiceDetailPage').then((m) => ({ default: m.InvoiceDetailPage })))
const ProjectListPage = lazy(() => import('@/pages/projects/ProjectListPage').then((m) => ({ default: m.ProjectListPage })))
const CreateProjectPage = lazy(() => import('@/pages/projects/CreateProjectPage').then((m) => ({ default: m.CreateProjectPage })))
const ProjectDetailPage = lazy(() => import('@/pages/projects/ProjectDetailPage').then((m) => ({ default: m.ProjectDetailPage })))
const ClientListPage = lazy(() => import('@/pages/clients/ClientListPage').then((m) => ({ default: m.ClientListPage })))
const ClientDetailPage = lazy(() => import('@/pages/clients/ClientDetailPage').then((m) => ({ default: m.ClientDetailPage })))
const ReportsPage = lazy(() => import('@/pages/reports/ReportsPage').then((m) => ({ default: m.ReportsPage })))

const EmployeeDirectoryPage = lazy(() => import('@/pages/employees/EmployeeDirectoryPage').then((m) => ({ default: m.EmployeeDirectoryPage })))
const EmployeeDetailPage = lazy(() => import('@/pages/employees/EmployeeDetailPage').then((m) => ({ default: m.EmployeeDetailPage })))
const DepartmentsPage = lazy(() => import('@/pages/departments/DepartmentsPage').then((m) => ({ default: m.DepartmentsPage })))
const AttendanceBoardPage = lazy(() => import('@/pages/attendance/AttendanceBoardPage').then((m) => ({ default: m.AttendanceBoardPage })))
const OKRsPage = lazy(() => import('@/pages/okrs/OKRsPage').then((m) => ({ default: m.OKRsPage })))

const AIEnginePage = lazy(() => import('@/pages/ai-engine/AIEnginePage').then((m) => ({ default: m.AIEnginePage })))
const ClientHealthPage = lazy(() => import('@/pages/client-health/ClientHealthPage').then((m) => ({ default: m.ClientHealthPage })))
const KnowledgeBasePage = lazy(() => import('@/pages/knowledge-base/KnowledgeBasePage').then((m) => ({ default: m.KnowledgeBasePage })))
const RiskRegisterPage = lazy(() => import('@/pages/risks/RiskRegisterPage').then((m) => ({ default: m.RiskRegisterPage })))

const ActivityFeedPage = lazy(() => import('@/pages/activity/ActivityFeedPage').then((m) => ({ default: m.ActivityFeedPage })))
const AuditLogPage = lazy(() => import('@/pages/audit/AuditLogPage').then((m) => ({ default: m.AuditLogPage })))
const BroadcastsPage = lazy(() => import('@/pages/broadcasts/BroadcastsPage').then((m) => ({ default: m.BroadcastsPage })))
const SettingsPage = lazy(() => import('@/pages/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })))
const PlaceholderPage = lazy(() => import('@/pages/PlaceholderPage').then((m) => ({ default: m.PlaceholderPage })))
const ClientInvoicePage = lazy(() => import('@/pages/portal/ClientInvoicePage').then((m) => ({ default: m.ClientInvoicePage })))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

// Mounts inside the auth-aware tree so it can read the auth store
// and connect/disconnect the singleton socket as the user logs in/out.
function SocketLifecycle() {
  useSocketLifecycle()
  return null
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <SocketLifecycle />
          <Suspense fallback={<RouteLoader />}>
            <Routes>
              {/* Public Client Portal — no auth, tokenized URL */}
              <Route path="/pay/:token" element={<ClientInvoicePage />} />

              {/* Auth */}
              <Route element={<AuthLayout />}>
                <Route path="/auth/login" element={<LoginPage />} />
                <Route path="/auth/verify" element={<OTPPage />} />
              </Route>

              {/* App */}
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<DashboardPage />} />

                {/* Sales */}
                <Route path="/sales" element={<SalesPipelinePage />} />
                <Route path="/sales/*" element={<PlaceholderPage />} />

                {/* Development */}
                <Route path="/development" element={<SprintBoardPage />} />
                <Route path="/development/*" element={<PlaceholderPage />} />

                {/* Other departments */}
                <Route path="/design" element={<DesignBriefsPage />} />
                <Route path="/design/*" element={<PlaceholderPage />} />
                <Route path="/operations" element={<DeliveryTrackerPage />} />
                <Route path="/operations/*" element={<PlaceholderPage />} />
                <Route path="/management" element={<ManagementDashboardPage />} />
                <Route path="/management/*" element={<PlaceholderPage />} />

                {/* Business */}
                <Route path="/documents" element={<DocumentsPage />} />
                <Route path="/documents/*" element={<PlaceholderPage />} />
                <Route path="/invoicing" element={<InvoiceListPage />} />
                <Route path="/invoicing/new" element={<CreateInvoicePage />} />
                <Route path="/invoicing/:id" element={<InvoiceDetailPage />} />
                <Route path="/projects" element={<ProjectListPage />} />
                <Route path="/projects/new" element={<CreateProjectPage />} />
                <Route path="/projects/:id" element={<ProjectDetailPage />} />
                <Route path="/clients" element={<ClientListPage />} />
                <Route path="/clients/:id" element={<ClientDetailPage />} />
                <Route path="/reports" element={<ReportsPage />} />

                {/* People */}
                <Route path="/employees" element={<EmployeeDirectoryPage />} />
                <Route path="/employees/:id" element={<EmployeeDetailPage />} />
                <Route path="/departments" element={<DepartmentsPage />} />
                <Route path="/departments/*" element={<PlaceholderPage />} />
                <Route path="/attendance" element={<AttendanceBoardPage />} />
                <Route path="/attendance/*" element={<PlaceholderPage />} />
                <Route path="/okrs" element={<OKRsPage />} />

                {/* Intelligence */}
                <Route path="/ai-engine" element={<AIEnginePage />} />
                <Route path="/ai-engine/*" element={<PlaceholderPage />} />
                <Route path="/client-health" element={<ClientHealthPage />} />
                <Route path="/client-health/*" element={<PlaceholderPage />} />
                <Route path="/knowledge-base" element={<KnowledgeBasePage />} />
                <Route path="/knowledge-base/*" element={<PlaceholderPage />} />
                <Route path="/risks" element={<RiskRegisterPage />} />
                <Route path="/risks/*" element={<PlaceholderPage />} />

                {/* Misc */}
                <Route path="/activity" element={<ActivityFeedPage />} />
                <Route path="/audit" element={<AuditLogPage />} />
                <Route path="/broadcasts" element={<BroadcastsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/settings/*" element={<PlaceholderPage />} />
              </Route>

              {/* Redirect */}
              <Route path="/" element={<Navigate to="/auth/login" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
