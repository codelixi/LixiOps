import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Search, FileText, FileSpreadsheet, File, Clock, Loader2, X, Edit3, Trash2,
} from 'lucide-react'
import { Button, Badge, Card, Avatar } from '@/components/ui'
import { staggerContainer, staggerItem } from '@/lib/motion'
import { useDocuments } from '@/hooks/useDocuments'
import { useClients } from '@/hooks/useClients'
import { useAuthStore } from '@/stores/useAuthStore'
import type { DocumentFull, DocumentStatus, DocumentSummary, DocumentType } from '@/hooks/useDocuments'
import { DocumentEditor } from './DocumentEditor'
import { AttachmentList } from '@/components/AttachmentList'

const TYPE_ICON: Record<DocumentType, React.ReactNode> = {
  contract: <FileText className="h-4 w-4 text-brand-500" />,
  proposal: <FileText className="h-4 w-4 text-info-500" />,
  report: <FileSpreadsheet className="h-4 w-4 text-warning-500" />,
  template: <File className="h-4 w-4 text-success-500" />,
  policy: <FileText className="h-4 w-4 text-neutral-500" />,
  other: <File className="h-4 w-4 text-neutral-400" />,
}

const STATUS_MAP: Record<DocumentStatus, { label: string; variant: 'default' | 'info' | 'success' | 'danger' }> = {
  draft: { label: 'Draft', variant: 'default' },
  sent: { label: 'Sent', variant: 'info' },
  signed: { label: 'Signed', variant: 'success' },
  expired: { label: 'Expired', variant: 'danger' },
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60_000) return 'just now'
  const min = Math.floor(ms / 60_000)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

type TypeFilter = 'all' | DocumentType

export function DocumentsPage() {
  const userId = useAuthStore((s) => s.user?.id)
  const role = useAuthStore((s) => s.user?.role)
  const isPrivileged = role === 'CEO' || role === 'MANAGER'

  const { documents, filters, loading, usingFallback, setFilters, fetchDocument, createDocument, updateDocument, deleteDocument } =
    useDocuments()
  const { clients } = useClients()
  const lightClients = useMemo(() => clients.map((c) => ({ id: c.id, company: c.name })), [clients])

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [openDoc, setOpenDoc] = useState<DocumentFull | null>(null)
  const [drawerLoading, setDrawerLoading] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingDoc, setEditingDoc] = useState<DocumentFull | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Apply local filter + delegated server search
  const handleSearchChange = (v: string) => {
    setSearch(v)
    setFilters({ ...filters, q: v })
  }

  const handleTypeChange = (t: TypeFilter) => {
    setTypeFilter(t)
    setFilters({ ...filters, type: t === 'all' ? undefined : t })
  }

  const openDrawer = async (summary: DocumentSummary) => {
    setOpenDoc({ ...summary, content: '' })
    setDrawerLoading(true)
    try {
      const full = await fetchDocument(summary.id)
      setOpenDoc(full)
    } catch {
      // keep summary visible
    } finally {
      setDrawerLoading(false)
    }
  }

  const handleNew = () => {
    setEditingDoc(null)
    setEditorOpen(true)
  }

  const handleEdit = (doc: DocumentFull) => {
    setEditingDoc(doc)
    setEditorOpen(true)
  }

  const handleSubmit = async (payload: { title: string; type: DocumentType; content?: string; clientId?: string | null; status?: DocumentStatus }) => {
    if (editingDoc) {
      const updated = await updateDocument(editingDoc.id, payload)
      setOpenDoc(updated)
    } else {
      await createDocument(payload)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this document? This cannot be undone.')) return
    setDeletingId(id)
    try {
      await deleteDocument(id)
      if (openDoc?.id === id) setOpenDoc(null)
    } catch (err: any) {
      window.alert(err?.message ?? 'Failed to delete')
    } finally {
      setDeletingId(null)
    }
  }

  // Stats from full list (no extra query)
  const signedContracts = documents.filter((d) => d.type === 'contract' && d.status === 'signed').length
  const drafts = documents.filter((d) => d.status === 'draft').length
  const expiring = documents.filter((d) => d.signatureExpiry && new Date(d.signatureExpiry).getTime() - Date.now() < 30 * 86_400_000 && d.status === 'signed').length

  const TYPE_TABS: { id: TypeFilter; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: documents.length },
    { id: 'contract', label: 'Contracts', count: documents.filter((d) => d.type === 'contract').length },
    { id: 'proposal', label: 'Proposals', count: documents.filter((d) => d.type === 'proposal').length },
    { id: 'template', label: 'Templates', count: documents.filter((d) => d.type === 'template').length },
    { id: 'report', label: 'Reports', count: documents.filter((d) => d.type === 'report').length },
    { id: 'policy', label: 'Policies', count: documents.filter((d) => d.type === 'policy').length },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Documents</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Contracts, proposals, templates, policies
            {usingFallback && (
              <span className="ml-2 text-2xs uppercase tracking-wider text-warning-600 font-semibold">Offline — demo data</span>
            )}
            {loading && !usingFallback && (
              <Loader2 className="inline-block ml-2 h-3 w-3 animate-spin text-neutral-400" />
            )}
          </p>
        </div>
        <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={handleNew}>
          New Document
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Total Documents</p>
          <p className="text-2xl font-bold text-neutral-900">{documents.length}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Active Contracts</p>
          <p className="text-2xl font-bold text-success-600">{signedContracts}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Drafts</p>
          <p className="text-2xl font-bold text-warning-600">{drafts}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Expiring &lt; 30d</p>
          <p className="text-2xl font-bold text-danger-600">{expiring}</p>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {TYPE_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => handleTypeChange(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                typeFilter === t.id ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-100 bg-white border border-neutral-200/60'
              }`}
            >
              {t.label}
              <span className={`text-2xs ${typeFilter === t.id ? 'opacity-80' : 'text-neutral-400'}`}>{t.count}</span>
            </button>
          ))}
        </div>
        <div className="relative flex-shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
          <input
            type="text"
            placeholder="Search documents..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9 pr-4 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 w-72 transition-all"
          />
        </div>
      </div>

      {/* Grid */}
      {documents.length === 0 ? (
        <Card>
          <div className="py-12 text-center">
            <FileText className="h-6 w-6 text-neutral-300 mx-auto mb-2" />
            <p className="text-sm text-neutral-500">
              {search ? 'No documents match your search.' : 'No documents yet.'}
            </p>
            {!search && (
              <div className="mt-4 inline-flex">
                <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={handleNew}>
                  Create your first document
                </Button>
              </div>
            )}
          </div>
        </Card>
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
        >
          {documents.map((d) => {
            const status = STATUS_MAP[d.status]
            return (
              <motion.div key={d.id} variants={staggerItem}>
                <Card hover className="cursor-pointer h-full" onClick={() => openDrawer(d)}>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {TYPE_ICON[d.type]}
                      <Badge variant="default" className="capitalize">{d.type}</Badge>
                    </div>
                    <Badge variant={status.variant} dot>{status.label}</Badge>
                  </div>
                  <h3 className="text-sm font-semibold text-neutral-900 mb-3 line-clamp-2">{d.title}</h3>
                  <div className="flex items-center justify-between text-2xs text-neutral-500 pt-2 border-t border-neutral-100">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {d.author && <Avatar name={d.author.name} size="xs" />}
                      <span className="truncate">
                        {d.author?.name ?? 'System'}
                        {d.client && <span className="text-neutral-400"> · {d.client.company}</span>}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-neutral-400 flex-shrink-0">
                      {d.version > 1 && <span>v{d.version}</span>}
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatRelative(d.updatedAt)}
                      </span>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </motion.div>
      )}

      {/* Reader drawer */}
      <AnimatePresence>
        {openDoc && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpenDoc(null)}
              className="fixed inset-0 bg-neutral-900/30 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="fixed inset-y-0 right-0 w-full max-w-2xl bg-white shadow-2xl z-50 overflow-y-auto border-l border-neutral-200/60"
            >
              <div className="sticky top-0 z-10 bg-white border-b border-neutral-100 px-6 py-4 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    {TYPE_ICON[openDoc.type]}
                    <Badge variant="default" className="capitalize">{openDoc.type}</Badge>
                    <Badge variant={STATUS_MAP[openDoc.status].variant} dot>
                      {STATUS_MAP[openDoc.status].label}
                    </Badge>
                    {openDoc.version > 1 && (
                      <span className="text-2xs text-neutral-400">v{openDoc.version}</span>
                    )}
                  </div>
                  <h2 className="text-lg font-bold text-neutral-900">{openDoc.title}</h2>
                  <div className="flex items-center gap-2 mt-2 text-xs text-neutral-500 flex-wrap">
                    {openDoc.author && <Avatar name={openDoc.author.name} size="xs" />}
                    <span>{openDoc.author?.name ?? 'System'}</span>
                    {openDoc.client && (
                      <>
                        <span className="text-neutral-300">·</span>
                        <span>{openDoc.client.company}</span>
                      </>
                    )}
                    <span className="text-neutral-300">·</span>
                    <span>Updated {formatRelative(openDoc.updatedAt)}</span>
                    {openDoc.signedAt && (
                      <>
                        <span className="text-neutral-300">·</span>
                        <span className="text-success-600 font-medium">Signed {formatRelative(openDoc.signedAt)}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {(openDoc.authorId === userId || isPrivileged) && (
                    <>
                      <button
                        onClick={() => handleEdit(openDoc)}
                        className="h-8 w-8 flex items-center justify-center text-neutral-400 hover:text-brand-600 hover:bg-brand-50 rounded cursor-pointer"
                        aria-label="Edit"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(openDoc.id)}
                        disabled={deletingId === openDoc.id}
                        className="h-8 w-8 flex items-center justify-center text-neutral-400 hover:text-danger-600 hover:bg-danger-50 rounded cursor-pointer disabled:opacity-50"
                        aria-label="Delete"
                      >
                        {deletingId === openDoc.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setOpenDoc(null)}
                    className="h-8 w-8 flex items-center justify-center text-neutral-400 hover:bg-neutral-50 hover:text-neutral-700 rounded cursor-pointer"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="px-6 py-6">
                {drawerLoading ? (
                  <div className="flex items-center justify-center py-12 text-neutral-400">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap font-sans text-sm text-neutral-700 leading-relaxed">
                    {openDoc.content || '(empty)'}
                  </pre>
                )}

                <div className="mt-8 pt-6 border-t border-neutral-100">
                  <AttachmentList entityType="DOCUMENT" entityId={openDoc.id} />
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <DocumentEditor
        open={editorOpen}
        onClose={() => {
          setEditorOpen(false)
          setEditingDoc(null)
        }}
        existing={editingDoc}
        clients={lightClients}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
