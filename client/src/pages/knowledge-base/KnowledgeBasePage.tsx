import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Search, BookOpen, Clock, Eye, X, Edit3, Trash2, Loader2,
} from 'lucide-react'
import { Button, Card, Avatar, Badge } from '@/components/ui'
import { staggerContainer, staggerItem } from '@/lib/motion'
import { useKnowledge } from '@/hooks/useKnowledge'
import { useAuthStore } from '@/stores/useAuthStore'
import type { ArticleFull, ArticleSummary } from '@/hooks/useKnowledge'
import { ArticleEditor } from './ArticleEditor'

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

export function KnowledgeBasePage() {
  const userId = useAuthStore((s) => s.user?.id)
  const role = useAuthStore((s) => s.user?.role)
  const isPrivileged = role === 'CEO' || role === 'MANAGER'

  const {
    articles, categories, search, category, loading, usingFallback,
    setSearch, setCategory, fetchArticle, createArticle, updateArticle, deleteArticle,
  } = useKnowledge()

  const [openArticle, setOpenArticle] = useState<ArticleFull | null>(null)
  const [drawerLoading, setDrawerLoading] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingArticle, setEditingArticle] = useState<ArticleFull | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const openDrawer = async (summary: ArticleSummary) => {
    setOpenArticle({ ...summary, content: '' })
    setDrawerLoading(true)
    try {
      const full = await fetchArticle(summary.id)
      setOpenArticle(full)
    } catch {
      // leave summary visible if fetch fails
    } finally {
      setDrawerLoading(false)
    }
  }

  const handleEdit = (article: ArticleFull) => {
    setEditingArticle(article)
    setEditorOpen(true)
  }

  const handleNew = () => {
    setEditingArticle(null)
    setEditorOpen(true)
  }

  const handleSubmit = async (payload: { title: string; content: string; category: string }) => {
    if (editingArticle) {
      await updateArticle(editingArticle.id, payload)
      setOpenArticle((cur) => (cur && cur.id === editingArticle.id ? { ...cur, ...payload, updatedAt: new Date().toISOString() } : cur))
    } else {
      await createArticle(payload)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this article? This cannot be undone.')) return
    setDeletingId(id)
    try {
      await deleteArticle(id)
      if (openArticle?.id === id) setOpenArticle(null)
    } catch (err: any) {
      window.alert(err?.message ?? 'Failed to delete')
    } finally {
      setDeletingId(null)
    }
  }

  const totalViews = articles.reduce((s, a) => s + a.viewCount, 0)
  const knownCategoryNames = categories.map((c) => c.name)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="h-5 w-5 text-brand-500" />
            <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Knowledge Base</h1>
          </div>
          <p className="text-sm text-neutral-500">
            Internal documentation, runbooks, and policies
            {usingFallback && (
              <span className="ml-2 text-2xs uppercase tracking-wider text-warning-600 font-semibold">Offline — demo data</span>
            )}
            {loading && !usingFallback && (
              <Loader2 className="inline-block ml-2 h-3 w-3 animate-spin text-neutral-400" />
            )}
          </p>
        </div>
        <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={handleNew}>
          New Article
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Total Articles</p>
          <p className="text-2xl font-bold text-neutral-900">{articles.length}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Categories</p>
          <p className="text-2xl font-bold text-neutral-900">{categories.length}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Total Views</p>
          <p className="text-2xl font-bold text-neutral-900">{totalViews}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Most Recent</p>
          <p className="text-sm font-semibold text-neutral-900 truncate">
            {articles[0]?.title ?? '—'}
          </p>
          <p className="text-2xs text-neutral-400 mt-1">
            {articles[0] ? formatRelative(articles[0].updatedAt) : ''}
          </p>
        </Card>
      </div>

      {/* Search + filter */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setCategory(null)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
              category === null ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-100 bg-white border border-neutral-200/60'
            }`}
          >
            All <span className={`ml-1 text-2xs ${category === null ? 'opacity-80' : 'text-neutral-400'}`}>{articles.length}</span>
          </button>
          {categories.map((c) => (
            <button
              key={c.name}
              onClick={() => setCategory(c.name)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                category === c.name ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-100 bg-white border border-neutral-200/60'
              }`}
            >
              {c.name} <span className={`ml-1 text-2xs ${category === c.name ? 'opacity-80' : 'text-neutral-400'}`}>{c.count}</span>
            </button>
          ))}
        </div>
        <div className="relative flex-shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
          <input
            type="text"
            placeholder="Search articles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 w-72 transition-all"
          />
        </div>
      </div>

      {/* List */}
      {articles.length === 0 ? (
        <Card>
          <div className="py-12 text-center">
            <BookOpen className="h-6 w-6 text-neutral-300 mx-auto mb-2" />
            <p className="text-sm text-neutral-500">
              {search ? 'No articles match your search.' : 'No articles yet — capture some institutional knowledge.'}
            </p>
            {!search && (
              <div className="mt-4 inline-flex">
                <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={handleNew}>
                  Write the first article
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
          {articles.map((a) => (
            <motion.div key={a.id} variants={staggerItem}>
              <Card hover className="cursor-pointer h-full" onClick={() => openDrawer(a)}>
                <Badge variant="default">{a.category}</Badge>
                <h3 className="text-sm font-semibold text-neutral-900 mt-2 mb-2 line-clamp-2">{a.title}</h3>
                <div className="mt-auto pt-2 border-t border-neutral-100 flex items-center justify-between text-2xs text-neutral-500">
                  <div className="flex items-center gap-1.5">
                    {a.author && <Avatar name={a.author.name} size="xs" />}
                    <span className="truncate">{a.author?.name ?? 'System'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-neutral-400">
                    <span className="flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      {a.viewCount}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatRelative(a.updatedAt)}
                    </span>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Reader drawer */}
      <AnimatePresence>
        {openArticle && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpenArticle(null)}
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
                  <Badge variant="default">{openArticle.category}</Badge>
                  <h2 className="text-lg font-bold text-neutral-900 mt-2">{openArticle.title}</h2>
                  <div className="flex items-center gap-2 mt-2 text-xs text-neutral-500">
                    {openArticle.author && <Avatar name={openArticle.author.name} size="xs" />}
                    <span>{openArticle.author?.name ?? 'System'}</span>
                    <span className="text-neutral-300">·</span>
                    <span>Updated {formatRelative(openArticle.updatedAt)}</span>
                    <span className="text-neutral-300">·</span>
                    <span className="flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      {openArticle.viewCount} views
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {(openArticle.authorId === userId || isPrivileged) && (
                    <>
                      <button
                        onClick={() => handleEdit(openArticle)}
                        className="h-8 w-8 flex items-center justify-center text-neutral-400 hover:text-brand-600 hover:bg-brand-50 rounded cursor-pointer"
                        aria-label="Edit"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(openArticle.id)}
                        disabled={deletingId === openArticle.id}
                        className="h-8 w-8 flex items-center justify-center text-neutral-400 hover:text-danger-600 hover:bg-danger-50 rounded cursor-pointer disabled:opacity-50"
                        aria-label="Delete"
                      >
                        {deletingId === openArticle.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setOpenArticle(null)}
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
                  <div className="prose prose-neutral max-w-none">
                    <pre className="whitespace-pre-wrap font-sans text-sm text-neutral-700 leading-relaxed">
                      {openArticle.content || '(empty)'}
                    </pre>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <ArticleEditor
        open={editorOpen}
        onClose={() => {
          setEditorOpen(false)
          setEditingArticle(null)
        }}
        existing={editingArticle}
        knownCategories={knownCategoryNames}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
