import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Mail, Phone, MapPin, Calendar, Briefcase } from 'lucide-react'
import { Button, Badge, Card, Avatar, ProgressBar } from '@/components/ui'
import { staggerContainer, staggerItem } from '@/lib/motion'

const employeeData = {
  id: '1',
  name: 'Noman Ali',
  email: 'noman@codelixi.com',
  phone: '+92 300-1234567',
  role: 'CEO',
  department: 'Management',
  location: 'Islamabad, PK',
  status: 'active' as const,
  joinDate: 'Jan 2024',
  bio: 'Founder and CEO of CodeLixi. Leading strategic direction, client relationships, and product vision for LixiOps.',
  skills: ['Leadership', 'Product Strategy', 'Full Stack Dev', 'Business Development', 'UI/UX'],
  stats: {
    hoursThisWeek: 42,
    hoursThisMonth: 168,
    projectsActive: 4,
    tasksCompleted: 156,
    attendanceRate: 98,
  },
  projects: [
    { name: 'LixiOps Platform', role: 'Product Owner', progress: 65 },
    { name: 'Bella Cucina Rebrand', role: 'Account Lead', progress: 72 },
    { name: 'CareFirst Portal', role: 'Stakeholder', progress: 45 },
    { name: 'Client Portal v2', role: 'Product Owner', progress: 15 },
  ],
  recentActivity: [
    { action: 'Approved brand direction for Bella Cucina', time: '2 hours ago' },
    { action: 'Completed quarterly OKR review', time: '1 day ago' },
    { action: 'Led sprint planning session', time: '2 days ago' },
    { action: 'Closed deal with GreenTech Solutions', time: '3 days ago' },
    { action: 'Reviewed and approved CI/CD pipeline changes', time: '1 week ago' },
  ],
  leaveBalance: { annual: 12, used: 3, sick: 5, sickUsed: 1 },
}

const statusMap = {
  active: { label: 'Active', variant: 'success' as const },
  'on-leave': { label: 'On Leave', variant: 'warning' as const },
  remote: { label: 'Remote', variant: 'info' as const },
  probation: { label: 'Probation', variant: 'default' as const },
}

export function EmployeeDetailPage() {
  const navigate = useNavigate()
  const emp = employeeData

  return (
    <div className="space-y-8">
      {/* Back + Header */}
      <div>
        <button
          onClick={() => navigate('/employees')}
          className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 transition-colors mb-4 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Team Directory
        </button>

        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Avatar name={emp.name} size="lg" status="online" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">{emp.name}</h1>
                <Badge variant={statusMap[emp.status].variant} dot>
                  {statusMap[emp.status].label}
                </Badge>
              </div>
              <p className="text-sm text-neutral-500 mt-0.5">{emp.role} · {emp.department}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm">Edit Profile</Button>
            <Button size="sm" icon={<Mail className="h-3.5 w-3.5" />}>Send Message</Button>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-5">
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Hours / Week</p>
          <p className="text-xl font-bold text-neutral-900">{emp.stats.hoursThisWeek}h</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Hours / Month</p>
          <p className="text-xl font-bold text-neutral-900">{emp.stats.hoursThisMonth}h</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Active Projects</p>
          <p className="text-xl font-bold text-neutral-900">{emp.stats.projectsActive}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Tasks Done</p>
          <p className="text-xl font-bold text-neutral-900">{emp.stats.tasksCompleted}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Attendance</p>
          <p className="text-xl font-bold text-success-600">{emp.stats.attendanceRate}%</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Info + Projects + Leave */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact & Bio */}
          <Card>
            <h2 className="text-sm font-semibold text-neutral-900 mb-4">Profile</h2>
            <p className="text-sm text-neutral-600 mb-4 leading-relaxed">{emp.bio}</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2 text-sm text-neutral-600">
                <Mail className="h-4 w-4 text-neutral-400" />
                <span>{emp.email}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-neutral-600">
                <Phone className="h-4 w-4 text-neutral-400" />
                <span>{emp.phone}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-neutral-600">
                <MapPin className="h-4 w-4 text-neutral-400" />
                <span>{emp.location}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-neutral-600">
                <Calendar className="h-4 w-4 text-neutral-400" />
                <span>Joined {emp.joinDate}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-neutral-600">
                <Briefcase className="h-4 w-4 text-neutral-400" />
                <span>{emp.department}</span>
              </div>
            </div>
          </Card>

          {/* Skills */}
          <Card>
            <h2 className="text-sm font-semibold text-neutral-900 mb-3">Skills</h2>
            <div className="flex flex-wrap gap-2">
              {emp.skills.map((skill) => (
                <span key={skill} className="px-3 py-1 text-xs font-medium bg-neutral-100 text-neutral-700 rounded-full">
                  {skill}
                </span>
              ))}
            </div>
          </Card>

          {/* Projects */}
          <Card>
            <h2 className="text-sm font-semibold text-neutral-900 mb-4">Projects</h2>
            <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-4">
              {emp.projects.map((project) => (
                <motion.div key={project.name} variants={staggerItem} className="border border-neutral-100 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="text-sm font-medium text-neutral-900">{project.name}</h3>
                      <p className="text-xs text-neutral-500">{project.role}</p>
                    </div>
                    <span className="text-xs font-medium text-neutral-700">{project.progress}%</span>
                  </div>
                  <ProgressBar value={project.progress} color={project.progress === 100 ? 'success' : 'brand'} />
                </motion.div>
              ))}
            </motion.div>
          </Card>

          {/* Leave Balance */}
          <Card>
            <h2 className="text-sm font-semibold text-neutral-900 mb-4">Leave Balance</h2>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-neutral-600">Annual Leave</span>
                  <span className="text-xs font-medium text-neutral-700">{emp.leaveBalance.used}/{emp.leaveBalance.annual} used</span>
                </div>
                <ProgressBar value={emp.leaveBalance.used} max={emp.leaveBalance.annual} color="brand" />
                <p className="text-xs text-neutral-500 mt-1">{emp.leaveBalance.annual - emp.leaveBalance.used} days remaining</p>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-neutral-600">Sick Leave</span>
                  <span className="text-xs font-medium text-neutral-700">{emp.leaveBalance.sickUsed}/{emp.leaveBalance.sick} used</span>
                </div>
                <ProgressBar value={emp.leaveBalance.sickUsed} max={emp.leaveBalance.sick} color="warning" />
                <p className="text-xs text-neutral-500 mt-1">{emp.leaveBalance.sick - emp.leaveBalance.sickUsed} days remaining</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Right: Activity */}
        <div className="space-y-6">
          <Card>
            <h2 className="text-sm font-semibold text-neutral-900 mb-4">Recent Activity</h2>
            <div className="relative">
              <div className="absolute left-3 top-0 bottom-0 w-px bg-neutral-100" />
              <div className="space-y-4">
                {emp.recentActivity.map((act, i) => (
                  <div key={i} className="relative flex items-start gap-4 pl-8">
                    <div className="absolute left-1.5 top-1 h-3 w-3 rounded-full bg-white border-2 border-neutral-300" />
                    <div>
                      <p className="text-xs text-neutral-700 leading-relaxed">{act.action}</p>
                      <p className="text-[10px] text-neutral-400 mt-0.5">{act.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold text-neutral-900 mb-4">This Week</h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">Hours Logged</span>
                <span className="font-medium text-neutral-900">{emp.stats.hoursThisWeek}h</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">Target</span>
                <span className="font-medium text-neutral-900">40h</span>
              </div>
              <div className="flex justify-between text-sm border-t border-neutral-100 pt-2">
                <span className="font-medium text-neutral-900">Utilization</span>
                <span className="font-bold text-success-600">{Math.round((emp.stats.hoursThisWeek / 40) * 100)}%</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
