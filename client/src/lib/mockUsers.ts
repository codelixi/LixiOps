// Temporary mock directory for @mention autocomplete and currentUser.
// Replace with real /api/v1/users + auth context in Phase F4.
import type { CommentAuthor } from '@/components/comments/CommentsPanel'

export const mockUsers: CommentAuthor[] = [
  { id: 'u_noman', name: 'Noman Ali', email: 'noman@codelixi.com', role: 'CEO' },
  { id: 'u_emily', name: 'Emily Torres', email: 'emily@codelixi.com', role: 'MANAGER' },
  { id: 'u_amir', name: 'Amir Khan', email: 'amir@codelixi.com', role: 'DESIGNER' },
  { id: 'u_sarah', name: 'Sarah Chen', email: 'sarah@codelixi.com', role: 'DEVELOPER' },
  { id: 'u_raj', name: 'Raj Patel', email: 'raj@codelixi.com', role: 'DEVELOPER' },
]

// Pretend the CEO is logged in until auth wiring lands.
export const mockCurrentUser: CommentAuthor = mockUsers[0]
