import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '@/lib/api'

// ───────────────────────────────────────────
// Documents hook — rich-text contracts/proposals/templates.
// List endpoint returns lean summaries; fetchDocument pulls content.
// ───────────────────────────────────────────

export type DocumentType = 'contract' | 'proposal' | 'template' | 'report' | 'policy' | 'other'
export type DocumentStatus = 'draft' | 'sent' | 'signed' | 'expired'

export interface DocumentSummary {
  id: string
  title: string
  type: DocumentType
  status: DocumentStatus
  version: number
  clientId: string | null
  client: { id: string; company: string } | null
  authorId: string | null
  author: { id: string; name: string; avatar: string | null } | null
  signedAt: string | null
  signatureExpiry: string | null
  createdAt: string
  updatedAt: string
}

export interface DocumentFull extends DocumentSummary {
  content: string | null
}

export interface DocumentFilters {
  type?: DocumentType
  status?: DocumentStatus
  clientId?: string
  q?: string
}

const now = new Date().toISOString()
const FALLBACK: DocumentSummary[] = [
  { id: 'd1', title: 'Service Agreement — Bella Cucina', type: 'contract', status: 'signed', version: 2, clientId: 'c1', client: { id: 'c1', company: 'Bella Cucina' }, authorId: 'u1', author: { id: 'u1', name: 'Noman Ali', avatar: null }, signedAt: now, signatureExpiry: null, createdAt: now, updatedAt: now },
  { id: 'd2', title: 'Q2 Revenue Report', type: 'report', status: 'sent', version: 1, clientId: null, client: null, authorId: 'u1', author: { id: 'u1', name: 'Noman Ali', avatar: null }, signedAt: null, signatureExpiry: null, createdAt: now, updatedAt: now },
  { id: 'd3', title: 'CareFirst Portal Proposal', type: 'proposal', status: 'sent', version: 3, clientId: 'c2', client: { id: 'c2', company: 'CareFirst Health' }, authorId: 'u8', author: { id: 'u8', name: 'Zara Ahmed', avatar: null }, signedAt: null, signatureExpiry: null, createdAt: now, updatedAt: now },
  { id: 'd4', title: 'DataFlow SOW v2', type: 'contract', status: 'draft', version: 1, clientId: 'c3', client: { id: 'c3', company: 'DataFlow Inc' }, authorId: 'u4', author: { id: 'u4', name: 'Emily Torres', avatar: null }, signedAt: null, signatureExpiry: null, createdAt: now, updatedAt: now },
  { id: 'd5', title: 'Invoice Template', type: 'template', status: 'sent', version: 1, clientId: null, client: null, authorId: 'u1', author: { id: 'u1', name: 'Noman Ali', avatar: null }, signedAt: null, signatureExpiry: null, createdAt: now, updatedAt: now },
  { id: 'd6', title: 'Employee Handbook 2026', type: 'policy', status: 'sent', version: 4, clientId: null, client: null, authorId: 'u9', author: { id: 'u9', name: 'Hira Malik', avatar: null }, signedAt: null, signatureExpiry: null, createdAt: now, updatedAt: now },
]

export function useDocuments(initialFilters: DocumentFilters = {}) {
  const [documents, setDocuments] = useState<DocumentSummary[]>(FALLBACK)
  const [filters, setFilters] = useState<DocumentFilters>(initialFilters)
  const [loading, setLoading] = useState(true)
  const [usingFallback, setUsingFallback] = useState(false)

  const queryString = (() => {
    const p = new URLSearchParams()
    if (filters.type) p.set('type', filters.type)
    if (filters.status) p.set('status', filters.status)
    if (filters.clientId) p.set('clientId', filters.clientId)
    if (filters.q && filters.q.trim()) p.set('q', filters.q.trim())
    return p.toString() ? `?${p.toString()}` : ''
  })()

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ documents: DocumentSummary[] }>(`/documents${queryString}`)
      setDocuments(res.documents)
      setUsingFallback(false)
    } catch (err) {
      setUsingFallback(err instanceof ApiError && err.status === 0)
    } finally {
      setLoading(false)
    }
  }, [queryString])

  useEffect(() => {
    const t = setTimeout(() => void load(), 150)
    return () => clearTimeout(t)
  }, [load])

  const fetchDocument = useCallback(async (id: string): Promise<DocumentFull> => {
    const res = await api.get<{ document: DocumentFull }>(`/documents/${id}`)
    return res.document
  }, [])

  const createDocument = useCallback(
    async (payload: {
      title: string
      type: DocumentType
      content?: string
      clientId?: string | null
      status?: DocumentStatus
    }) => {
      const res = await api.post<{ document: DocumentFull }>('/documents', payload)
      await load()
      return res.document
    },
    [load],
  )

  const updateDocument = useCallback(
    async (id: string, patch: Partial<{ title: string; type: DocumentType; content: string; clientId: string | null; status: DocumentStatus }>) => {
      const res = await api.patch<{ document: DocumentFull }>(`/documents/${id}`, patch)
      await load()
      return res.document
    },
    [load],
  )

  const deleteDocument = useCallback(
    async (id: string) => {
      await api.del<unknown>(`/documents/${id}`)
      await load()
    },
    [load],
  )

  return {
    documents, filters, loading, usingFallback,
    setFilters, refresh: load,
    fetchDocument, createDocument, updateDocument, deleteDocument,
  }
}
