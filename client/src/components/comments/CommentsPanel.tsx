import { useState, useMemo, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, AtSign, MoreHorizontal, Edit2, Trash2, Reply } from 'lucide-react'
import { Avatar } from '@/components/ui'

// Matches Prisma CommentEntity enum
export type CommentEntity = 'LEAD' | 'DEAL' | 'CLIENT' | 'PROJECT' | 'TASK' | 'MILESTONE' | 'INVOICE' | 'DOCUMENT' | 'RISK'

export interface CommentAuthor {
  id: string
  name: string
  email?: string
  avatar?: string
  role?: string
}

export interface Comment {
  id: string
  body: string
  mentions?: string[]
  parentId?: string | null
  editedAt?: string | null
  createdAt: string
  author: CommentAuthor
  replies?: Comment[]
}

interface CommentsPanelProps {
  entityType: CommentEntity
  entityId: string
  currentUser: CommentAuthor
  /** All users available for @-mention autocomplete. Replace with /api/v1/users later. */
  mentionableUsers: CommentAuthor[]
  /** Optional: wire in react-query later. For now accepts initial comments + callbacks. */
  comments?: Comment[]
  onCreate?: (body: string, parentId?: string) => Promise<void>
  onEdit?: (id: string, body: string) => Promise<void>
  onDelete?: (id: string) => Promise<void>
}

// Mention format: @[Name](userId)
const MENTION_RE = /@\[([^\]]+)\]\(([^)]+)\)/g

function renderBody(body: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let m: RegExpExecArray | null
  MENTION_RE.lastIndex = 0
  while ((m = MENTION_RE.exec(body)) !== null) {
    if (m.index > lastIndex) parts.push(body.slice(lastIndex, m.index))
    parts.push(
      <span key={`m-${m.index}`} className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-brand-50 text-brand-700 text-[11px] font-medium">
        <AtSign className="h-2.5 w-2.5" />
        {m[1]}
      </span>,
    )
    lastIndex = m.index + m[0].length
  }
  if (lastIndex < body.length) parts.push(body.slice(lastIndex))
  return parts
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const diffMs = Date.now() - d.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d ago`
  return d.toLocaleDateString()
}

export function CommentsPanel({
  entityType,
  entityId,
  currentUser,
  mentionableUsers,
  comments = [],
  onCreate,
  onEdit,
  onDelete,
}: CommentsPanelProps) {
  const [list, setList] = useState<Comment[]>(comments)
  const [draft, setDraft] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [mentionMenu, setMentionMenu] = useState<{ open: boolean; query: string; start: number }>({
    open: false, query: '', start: 0,
  })
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { setList(comments) }, [comments])

  // Detect `@query` in textarea and show dropdown
  const handleDraftChange = (value: string) => {
    setDraft(value)
    const cursor = textareaRef.current?.selectionStart ?? value.length
    const before = value.slice(0, cursor)
    const match = /@([a-zA-Z ]{0,30})$/.exec(before)
    if (match) {
      setMentionMenu({ open: true, query: match[1], start: cursor - match[0].length })
    } else {
      setMentionMenu({ open: false, query: '', start: 0 })
    }
  }

  const filteredUsers = useMemo(() => {
    const q = mentionMenu.query.toLowerCase()
    return mentionableUsers.filter((u) => u.name.toLowerCase().includes(q)).slice(0, 6)
  }, [mentionableUsers, mentionMenu.query])

  const pickMention = (u: CommentAuthor) => {
    const { start, query } = mentionMenu
    const token = `@[${u.name}](${u.id}) `
    const next = draft.slice(0, start) + token + draft.slice(start + 1 + query.length)
    setDraft(next)
    setMentionMenu({ open: false, query: '', start: 0 })
    setTimeout(() => textareaRef.current?.focus(), 0)
  }

  const handleSubmit = async () => {
    if (!draft.trim() || sending) return
    setSending(true)
    try {
      const parentId = replyingTo ?? undefined
      if (onCreate) {
        await onCreate(draft.trim(), parentId)
      } else {
        // Optimistic local-only when no backend handler (dev/mock mode)
        const fake: Comment = {
          id: `tmp_${Date.now()}`,
          body: draft.trim(),
          mentions: [],
          parentId: parentId ?? null,
          createdAt: new Date().toISOString(),
          author: currentUser,
          replies: [],
        }
        if (parentId) {
          setList((prev) =>
            prev.map((c) => (c.id === parentId ? { ...c, replies: [...(c.replies ?? []), fake] } : c)),
          )
        } else {
          setList((prev) => [...prev, fake])
        }
      }
      setDraft('')
      setReplyingTo(null)
    } finally {
      setSending(false)
    }
  }

  const handleStartEdit = (c: Comment) => {
    setEditingId(c.id)
    setEditDraft(c.body)
  }

  const handleSaveEdit = async () => {
    if (!editingId || !editDraft.trim()) return
    if (onEdit) await onEdit(editingId, editDraft.trim())
    else {
      setList((prev) => prev.map((c) => (c.id === editingId ? { ...c, body: editDraft.trim(), editedAt: new Date().toISOString() } : {
        ...c,
        replies: c.replies?.map((r) => r.id === editingId ? { ...r, body: editDraft.trim(), editedAt: new Date().toISOString() } : r),
      })))
    }
    setEditingId(null)
    setEditDraft('')
  }

  const handleDelete = async (id: string) => {
    if (onDelete) await onDelete(id)
    else setList((prev) => prev
      .filter((c) => c.id !== id)
      .map((c) => ({ ...c, replies: c.replies?.filter((r) => r.id !== id) ?? [] })))
  }

  const rootComments = list.filter((c) => !c.parentId)

  return (
    <div className="space-y-4" data-entity-type={entityType} data-entity-id={entityId}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-900">
          Comments <span className="text-xs font-normal text-neutral-400">({rootComments.length})</span>
        </h3>
      </div>

      {/* List */}
      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {rootComments.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-6 px-4 rounded-lg border border-dashed border-neutral-200"
            >
              <p className="text-xs text-neutral-500">No comments yet</p>
              <p className="text-[11px] text-neutral-400 mt-0.5">Start the thread — use @ to tag teammates</p>
            </motion.div>
          )}
          {rootComments.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              currentUserId={currentUser.id}
              editingId={editingId}
              editDraft={editDraft}
              setEditDraft={setEditDraft}
              onStartEdit={handleStartEdit}
              onSaveEdit={handleSaveEdit}
              onCancelEdit={() => setEditingId(null)}
              onDelete={handleDelete}
              onReply={(id) => setReplyingTo(id)}
              replyingTo={replyingTo}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Composer */}
      <div className="relative">
        {replyingTo && (
          <div className="flex items-center justify-between px-3 py-1.5 rounded-t-lg bg-neutral-50 border border-neutral-200 border-b-0">
            <span className="text-[11px] text-neutral-600">
              Replying to thread · <button onClick={() => setReplyingTo(null)} className="text-brand-500 hover:underline">cancel</button>
            </span>
          </div>
        )}
        <div className="flex items-start gap-2">
          <Avatar name={currentUser.name} size="sm" />
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => handleDraftChange(e.target.value)}
              placeholder="Write a comment... use @ to mention"
              rows={2}
              className={`w-full px-3 py-2 text-sm border border-neutral-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition resize-none ${
                replyingTo ? 'rounded-b-lg rounded-t-none' : 'rounded-lg'
              }`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  handleSubmit()
                }
              }}
            />
            {/* Mention dropdown */}
            {mentionMenu.open && filteredUsers.length > 0 && (
              <div className="absolute bottom-full mb-1 left-0 w-64 bg-white rounded-lg border border-neutral-200 shadow-lg z-10 overflow-hidden">
                {filteredUsers.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => pickMention(u)}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-neutral-50 text-left transition-colors"
                  >
                    <Avatar name={u.name} size="xs" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-neutral-900 truncate">{u.name}</p>
                      {u.role && <p className="text-[10px] text-neutral-500 truncate">{u.role}</p>}
                    </div>
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[10px] text-neutral-400">⌘+Enter to send</span>
              <button
                onClick={handleSubmit}
                disabled={!draft.trim() || sending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="h-3 w-3" />
                {sending ? 'Sending...' : replyingTo ? 'Reply' : 'Comment'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ───────────────────────────────────────────
// CommentItem (supports replies one level deep)
// ───────────────────────────────────────────

interface CommentItemProps {
  comment: Comment
  currentUserId: string
  editingId: string | null
  editDraft: string
  setEditDraft: (v: string) => void
  onStartEdit: (c: Comment) => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  onDelete: (id: string) => void
  onReply: (id: string) => void
  replyingTo: string | null
}

function CommentItem({
  comment, currentUserId, editingId, editDraft, setEditDraft,
  onStartEdit, onSaveEdit, onCancelEdit, onDelete, onReply, replyingTo,
}: CommentItemProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const isAuthor = comment.author.id === currentUserId
  const isEditing = editingId === comment.id

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      className="group"
    >
      <div className="flex items-start gap-2">
        <Avatar name={comment.author.name} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="text-xs font-semibold text-neutral-900">{comment.author.name}</span>
            {comment.author.role && <span className="text-[10px] text-neutral-400">{comment.author.role}</span>}
            <span className="text-[10px] text-neutral-400">{formatTime(comment.createdAt)}</span>
            {comment.editedAt && <span className="text-[10px] text-neutral-400 italic">(edited)</span>}
          </div>

          {isEditing ? (
            <div>
              <textarea
                value={editDraft}
                onChange={(e) => setEditDraft(e.target.value)}
                rows={2}
                className="w-full px-2.5 py-1.5 text-xs border border-brand-300 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition resize-none rounded-md"
              />
              <div className="flex items-center gap-2 mt-1">
                <button onClick={onSaveEdit} className="px-2.5 py-1 rounded-md bg-brand-500 hover:bg-brand-600 text-white text-[11px] font-semibold">Save</button>
                <button onClick={onCancelEdit} className="px-2.5 py-1 rounded-md text-neutral-600 hover:bg-neutral-100 text-[11px]">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="text-xs text-neutral-800 leading-relaxed whitespace-pre-wrap break-words">
              {renderBody(comment.body)}
            </div>
          )}

          {/* Action bar */}
          {!isEditing && (
            <div className="flex items-center gap-3 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onReply(comment.id)}
                className={`text-[10px] font-medium flex items-center gap-0.5 transition-colors ${
                  replyingTo === comment.id ? 'text-brand-500' : 'text-neutral-500 hover:text-neutral-700'
                }`}
              >
                <Reply className="h-2.5 w-2.5" />
                Reply
              </button>
              {isAuthor && (
                <div className="relative">
                  <button
                    onClick={() => setMenuOpen((o) => !o)}
                    className="text-neutral-400 hover:text-neutral-700 transition-colors"
                  >
                    <MoreHorizontal className="h-3 w-3" />
                  </button>
                  {menuOpen && (
                    <div className="absolute left-0 top-full mt-1 bg-white rounded-lg border border-neutral-200 shadow-lg z-10 overflow-hidden min-w-[120px]">
                      <button
                        onClick={() => { onStartEdit(comment); setMenuOpen(false) }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-neutral-700 hover:bg-neutral-50"
                      >
                        <Edit2 className="h-3 w-3" /> Edit
                      </button>
                      <button
                        onClick={() => { onDelete(comment.id); setMenuOpen(false) }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-danger-600 hover:bg-danger-50"
                      >
                        <Trash2 className="h-3 w-3" /> Delete
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Replies */}
          {comment.replies && comment.replies.length > 0 && (
            <div className="mt-3 pl-3 border-l-2 border-neutral-100 space-y-2.5">
              {comment.replies.map((r) => (
                <CommentItem
                  key={r.id}
                  comment={r}
                  currentUserId={currentUserId}
                  editingId={editingId}
                  editDraft={editDraft}
                  setEditDraft={setEditDraft}
                  onStartEdit={onStartEdit}
                  onSaveEdit={onSaveEdit}
                  onCancelEdit={onCancelEdit}
                  onDelete={onDelete}
                  onReply={onReply}
                  replyingTo={replyingTo}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
