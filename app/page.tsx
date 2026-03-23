'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type RequestItem = {
  id: string
  title: string
  content: string
  sender_id: string
  recipient_id: string | null
  status: string | null
  priority: string | null
  deadline: string | null
  created_at: string
  completed_at: string | null
  batch_id?: string | null
}

type UserItem = {
  id: string
  email: string | null
  name: string | null
  role: string | null
}

type ViewKey = 'dashboard' | 'received' | 'sent' | 'history'

type SentDisplayItem =
  | {
      type: 'single'
      request: RequestItem
    }
  | {
      type: 'batch'
      batchId: string
      title: string
      content: string
      priority: string | null
      deadline: string | null
      created_at: string
      sender_id: string
      requests: RequestItem[]
    }

const STATUS_OPTIONS = ['未確認', '対応中', '完了']
const PRIORITY_OPTIONS = ['低', '中', '高']

const MY_CONNECT_URL =
  'https://script.google.com/a/macros/chronusinc.jp/s/AKfycbzSKDnhFKHWFQZwlUVpi5yrXHuH2GCc4gUny2fUslMkrABG0vAQrTCHzyHBre1fJJT-dg/exec'

const STATUS_META: Record<
  string,
  {
    label: string
    className: string
  }
> = {
  未確認: {
    label: '未確認',
    className: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200',
  },
  対応中: {
    label: '対応中',
    className:
      'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
  },
  完了: {
    label: '完了',
    className: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
  },
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

function formatDate(value: string | null | undefined) {
  if (!value) return '未設定'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  })
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '未設定'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('ja-JP', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function isOverdue(deadline: string | null | undefined) {
  if (!deadline) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(deadline)
  due.setHours(0, 0, 0, 0)
  return due < today
}

function getRequestCardStyle(request: RequestItem) {
  const status = request.status ?? '未確認'
  if (status === '未確認' && isOverdue(request.deadline)) {
    return {
      cardClassName:
        'border border-red-200 bg-red-50/70 shadow-sm shadow-red-100/40',
      statusClassName:
        'bg-red-100 text-red-700 ring-1 ring-inset ring-red-200',
    }
  }

  if (status === '未確認') {
    return {
      cardClassName: 'border border-slate-200 bg-white shadow-sm',
      statusClassName:
        'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200',
    }
  }

  if (status === '対応中') {
    return {
      cardClassName: 'border border-slate-200 bg-white shadow-sm',
      statusClassName:
        'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
    }
  }

  return {
    cardClassName: 'border border-slate-200 bg-white shadow-sm',
    statusClassName:
      STATUS_META[status]?.className ??
      'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200',
  }
}

function sortActiveRequests(requests: RequestItem[]) {
  const rank = (request: RequestItem) => {
    const status = request.status ?? '未確認'
    if (status === '未確認' && isOverdue(request.deadline)) return 0
    if (status === '未確認') return 1
    if (status === '対応中') return 2
    return 3
  }

  return [...requests].sort((a, b) => {
    const rankDiff = rank(a) - rank(b)
    if (rankDiff !== 0) return rankDiff

    const deadlineA = a.deadline ? new Date(a.deadline).getTime() : Number.MAX_SAFE_INTEGER
    const deadlineB = b.deadline ? new Date(b.deadline).getTime() : Number.MAX_SAFE_INTEGER
    if (deadlineA !== deadlineB) return deadlineA - deadlineB

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
}

function getUserLabel(user: UserItem | undefined) {
  if (!user) return '未設定ユーザー'
  return user.name?.trim() || user.email?.trim() || '名称未設定'
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-4 w-4"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  )
}

function LogoutIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  )
}

function LoginIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <path d="M10 17l5-5-5-5" />
      <path d="M15 12H3" />
    </svg>
  )
}

function MenuIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18" />
      <path d="M6 6l12 12" />
    </svg>
  )
}

function EditIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  )
}

function EyeIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function ChevronDownIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

function ChevronRightIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  )
}

function DashboardIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="8" height="8" rx="2" />
      <rect x="13" y="3" width="8" height="5" rx="2" />
      <rect x="13" y="10" width="8" height="11" rx="2" />
      <rect x="3" y="13" width="8" height="8" rx="2" />
    </svg>
  )
}

function InboxIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 13.5V6.5A2.5 2.5 0 0 1 5.5 4h13A2.5 2.5 0 0 1 21 6.5v7" />
      <path d="M3 13.5 5.4 18a2 2 0 0 0 1.76 1h9.68a2 2 0 0 0 1.76-1L21 13.5" />
      <path d="M9 13h6" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m3 20 18-8L3 4v6l12 2-12 2v6Z" />
    </svg>
  )
}

function HistoryIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 3v6h6" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

export default function Home() {
  const [user, setUser] = useState<any>(null)
  const [requests, setRequests] = useState<RequestItem[]>([])
  const [users, setUsers] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [createFormOpen, setCreateFormOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [activeView, setActiveView] = useState<ViewKey>('dashboard')
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(false)
  const [userSearch, setUserSearch] = useState('')

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [recipientIds, setRecipientIds] = useState<string[]>([])
  const [status, setStatus] = useState('未確認')
  const [priority, setPriority] = useState('中')
  const [deadline, setDeadline] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [detailTarget, setDetailTarget] = useState<RequestItem | null>(null)

  const currentUserId = user?.id ?? null

  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      setUser(session?.user ?? null)
      setLoading(false)
    }

    fetchUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
      },
    })
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, name, role')
      .order('created_at', { ascending: true })

    if (error) {
      console.error('users取得エラー:', error)
      return
    }

    setUsers((data as UserItem[]) ?? [])
  }

  const fetchRequests = async () => {
    if (!currentUserId) {
      setRequests([])
      return
    }

    const { data, error } = await supabase
      .from('requests')
      .select(
        'id, title, content, sender_id, recipient_id, status, priority, deadline, created_at, completed_at, batch_id'
      )
      .or(`sender_id.eq.${currentUserId},recipient_id.eq.${currentUserId}`)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('requests取得エラー:', error)
      return
    }

    setRequests((data as RequestItem[]) ?? [])
  }

  useEffect(() => {
    if (!currentUserId) {
      setRequests([])
      setUsers([])
      return
    }

    fetchUsers()
    fetchRequests()
  }, [currentUserId])

  const currentUserProfile = useMemo(() => {
    return users.find((item) => item.id === currentUserId)
  }, [users, currentUserId])

  const userMap = useMemo(() => {
    return new Map(users.map((item) => [item.id, item]))
  }, [users])

  const receivedRequests = useMemo(() => {
    return requests.filter((item) => item.recipient_id === currentUserId)
  }, [requests, currentUserId])

  const sentRequests = useMemo(() => {
    return requests.filter((item) => item.sender_id === currentUserId)
  }, [requests, currentUserId])

  const activeReceivedRequests = useMemo(() => {
    return sortActiveRequests(
      receivedRequests.filter((item) => (item.status ?? '未確認') !== '完了')
    )
  }, [receivedRequests])

  const historyRequests = useMemo(() => {
    return requests
      .filter((item) => (item.status ?? '未確認') === '完了')
      .sort((a, b) => {
        const completedA = a.completed_at ? new Date(a.completed_at).getTime() : 0
        const completedB = b.completed_at ? new Date(b.completed_at).getTime() : 0
        return completedB - completedA
      })
  }, [requests])

  const sentDisplayItems = useMemo<SentDisplayItem[]>(() => {
    const grouped = new Map<string, RequestItem[]>()
    const singles: RequestItem[] = []

    for (const item of sentRequests) {
      if (item.batch_id) {
        const current = grouped.get(item.batch_id) ?? []
        current.push(item)
        grouped.set(item.batch_id, current)
      } else {
        singles.push(item)
      }
    }

    const batchItems: SentDisplayItem[] = Array.from(grouped.entries()).map(
      ([batchId, batchRequests]) => {
        const sorted = [...batchRequests].sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        const base = sorted[0]
        return {
          type: 'batch',
          batchId,
          title: base.title,
          content: base.content,
          priority: base.priority,
          deadline: base.deadline,
          created_at: base.created_at,
          sender_id: base.sender_id,
          requests: sorted,
        }
      }
    )

    const singleItems: SentDisplayItem[] = singles.map((request) => ({
      type: 'single',
      request,
    }))

    return [...batchItems, ...singleItems].sort((a, b) => {
      const dateA =
        a.type === 'batch'
          ? new Date(a.created_at).getTime()
          : new Date(a.request.created_at).getTime()
      const dateB =
        b.type === 'batch'
          ? new Date(b.created_at).getTime()
          : new Date(b.request.created_at).getTime()
      return dateB - dateA
    })
  }, [sentRequests])

  const filteredRecipientCandidates = useMemo(() => {
    const keyword = userSearch.trim().toLowerCase()
    const candidates = users.filter((item) => item.id !== currentUserId)

    if (!keyword) return candidates

    return candidates.filter((item) => {
      const name = item.name?.toLowerCase() ?? ''
      const email = item.email?.toLowerCase() ?? ''
      return name.includes(keyword) || email.includes(keyword)
    })
  }, [users, currentUserId, userSearch])

  const dashboardCounts = useMemo(() => {
    const overduePendingCount = receivedRequests.filter((item) => {
      const currentStatus = item.status ?? '未確認'
      return currentStatus !== '完了' && isOverdue(item.deadline)
    }).length

    const pendingCount = receivedRequests.filter((item) => {
      const currentStatus = item.status ?? '未確認'
      return currentStatus !== '完了'
    }).length

    const recentSent = sentDisplayItems.slice(0, 5)

    return {
      overduePendingCount,
      pendingCount,
      recentSent,
      receivedTotal: receivedRequests.length,
      sentTotal: sentRequests.length,
      completedTotal: historyRequests.length,
    }
  }, [receivedRequests, sentRequests, sentDisplayItems, historyRequests])

  const resetForm = () => {
    setTitle('')
    setContent('')
    setRecipientIds([])
    setStatus('未確認')
    setPriority('中')
    setDeadline('')
    setEditingId(null)
    setUserSearch('')
  }

  const handleToggleRecipient = (id: string) => {
    setRecipientIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const handleSelectAllRecipients = () => {
    setRecipientIds(filteredRecipientCandidates.map((item) => item.id))
  }

  const handleClearRecipients = () => {
    setRecipientIds([])
  }

  const handleCreateRequest = async () => {
    if (!currentUserId) return

    const trimmedTitle = title.trim()
    const trimmedContent = content.trim()

    if (!trimmedTitle || !trimmedContent) {
      alert('タイトルと内容を入力してください。')
      return
    }

    if (recipientIds.length === 0) {
      alert('共有先を1名以上選択してください。')
      return
    }

    setSubmitting(true)

    try {
      if (editingId) {
        const target = requests.find((item) => item.id === editingId)
        if (!target) {
          alert('更新対象が見つかりませんでした。')
          setSubmitting(false)
          return
        }

        const updatePayload = {
          title: trimmedTitle,
          content: trimmedContent,
          recipient_id: recipientIds[0] ?? null,
          status,
          priority,
          deadline: deadline || null,
        }

        const { error } = await supabase
          .from('requests')
          .update(updatePayload)
          .eq('id', editingId)

        if (error) {
          console.error('更新エラー:', error)
          alert('更新に失敗しました。')
          setSubmitting(false)
          return
        }

        resetForm()
        setCreateFormOpen(false)
        setSubmitting(false)
        fetchRequests()
        return
      }

      const batchId =
        recipientIds.length >= 2
          ? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
          : null

      const insertPayload = recipientIds.map((recipientId) => ({
        title: trimmedTitle,
        content: trimmedContent,
        sender_id: currentUserId,
        recipient_id: recipientId,
        status,
        priority,
        deadline: deadline || null,
        batch_id: batchId,
      }))

      const { error } = await supabase.from('requests').insert(insertPayload)

      if (error) {
        console.error('作成エラー:', error)
        alert('保存に失敗しました。')
        setSubmitting(false)
        return
      }

      resetForm()
      setCreateFormOpen(false)
      setSubmitting(false)
      fetchRequests()
    } catch (error) {
      console.error('保存処理エラー:', error)
      alert('保存に失敗しました。')
      setSubmitting(false)
    }
  }

  const handleStartEdit = (request: RequestItem) => {
    setEditingId(request.id)
    setTitle(request.title)
    setContent(request.content)
    setRecipientIds(request.recipient_id ? [request.recipient_id] : [])
    setStatus(request.status ?? '未確認')
    setPriority(request.priority ?? '中')
    setDeadline(request.deadline ?? '')
    setCreateFormOpen(true)
    setActiveView('sent')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = async (requestId: string) => {
    const confirmed = window.confirm('この依頼を削除しますか？')
    if (!confirmed) return

    const { error } = await supabase
      .from('requests')
      .delete()
      .eq('id', requestId)

    if (error) {
      console.error('削除エラー:', error)
      alert('削除に失敗しました。')
      return
    }

    fetchRequests()
  }

  const handleStatusChange = async (requestId: string, nextStatus: string) => {
    const updatePayload: {
      status: string
      completed_at?: string | null
    } = {
      status: nextStatus,
    }

    if (nextStatus === '完了') {
      updatePayload.completed_at = new Date().toISOString()
    } else {
      updatePayload.completed_at = null
    }

    const { error } = await supabase
      .from('requests')
      .update(updatePayload)
      .eq('id', requestId)

    if (error) {
      console.error('ステータス更新エラー:', error)
      alert('ステータス更新に失敗しました。')
      return
    }

    fetchRequests()
  }

  const menuItems: Array<{
    key: ViewKey
    label: string
    icon: JSX.Element
  }> = [
    { key: 'dashboard', label: 'ダッシュボード', icon: <DashboardIcon /> },
    { key: 'received', label: '受信依頼', icon: <InboxIcon /> },
    { key: 'sent', label: '送信依頼', icon: <SendIcon /> },
    { key: 'history', label: '履歴', icon: <HistoryIcon /> },
  ]

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <div
      className={cn(
        'flex h-full flex-col border-r border-slate-200 bg-slate-950 text-white',
        mobile ? 'w-72' : desktopSidebarCollapsed ? 'w-[88px]' : 'w-72'
      )}
    >
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
        <div className={cn('min-w-0', desktopSidebarCollapsed && !mobile && 'hidden')}>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Work-Hub
          </p>
          <h1 className="truncate text-lg font-semibold text-white">業務管理アプリ</h1>
        </div>

        {!mobile && (
          <button
            type="button"
            onClick={() => setDesktopSidebarCollapsed((prev) => !prev)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10"
          >
            {desktopSidebarCollapsed ? <ChevronRightIcon /> : <ChevronDownIcon />}
          </button>
        )}

        {mobile && (
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(false)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10"
          >
            <CloseIcon />
          </button>
        )}
      </div>

      <div className="border-b border-white/10 px-4 py-4">
        <div
          className={cn(
            'rounded-2xl border border-white/10 bg-white/5 p-4',
            desktopSidebarCollapsed && !mobile && 'flex items-center justify-center p-3'
          )}
        >
          {desktopSidebarCollapsed && !mobile ? (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-sm font-semibold">
              {(currentUserProfile?.name?.trim() || user?.email || 'U').slice(0, 1)}
            </div>
          ) : (
            <>
              <p className="text-sm font-semibold text-white">
                {currentUserProfile?.name?.trim() || 'ログイン中'}
              </p>
              <p className="mt-1 truncate text-xs text-slate-300">
                {user?.email || 'メール未取得'}
              </p>
            </>
          )}
        </div>
      </div>

      <nav className="flex-1 space-y-2 px-3 py-4">
        {menuItems.map((item) => {
          const active = activeView === item.key
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                setActiveView(item.key)
                setMobileSidebarOpen(false)
              }}
              className={cn(
                'flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-medium transition',
                active
                  ? 'bg-white text-slate-950 shadow-sm'
                  : 'text-slate-200 hover:bg-white/10',
                desktopSidebarCollapsed && !mobile && 'justify-center px-0'
              )}
            >
              <span>{item.icon}</span>
              {(!desktopSidebarCollapsed || mobile) && <span>{item.label}</span>}
            </button>
          )
        })}
      </nav>

      <div className="border-t border-white/10 p-3">
        {user ? (
          <button
            type="button"
            onClick={handleLogout}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-2xl bg-white/10 px-3 py-3 text-sm font-semibold text-white transition hover:bg-white/15',
              desktopSidebarCollapsed && !mobile ? 'px-0' : ''
            )}
          >
            <LogoutIcon />
            {(!desktopSidebarCollapsed || mobile) && <span>ログアウト</span>}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleLogin}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-2xl bg-white/10 px-3 py-3 text-sm font-semibold text-white transition hover:bg-white/15',
              desktopSidebarCollapsed && !mobile ? 'px-0' : ''
            )}
          >
            <LoginIcon />
            {(!desktopSidebarCollapsed || mobile) && <span>ログイン</span>}
          </button>
        )}
      </div>
    </div>
  )

  const renderRequestCard = (request: RequestItem, showRecipient = false) => {
    const cardStyle = getRequestCardStyle(request)
    const senderName = getUserLabel(userMap.get(request.sender_id))
    const recipientName = getUserLabel(
      request.recipient_id ? userMap.get(request.recipient_id) : undefined
    )

    return (
      <div
        key={request.id}
        className={cn(
          'rounded-3xl p-4 transition sm:p-5',
          cardStyle.cardClassName
        )}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-slate-900">{request.title}</h3>
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold',
                  cardStyle.statusClassName
                )}
              >
                {request.status ?? '未確認'}
              </span>
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                優先度：{request.priority ?? '中'}
              </span>
            </div>

            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {request.content}
            </p>

            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
              <span>送信者：{senderName}</span>
              {showRecipient && <span>共有先：{recipientName}</span>}
              <span>期限：{formatDate(request.deadline)}</span>
              <span>作成日：{formatDateTime(request.created_at)}</span>
              {(request.status ?? '未確認') === '完了' && (
                <span>完了日：{formatDateTime(request.completed_at)}</span>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:pl-4">
            {request.sender_id === currentUserId && (request.status ?? '未確認') !== '完了' && (
              <>
                <button
                  type="button"
                  onClick={() => handleStartEdit(request)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
                  title="編集"
                >
                  <EditIcon />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(request.id)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-red-200 bg-white text-red-600 transition hover:bg-red-50"
                  title="削除"
                >
                  <TrashIcon />
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => setDetailTarget(request)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
              title="詳細"
            >
              <EyeIcon />
            </button>
          </div>
        </div>

        {request.recipient_id === currentUserId && (request.status ?? '未確認') !== '完了' && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {STATUS_OPTIONS.filter((item) => item !== '完了').map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => handleStatusChange(request.id, item)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-xs font-semibold transition',
                  (request.status ?? '未確認') === item
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-50'
                )}
              >
                {item}
              </button>
            ))}

            <button
              type="button"
              onClick={() => handleStatusChange(request.id, '完了')}
              className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
            >
              完了
            </button>
          </div>
        )}
      </div>
    )
  }

  const renderSentCard = (item: SentDisplayItem) => {
    if (item.type === 'single') {
      return renderRequestCard(item.request, true)
    }

    const unresolved = item.requests.filter(
      (request) => (request.status ?? '未確認') !== '完了'
    )
    const unresolvedNames = unresolved.map((request) =>
      getUserLabel(request.recipient_id ? userMap.get(request.recipient_id) : undefined)
    )

    return (
      <div
        key={item.batchId}
        className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-slate-900">{item.title}</h3>
              <span className="inline-flex items-center rounded-full bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white">
                同時送信 {item.requests.length}名
              </span>
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                優先度：{item.priority ?? '中'}
              </span>
            </div>

            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {item.content}
            </p>

            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
              <span>期限：{formatDate(item.deadline)}</span>
              <span>作成日：{formatDateTime(item.created_at)}</span>
            </div>

            <div className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">
              <p className="font-semibold text-slate-800">未確認者：</p>
              <p className="mt-1 break-words">
                {unresolvedNames.length > 0 ? unresolvedNames.join('、') : '全員対応済み'}
              </p>
            </div>

            <div className="mt-4 grid gap-3">
              {item.requests
                .slice()
                .sort((a, b) => {
                  const statusA = a.status ?? '未確認'
                  const statusB = b.status ?? '未確認'
                  if (statusA === statusB) return 0
                  if (statusA === '未確認') return -1
                  if (statusB === '未確認') return 1
                  if (statusA === '対応中') return -1
                  if (statusB === '対応中') return 1
                  return 0
                })
                .map((request) => {
                  const recipientName = getUserLabel(
                    request.recipient_id ? userMap.get(request.recipient_id) : undefined
                  )

                  return (
                    <div
                      key={request.id}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800">
                            {recipientName}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            ステータス：{request.status ?? '未確認'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {request.sender_id === currentUserId &&
                            (request.status ?? '未確認') !== '完了' && (
                              <button
                                type="button"
                                onClick={() => handleDelete(request.id)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-red-200 bg-white text-red-600 transition hover:bg-red-50"
                                title="削除"
                              >
                                <TrashIcon />
                              </button>
                            )}
                          <button
                            type="button"
                            onClick={() => setDetailTarget(request)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
                            title="詳細"
                          >
                            <EyeIcon />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderCreateForm = () => (
    <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            {editingId ? '依頼を編集' : '新規依頼を作成'}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            タイトル・内容・共有先を入力してください
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setCreateFormOpen(false)
            resetForm()
          }}
          className="inline-flex h-10 items-center gap-2 rounded-2xl border border-slate-200 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          <CloseIcon />
          閉じる
        </button>
      </div>

      <div className="mt-6 grid gap-5">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            タイトル
          </label>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="例：◯◯案件の確認対応"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            内容
          </label>
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            rows={5}
            placeholder="依頼内容を入力してください"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400"
          />
        </div>

        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <label className="block text-sm font-medium text-slate-700">
              共有先
            </label>

            {!editingId && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllRecipients}
                  className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
                >
                  全選択
                </button>
                <button
                  type="button"
                  onClick={handleClearRecipients}
                  className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
                >
                  選択解除
                </button>
              </div>
            )}
          </div>

          {!editingId && (
            <div className="relative mb-3">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <SearchIcon />
              </span>
              <input
                value={userSearch}
                onChange={(event) => setUserSearch(event.target.value)}
                placeholder="名前・メールで検索"
                className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm outline-none transition focus:border-slate-400"
              />
            </div>
          )}

          <div className="max-h-64 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-3">
            {(editingId ? users.filter((item) => item.id !== currentUserId) : filteredRecipientCandidates).map(
              (item) => {
                const checked = recipientIds.includes(item.id)
                return (
                  <label
                    key={item.id}
                    className="flex cursor-pointer items-center gap-3 rounded-2xl bg-white px-4 py-3 text-sm text-slate-700 ring-1 ring-inset ring-slate-200 transition hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleToggleRecipient(item.id)}
                      className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                      disabled={!!editingId && item.id !== recipientIds[0]}
                    />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">
                        {getUserLabel(item)}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {item.email || 'メール未設定'}
                      </p>
                    </div>
                  </label>
                )
              }
            )}

            {!editingId && filteredRecipientCandidates.length === 0 && (
              <p className="py-6 text-center text-sm text-slate-500">
                該当するユーザーがいません
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              ステータス
            </label>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400"
            >
              {STATUS_OPTIONS.filter((item) => item !== '完了').map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              優先度
            </label>
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400"
            >
              {PRIORITY_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              期限
            </label>
            <input
              type="date"
              value={deadline}
              onChange={(event) => setDeadline(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400"
            />
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              resetForm()
              setCreateFormOpen(false)
            }}
            className="inline-flex h-11 items-center rounded-2xl border border-slate-200 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            キャンセル
          </button>

          <button
            type="button"
            onClick={handleCreateRequest}
            disabled={submitting}
            className="inline-flex h-11 items-center rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {submitting ? '保存中...' : editingId ? '更新する' : '保存する'}
          </button>
        </div>
      </div>
    </div>
  )

  const renderDashboard = () => (
    <div className="grid gap-4 lg:grid-cols-3">
      <a
        href={MY_CONNECT_URL}
        target="_blank"
        rel="noreferrer"
        className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-500">マイコネクト</p>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              外部リンク
            </span>
          </div>
          <div className="mt-4 flex-1">
            <h2 className="text-xl font-semibold text-slate-900">
              マイコネクトを開く
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              タップすると指定のマイコネクト画面へ移動します。
            </p>
          </div>
        </div>
      </a>

      <div className="rounded-[28px] border border-red-200 bg-red-50/80 p-5 shadow-sm">
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-red-700">期限切れ・要対応</p>
            <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-200">
              優先確認
            </span>
          </div>
          <div className="mt-4 flex-1">
            <p className="text-4xl font-bold tracking-tight text-red-700">
              {dashboardCounts.overduePendingCount}
            </p>
            <p className="mt-2 text-sm leading-6 text-red-700/80">
              期限切れで未完了の依頼件数です。
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-500">未対応の依頼</p>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              受信
            </span>
          </div>
          <div className="mt-4 flex-1">
            <p className="text-4xl font-bold tracking-tight text-slate-900">
              {dashboardCounts.pendingCount}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              まだ完了していない受信依頼の件数です。
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-500">最近の送信依頼</p>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              最新5件
            </span>
          </div>
          <div className="mt-4 flex-1 space-y-3">
            {dashboardCounts.recentSent.length > 0 ? (
              dashboardCounts.recentSent.map((item) => {
                if (item.type === 'single') {
                  return (
                    <div
                      key={item.request.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
                    >
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {item.request.title}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        共有先：
                        {getUserLabel(
                          item.request.recipient_id
                            ? userMap.get(item.request.recipient_id)
                            : undefined
                        )}
                      </p>
                    </div>
                  )
                }

                return (
                  <div
                    key={item.batchId}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
                  >
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {item.title}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      同時送信 {item.requests.length}名
                    </p>
                  </div>
                )
              })
            ) : (
              <p className="text-sm text-slate-500">まだ送信依頼はありません。</p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-500">操作</p>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              クイック
            </span>
          </div>
          <div className="mt-4 flex-1 space-y-3">
            <button
              type="button"
              onClick={() => {
                resetForm()
                setCreateFormOpen((prev) => !prev)
                setActiveView('dashboard')
              }}
              className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm font-semibold text-slate-800 transition hover:bg-slate-100"
            >
              <span>新規依頼を追加</span>
              <PlusIcon />
            </button>

            <button
              type="button"
              onClick={() => setActiveView('received')}
              className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm font-semibold text-slate-800 transition hover:bg-slate-100"
            >
              <span>受信依頼を見る</span>
              <ChevronRightIcon />
            </button>

            <button
              type="button"
              onClick={() => setActiveView('sent')}
              className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm font-semibold text-slate-800 transition hover:bg-slate-100"
            >
              <span>送信依頼を見る</span>
              <ChevronRightIcon />
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-500">概要</p>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              件数サマリ
            </span>
          </div>
          <div className="mt-4 grid flex-1 grid-cols-3 gap-3">
            <div className="rounded-2xl bg-slate-50 p-4 text-center">
              <p className="text-xs font-semibold text-slate-500">受信</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {dashboardCounts.receivedTotal}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 text-center">
              <p className="text-xs font-semibold text-slate-500">送信</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {dashboardCounts.sentTotal}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 text-center">
              <p className="text-xs font-semibold text-slate-500">完了</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {dashboardCounts.completedTotal}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderReceived = () => (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">受信依頼</h2>
          <p className="mt-1 text-sm text-slate-500">
            優先順位に沿って表示しています
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            resetForm()
            setCreateFormOpen(true)
          }}
          className="inline-flex h-11 items-center gap-2 rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          <PlusIcon />
          新規依頼
        </button>
      </div>

      {activeReceivedRequests.length > 0 ? (
        <div className="grid gap-4">
          {activeReceivedRequests.map((request) => renderRequestCard(request))}
        </div>
      ) : (
        <div className="rounded-[28px] border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          受信中の依頼はありません。
        </div>
      )}
    </div>
  )

  const renderSent = () => (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">送信依頼</h2>
          <p className="mt-1 text-sm text-slate-500">
            単独送信と同時送信をまとめて表示します
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            resetForm()
            setCreateFormOpen(true)
          }}
          className="inline-flex h-11 items-center gap-2 rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          <PlusIcon />
          新規依頼
        </button>
      </div>

      {sentDisplayItems.length > 0 ? (
        <div className="grid gap-4">
          {sentDisplayItems.map((item) => renderSentCard(item))}
        </div>
      ) : (
        <div className="rounded-[28px] border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          送信した依頼はありません。
        </div>
      )}
    </div>
  )

  const renderHistory = () => (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => setHistoryOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-[28px] border border-slate-200 bg-white px-5 py-4 text-left shadow-sm transition hover:bg-slate-50"
      >
        <div>
          <h2 className="text-lg font-semibold text-slate-900">履歴</h2>
          <p className="mt-1 text-sm text-slate-500">
            完了済みの依頼を確認できます
          </p>
        </div>
        <span className="inline-flex items-center justify-center rounded-full bg-slate-100 p-2 text-slate-700">
          {historyOpen ? <ChevronDownIcon /> : <ChevronRightIcon />}
        </span>
      </button>

      {historyOpen &&
        (historyRequests.length > 0 ? (
          <div className="grid gap-4">
            {historyRequests.map((request) =>
              renderRequestCard(request, request.sender_id === currentUserId)
            )}
          </div>
        ) : (
          <div className="rounded-[28px] border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
            履歴はまだありません。
          </div>
        ))}
    </div>
  )

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="rounded-3xl bg-white px-6 py-5 text-sm font-medium text-slate-600 shadow-sm">
          読み込み中...
        </div>
      </main>
    )
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="w-full max-w-md rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-400">
            Work-Hub
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
            業務管理アプリ
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Googleアカウントでログインして、受信依頼・送信依頼・履歴を確認します。
          </p>

          <button
            type="button"
            onClick={handleLogin}
            className="mt-8 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            <LoginIcon />
            Googleでログイン
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="flex min-h-screen">
        <div className="hidden lg:block">
          <Sidebar />
        </div>

        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(false)}
              className="absolute inset-0 bg-slate-950/40"
            />
            <div className="absolute left-0 top-0 h-full">
              <Sidebar mobile />
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
            <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setMobileSidebarOpen(true)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 lg:hidden"
                >
                  <MenuIcon />
                </button>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Work-Hub
                  </p>
                  <h1 className="text-lg font-semibold text-slate-900">
                    業務管理アプリ
                  </h1>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden rounded-2xl bg-slate-100 px-4 py-2 text-sm text-slate-700 sm:block">
                  {currentUserProfile?.name?.trim() || user.email}
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <LogoutIcon />
                  <span className="hidden sm:inline">ログアウト</span>
                </button>
              </div>
            </div>
          </header>

          <div className="flex-1 px-4 py-5 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl space-y-5">
              {createFormOpen && renderCreateForm()}

              {!createFormOpen && activeView === 'dashboard' && renderDashboard()}
              {!createFormOpen && activeView === 'received' && renderReceived()}
              {!createFormOpen && activeView === 'sent' && renderSent()}
              {!createFormOpen && activeView === 'history' && renderHistory()}
            </div>
          </div>
        </div>
      </div>

      {detailTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 px-4">
          <button
            type="button"
            onClick={() => setDetailTarget(null)}
            className="absolute inset-0"
          />
          <div className="relative z-10 w-full max-w-2xl rounded-[32px] border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-400">
                  Detail
                </p>
                <h2 className="mt-2 text-xl font-semibold text-slate-900">
                  {detailTarget.title}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setDetailTarget(null)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
              >
                <CloseIcon />
              </button>
            </div>

            <div className="mt-5 grid gap-5">
              <div className="grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                    送信者
                  </p>
                  <p className="mt-1">
                    {getUserLabel(userMap.get(detailTarget.sender_id))}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                    共有先
                  </p>
                  <p className="mt-1">
                    {getUserLabel(
                      detailTarget.recipient_id
                        ? userMap.get(detailTarget.recipient_id)
                        : undefined
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                    ステータス
                  </p>
                  <p className="mt-1">{detailTarget.status ?? '未確認'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                    優先度
                  </p>
                  <p className="mt-1">{detailTarget.priority ?? '中'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                    期限
                  </p>
                  <p className="mt-1">{formatDate(detailTarget.deadline)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                    作成日
                  </p>
                  <p className="mt-1">{formatDateTime(detailTarget.created_at)}</p>
                </div>
                {(detailTarget.status ?? '未確認') === '完了' && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                      完了日
                    </p>
                    <p className="mt-1">{formatDateTime(detailTarget.completed_at)}</p>
                  </div>
                )}
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-800">内容</p>
                <div className="mt-2 rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                    {detailTarget.content}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}