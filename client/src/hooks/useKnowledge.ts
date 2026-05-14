import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '@/lib/api'

// ───────────────────────────────────────────
// Knowledge base hook — list / read / create / update / delete.
// Search and category filter run server-side so we don't load the
// full corpus on the client.
// ───────────────────────────────────────────

export interface KnowledgeAuthor {
  id: string
  name: string
  avatar: string | null
  role: string
}

export interface ArticleSummary {
  id: string
  title: string
  category: string
  department: string | null
  viewCount: number
  createdAt: string
  updatedAt: string
  authorId: string | null
  author: KnowledgeAuthor | null
}

export interface ArticleFull extends ArticleSummary {
  content: string
}

export interface CategoryCount {
  name: string
  count: number
}

const now = new Date().toISOString()

const FALLBACK_ARTICLES: ArticleSummary[] = [
  { id: 'a1', title: 'Client Onboarding Checklist', category: 'Operations', department: null, viewCount: 45, createdAt: now, updatedAt: now, authorId: 'u4', author: { id: 'u4', name: 'Emily Torres', avatar: null, role: 'MANAGER' } },
  { id: 'a2', title: 'Brand Guidelines Template', category: 'Design', department: null, viewCount: 32, createdAt: now, updatedAt: now, authorId: 'u3', author: { id: 'u3', name: 'Amir Khan', avatar: null, role: 'EMPLOYEE' } },
  { id: 'a3', title: 'Sprint Planning Best Practices', category: 'Development', department: null, viewCount: 28, createdAt: now, updatedAt: now, authorId: 'u2', author: { id: 'u2', name: 'Sarah Chen', avatar: null, role: 'MANAGER' } },
  { id: 'a4', title: 'How to Write a Winning Proposal', category: 'Sales', department: null, viewCount: 56, createdAt: now, updatedAt: now, authorId: 'u8', author: { id: 'u8', name: 'Zara Ahmed', avatar: null, role: 'MANAGER' } },
  { id: 'a5', title: 'Employee Leave Policy 2026', category: 'HR', department: null, viewCount: 67, createdAt: now, updatedAt: now, authorId: 'u9', author: { id: 'u9', name: 'Hira Malik', avatar: null, role: 'MANAGER' } },
]

const FALLBACK_CATEGORIES: CategoryCount[] = [
  { name: 'Operations', count: 2 },
  { name: 'Design', count: 1 },
  { name: 'Development', count: 1 },
  { name: 'Sales', count: 1 },
  { name: 'HR', count: 1 },
]

export function useKnowledge() {
  const [articles, setArticles] = useState<ArticleSummary[]>(FALLBACK_ARTICLES)
  const [categories, setCategories] = useState<CategoryCount[]>(FALLBACK_CATEGORIES)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [usingFallback, setUsingFallback] = useState(false)

  const load = useCallback(async () => {
    const params = new URLSearchParams()
    if (search.trim()) params.set('q', search.trim())
    if (category) params.set('category', category)
    const qs = params.toString() ? `?${params.toString()}` : ''
    try {
      const res = await api.get<{ articles: ArticleSummary[]; categories: CategoryCount[] }>(`/knowledge${qs}`)
      setArticles(res.articles)
      setCategories(res.categories)
      setUsingFallback(false)
    } catch (err) {
      setUsingFallback(err instanceof ApiError && err.status === 0)
    } finally {
      setLoading(false)
    }
  }, [search, category])

  useEffect(() => {
    const t = setTimeout(() => void load(), 200)
    return () => clearTimeout(t)
  }, [load])

  const fetchArticle = useCallback(async (id: string): Promise<ArticleFull> => {
    const res = await api.get<{ article: ArticleFull }>(`/knowledge/${id}`)
    return res.article
  }, [])

  const createArticle = useCallback(
    async (payload: { title: string; content: string; category: string; department?: string | null }) => {
      const res = await api.post<{ article: ArticleFull }>('/knowledge', payload)
      await load()
      return res.article
    },
    [load],
  )

  const updateArticle = useCallback(
    async (id: string, patch: Partial<{ title: string; content: string; category: string; department: string | null }>) => {
      await api.patch<unknown>(`/knowledge/${id}`, patch)
      await load()
    },
    [load],
  )

  const deleteArticle = useCallback(
    async (id: string) => {
      await api.del<unknown>(`/knowledge/${id}`)
      await load()
    },
    [load],
  )

  return {
    articles, categories, search, category, loading, usingFallback,
    setSearch, setCategory, refresh: load,
    fetchArticle, createArticle, updateArticle, deleteArticle,
  }
}
