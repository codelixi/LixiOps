import { motion } from 'framer-motion'
import { Plus, Filter, Zap, Clock, AlertCircle, CheckCircle2, Code2 } from 'lucide-react'
import { Button, Badge, Avatar, ProgressBar } from '@/components/ui'
import { staggerContainer, staggerItem } from '@/lib/motion'
import { useTasks } from '@/hooks/useTasks'
import type { TaskItem, TaskPriority, TaskStatus } from '@/hooks/useTasks'

const priorityMap: Record<TaskPriority, { label: string; variant: 'danger' | 'warning' | 'info' | 'default' }> = {
  critical: { label: 'Critical', variant: 'danger' },
  high: { label: 'High', variant: 'warning' },
  medium: { label: 'Medium', variant: 'info' },
  low: { label: 'Low', variant: 'default' },
}

const columnDefs: { id: TaskStatus; title: string; icon: React.ReactNode }[] = [
  { id: 'todo', title: 'To Do', icon: <Clock className="h-4 w-4" /> },
  { id: 'in_progress', title: 'In Progress', icon: <Code2 className="h-4 w-4" /> },
  { id: 'in_review', title: 'In Review', icon: <AlertCircle className="h-4 w-4" /> },
  { id: 'done', title: 'Done', icon: <CheckCircle2 className="h-4 w-4" /> },
]

function TaskCard({ task }: { task: TaskItem }) {
  const { estimated, actual } = task.hours
  const isOvertime = estimated > 0 && actual > estimated
  return (
    <motion.div
      layout
      variants={staggerItem}
      whileHover={{ y: -2 }}
      className={`bg-white rounded-lg border p-4 shadow-xs hover:shadow-sm transition-shadow cursor-pointer ${
        task.blocked ? 'border-danger-200 bg-danger-50/30' : 'border-neutral-200/60'
      }`}
    >
      {task.blocked && (
        <div className="flex items-center gap-1.5 mb-2">
          <AlertCircle className="h-3 w-3 text-danger-500" />
          <span className="text-2xs font-semibold text-danger-600 uppercase">Blocked</span>
        </div>
      )}

      <div className="flex items-start justify-between mb-2">
        <p className="text-sm font-medium text-neutral-800 leading-snug pr-2">{task.title}</p>
        <Badge variant={priorityMap[task.priority].variant}>
          {priorityMap[task.priority].label}
        </Badge>
      </div>

      <Badge variant="brand" className="mb-3">{task.project}</Badge>

      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-2">
          <Avatar name={task.assignee} size="xs" />
          <span className="text-xs text-neutral-500">{task.assignee}</span>
        </div>
        <span className="text-xs text-neutral-400">{task.dueDate}</span>
      </div>

      {(estimated > 0 || actual > 0) && (
        <div className="mt-3 pt-3 border-t border-neutral-100">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-neutral-500">Time tracked</span>
            <span className={`font-mono font-medium ${isOvertime ? 'text-danger-600' : 'text-neutral-700'}`}>
              {actual}h / {estimated}h
            </span>
          </div>
          <ProgressBar
            value={actual}
            max={Math.max(estimated, 1)}
            size="sm"
            color={isOvertime ? 'danger' : 'brand'}
          />
        </div>
      )}
    </motion.div>
  )
}

export function SprintBoardPage() {
  const { tasks, usingFallback } = useTasks()

  const velocity = tasks
    .filter((t) => t.status === 'done')
    .reduce((sum, t) => sum + (t.hours.estimated || 0), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Sprint Board</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Active work across all projects
            {usingFallback && (
              <span className="ml-2 text-2xs uppercase tracking-wider text-warning-600 font-semibold">Offline — demo data</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 mr-4">
            <Zap className="h-4 w-4 text-brand-500" />
            <span className="text-sm font-medium text-neutral-700">
              Completed: <span className="text-brand-500">{velocity}h</span>
            </span>
          </div>
          <Button variant="secondary" size="sm" icon={<Filter className="h-3.5 w-3.5" />}>
            Filter
          </Button>
          <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />}>
            New Task
          </Button>
        </div>
      </div>

      {/* Board */}
      <div className="flex gap-5 overflow-x-auto pb-4 -mx-2 px-2">
        {columnDefs.map((column) => {
          const columnTasks = tasks.filter((t) => t.status === column.id)
          return (
            <div key={column.id} className="flex-shrink-0 w-80">
              <div className="flex items-center gap-2.5 mb-4">
                <span className="text-neutral-400">{column.icon}</span>
                <h3 className="text-sm font-semibold text-neutral-700">{column.title}</h3>
                <span className="text-xs text-neutral-400 bg-neutral-100 rounded-full px-2 py-0.5">
                  {columnTasks.length}
                </span>
              </div>

              <motion.div
                variants={staggerContainer}
                initial="initial"
                animate="animate"
                className="space-y-3"
              >
                {columnTasks.length === 0 ? (
                  <div className="text-center py-6 text-[11px] text-neutral-400 border border-dashed border-neutral-200 rounded-lg">
                    No tasks
                  </div>
                ) : (
                  columnTasks.map((task) => <TaskCard key={task.id} task={task} />)
                )}
              </motion.div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
