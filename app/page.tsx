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
      unconfirmedRecipients: string[]
      inProgressRecipients: string[]
      completedRecipients: string[]
      totalCount: number
      unconfirmedCount: number
      inProgressCount: number
      completedCount: number
      allCompleted: boolean
    }

const MY_CONNECT_URL =
  'https://script.google.com/a/macros/chronusinc.jp/s/AKfycbzSKDnhFKHWFQZwlUVpi5yrXHuH2GCc4gUny2fUslMkrABG0vAQrTCHzyHBre1fJJT-dg/exec'

export default function Home() {
  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [requests, setRequests] = useState<RequestItem[]>([])
  const [users, setUsers] = useState<UserItem[]>([])
  const [currentUser, setCurrentUser] = useState<UserItem | null>(null)

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [deadline, setDeadline] = useState('')
  const [priority, setPriority] = useState('中')
  const [recipientIds, setRecipientIds] = useState<string[]>([])
  const [recipientSearch, setRecipientSearch] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editDeadline, setEditDeadline] = useState('')
  const [editPriority, setEditPriority] = useState('中')
  const [editStatus, setEditStatus] = useState('未確認')

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [detailItem, setDetailItem] = useState<RequestItem | null>(null)
  const [activeView, setActiveView] = useState<ViewKey>('dashboard')

  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, name, role')
      .order('created_at', { ascending: true })

    if (error) {
      console.error('fetchUsers error:', error)
      throw error
    }

    const userList = data || []
    setUsers(userList)
    return userList
  }

  const fetchCurrentUser = async (uid: string) => {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, name, role')
      .eq('id', uid)
      .maybeSingle()

    if (error) {
      console.error('fetchCurrentUser error:', error)
      throw error
    }

    setCurrentUser(data || null)
    return data || null
  }

  const fetchRequests = async (uid: string) => {
    const [sentRes, receivedRes] = await Promise.all([
      supabase
        .from('requests')
        .select('*')
        .eq('sender_id', uid)
        .order('created_at', { ascending: false }),
      supabase
        .from('requests')
        .select('*')
        .eq('recipient_id', uid)
        .order('created_at', { ascending: false }),
    ])

    if (sentRes.error) {
      console.error('fetch sent requests error:', sentRes.error)
      throw sentRes.error
    }

    if (receivedRes.error) {
      console.error('fetch received requests error:', receivedRes.error)
      throw receivedRes.error
    }

    const merged = [...(sentRes.data || []), ...(receivedRes.data || [])]
    const dedupedMap = new Map<string, RequestItem>()

    for (const item of merged) {
      dedupedMap.set(item.id, item)
    }

    const deduped = Array.from(dedupedMap.values()).sort((a, b) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

    setRequests(deduped)
  }

  const refreshAll = async (uid: string) => {
    await Promise.all([fetchUsers(), fetchCurrentUser(uid), fetchRequests(uid)])
  }

  useEffect(() => {
    const init = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()

        if (error) {
          console.error('getSession error:', error)
        }

        const uid = data.session?.user?.id ?? null
        const email = data.session?.user?.email ?? null

        setUserId(uid)
        setUserEmail(email)

        if (uid) {
          await refreshAll(uid)
        } else {
          setRequests([])
          setUsers([])
          setCurrentUser(null)
        }
      } catch (error) {
        console.error('init error:', error)
      } finally {
        setLoading(false)
      }
    }

    init()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      try {
        const uid = session?.user?.id ?? null
        const email = session?.user?.email ?? null

        setUserId(uid)
        setUserEmail(email)

        if (uid) {
          await refreshAll(uid)
        } else {
          setRequests([])
          setUsers([])
          setCurrentUser(null)
        }
      } catch (error) {
        console.error('auth state change error:', error)
      } finally {
        setLoading(false)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'http://localhost:3000',
      },
    })
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUserId(null)
    setUserEmail(null)
    setRequests([])
    setUsers([])
    setCurrentUser(null)
    setEditingId(null)
    setShowCreateForm(false)
    setDetailItem(null)
    setActiveView('dashboard')
    setMobileSidebarOpen(false)
    setRecipientIds([])
    setRecipientSearch('')
  }

  const availableRecipients = useMemo(() => {
    return users.filter((user) => user.id !== userId)
  }, [users, userId])

  const filteredRecipients = useMemo(() => {
    const keyword = recipientSearch.trim().toLowerCase()
    if (!keyword) return availableRecipients

    return availableRecipients.filter((user) => {
      const name = user.name?.toLowerCase() || ''
      const email = user.email?.toLowerCase() || ''
      return name.includes(keyword) || email.includes(keyword)
    })
  }, [availableRecipients, recipientSearch])

  useEffect(() => {
    if (!showCreateForm) return
    if (availableRecipients.length === 0) return

    setRecipientIds((prev) => {
      if (prev.length > 0) return prev
      return availableRecipients.map((user) => user.id)
    })
  }, [showCreateForm, availableRecipients])

  const toggleRecipient = (targetId: string) => {
    setRecipientIds((prev) => {
      if (prev.includes(targetId)) {
        return prev.filter((id) => id !== targetId)
      }
      return [...prev, targetId]
    })
  }

  const handleSelectAllRecipients = () => {
    setRecipientIds(availableRecipients.map((user) => user.id))
  }

  const handleClearAllRecipients = () => {
    setRecipientIds([])
  }

  const handleToggleCreateForm = () => {
    setShowCreateForm((prev) => {
      const next = !prev

      if (next) {
        setRecipientIds(availableRecipients.map((user) => user.id))
        setRecipientSearch('')
      }

      return next
    })
  }

  const generateBatchId = () => {
    const randomPart = Math.random().toString(36).slice(2, 10)
    return `batch_${Date.now()}_${randomPart}`
  }

  const handleCreateRequest = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!userId) {
      alert('ユーザー情報が取得できていません。再度ログインしてください。')
      return
    }

    if (!title.trim()) {
      alert('タイトルを入力してください。')
      return
    }

    if (!content.trim()) {
      alert('本文を入力してください。')
      return
    }

    if (recipientIds.length === 0) {
      alert('送信先ユーザーを1人以上選択してください。')
      return
    }

    try {
      setSubmitting(true)

      const batchId = recipientIds.length >= 2 ? generateBatchId() : null

      const insertPayload = recipientIds.map((recipientId) => ({
        title: title.trim(),
        content: content.trim(),
        sender_id: userId,
        recipient_id: recipientId,
        status: '未確認',
        priority,
        deadline: deadline ? new Date(deadline).toISOString() : null,
        completed_at: null,
        batch_id: batchId,
      }))

      const { error } = await supabase.from('requests').insert(insertPayload)

      if (error) {
        console.error('insert error:', error)
        alert(`依頼の保存に失敗しました。\n${error.message}`)
        setSubmitting(false)
        return
      }

      setTitle('')
      setContent('')
      setDeadline('')
      setPriority('中')
      setRecipientIds([])
      setRecipientSearch('')
      setShowCreateForm(false)
      setActiveView('sent')
      setSubmitting(false)

      setTimeout(() => {
        fetchRequests(userId).catch((fetchError) => {
          console.error('post-insert fetchRequests error:', fetchError)
        })
      }, 0)
    } catch (error) {
      console.error('handleCreateRequest error:', error)
      alert('依頼の保存中にエラーが発生しました。')
      setSubmitting(false)
    }
  }

  const handleStatusChange = async (id: string, nextStatus: string) => {
    const completedAt = nextStatus === '完了' ? new Date().toISOString() : null

    const { error } = await supabase
      .from('requests')
      .update({
        status: nextStatus,
        completed_at: completedAt,
      })
      .eq('id', id)

    if (error) {
      console.error('status update error:', error)
      alert('ステータスの更新に失敗しました。')
      return
    }

    setRequests((prev) =>
      prev.map((req) =>
        req.id === id
          ? {
              ...req,
              status: nextStatus,
              completed_at: completedAt,
            }
          : req
      )
    )

    if (detailItem?.id === id) {
      setDetailItem((prev) =>
        prev
          ? {
              ...prev,
              status: nextStatus,
              completed_at: completedAt,
            }
          : null
      )
    }
  }

  const startEdit = (req: RequestItem) => {
    setEditingId(req.id)
    setEditTitle(req.title)
    setEditContent(req.content)
    setEditDeadline(req.deadline ? toDateTimeLocalValue(req.deadline) : '')
    setEditPriority(req.priority || '中')
    setEditStatus(req.status || '未確認')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditTitle('')
    setEditContent('')
    setEditDeadline('')
    setEditPriority('中')
    setEditStatus('未確認')
  }

  const handleUpdateRequest = async (id: string) => {
    if (!userId) {
      alert('ユーザー情報が取得できていません。再度ログインしてください。')
      return
    }

    if (!editTitle.trim()) {
      alert('タイトルを入力してください。')
      return
    }

    if (!editContent.trim()) {
      alert('本文を入力してください。')
      return
    }

    try {
      const completedAt = editStatus === '完了' ? new Date().toISOString() : null

      const { data, error } = await supabase
        .from('requests')
        .update({
          title: editTitle.trim(),
          content: editContent.trim(),
          priority: editPriority,
          status: editStatus,
          deadline: editDeadline ? new Date(editDeadline).toISOString() : null,
          completed_at: completedAt,
        })
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('update error:', error)
        alert('依頼の更新に失敗しました。')
        return
      }

      if (data) {
        setRequests((prev) => prev.map((req) => (req.id === id ? data : req)))
        if (detailItem?.id === id) {
          setDetailItem(data)
        }
      }

      cancelEdit()
    } catch (error) {
      console.error('handleUpdateRequest error:', error)
      alert('依頼の更新中にエラーが発生しました。')
    }
  }

  const handleDeleteRequest = async (id: string) => {
    const ok = window.confirm('この依頼を削除しますか？')
    if (!ok) return

    try {
      const { error } = await supabase.from('requests').delete().eq('id', id)

      if (error) {
        console.error('delete error:', error)
        alert('依頼の削除に失敗しました。')
        return
      }

      setRequests((prev) => prev.filter((req) => req.id !== id))

      if (editingId === id) {
        cancelEdit()
      }

      if (detailItem?.id === id) {
        setDetailItem(null)
      }
    } catch (error) {
      console.error('handleDeleteRequest error:', error)
      alert('依頼の削除中にエラーが発生しました。')
    }
  }

  const handleDeleteBatch = async (batchId: string) => {
    const ok = window.confirm('この同時送信グループを削除しますか？')
    if (!ok) return

    try {
      const { error } = await supabase.from('requests').delete().eq('batch_id', batchId)

      if (error) {
        console.error('delete batch error:', error)
        alert('同時送信グループの削除に失敗しました。')
        return
      }

      setRequests((prev) => prev.filter((req) => req.batch_id !== batchId))
    } catch (error) {
      console.error('handleDeleteBatch error:', error)
      alert('同時送信グループの削除中にエラーが発生しました。')
    }
  }

  const isOverdue = (deadlineValue: string | null) => {
    if (!deadlineValue) return false
    return new Date(deadlineValue).getTime() < new Date().getTime()
  }

  const getPriorityStyle = (value: string | null) => {
    switch (value) {
      case '高':
        return 'bg-red-100 text-red-700'
      case '中':
        return 'bg-yellow-100 text-yellow-700'
      case '低':
        return 'bg-sky-100 text-sky-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  const getStatusStyle = (value: string | null) => {
    switch (value) {
      case '未確認':
        return 'bg-red-100 text-red-700'
      case '対応中':
        return 'bg-yellow-100 text-yellow-700'
      case '保留':
        return 'bg-yellow-100 text-yellow-700'
      case '完了':
        return 'bg-gray-100 text-gray-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  const getUserLabel = (targetUserId: string | null) => {
    if (!targetUserId) return '未設定'
    const targetUser = users.find((user) => user.id === targetUserId)
    return targetUser?.name?.trim() || targetUser?.email || '未設定'
  }

  const displayName =
    currentUser?.name?.trim() || currentUser?.email || userEmail || ''

  const selectedRecipientLabels = useMemo(() => {
    return recipientIds.map((id) => getUserLabel(id))
  }, [recipientIds, users])

  const sentRequests = useMemo(() => {
    return requests.filter((req) => req.sender_id === userId)
  }, [requests, userId])

  const receivedRequests = useMemo(() => {
    return requests.filter((req) => req.recipient_id === userId)
  }, [requests, userId])

  const activeSentRequests = useMemo(() => {
    return sentRequests.filter((req) => req.status !== '完了')
  }, [sentRequests])

  const activeReceivedRequests = useMemo(() => {
    return receivedRequests.filter((req) => req.status !== '完了')
  }, [receivedRequests])

  const historySentRequests = useMemo(() => {
    return sentRequests
      .filter((req) => req.status === '完了')
      .sort((a, b) => {
        const completedA = a.completed_at ? new Date(a.completed_at).getTime() : 0
        const completedB = b.completed_at ? new Date(b.completed_at).getTime() : 0
        return completedB - completedA
      })
  }, [sentRequests])

  const historyReceivedRequests = useMemo(() => {
    return receivedRequests
      .filter((req) => req.status === '完了')
      .sort((a, b) => {
        const completedA = a.completed_at ? new Date(a.completed_at).getTime() : 0
        const completedB = b.completed_at ? new Date(b.completed_at).getTime() : 0
        return completedB - completedA
      })
  }, [receivedRequests])

  const sortActiveRequests = (list: RequestItem[]) => {
    const getRank = (req: RequestItem) => {
      const overdue = isOverdue(req.deadline)

      if (req.status === '未確認' && overdue) return 1
      if (req.status === '未確認' && !overdue) return 2
      if (req.status === '対応中') return 3
      return 4
    }

    return [...list].sort((a, b) => {
      const rankA = getRank(a)
      const rankB = getRank(b)

      if (rankA !== rankB) return rankA - rankB

      const deadlineA = a.deadline
        ? new Date(a.deadline).getTime()
        : Number.MAX_SAFE_INTEGER
      const deadlineB = b.deadline
        ? new Date(b.deadline).getTime()
        : Number.MAX_SAFE_INTEGER

      if (deadlineA !== deadlineB) return deadlineA - deadlineB

      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }

  const sortedReceivedRequests = useMemo(() => {
    return sortActiveRequests(activeReceivedRequests)
  }, [activeReceivedRequests])

  const sentDisplayItems = useMemo<SentDisplayItem[]>(() => {
    const sorted = sortActiveRequests(activeSentRequests)
    const batchMap = new Map<string, RequestItem[]>()
    const singles: RequestItem[] = []

    for (const req of sorted) {
      if (req.batch_id) {
        const current = batchMap.get(req.batch_id) || []
        current.push(req)
        batchMap.set(req.batch_id, current)
      } else {
        singles.push(req)
      }
    }

    const batchItems: SentDisplayItem[] = Array.from(batchMap.entries()).map(
      ([batchId, reqs]) => buildBatchDisplayItem(batchId, reqs, users)
    )

    const singleItems: SentDisplayItem[] = singles.map((request) => ({
      type: 'single',
      request,
    }))

    const merged = [...batchItems, ...singleItems].sort((a, b) => {
      const timeA =
        a.type === 'batch'
          ? new Date(a.created_at).getTime()
          : new Date(a.request.created_at).getTime()
      const timeB =
        b.type === 'batch'
          ? new Date(b.created_at).getTime()
          : new Date(b.request.created_at).getTime()

      return timeB - timeA
    })

    return merged
  }, [activeSentRequests, users])

  const unconfirmedReceivedCount = useMemo(() => {
    return receivedRequests.filter((req) => req.status === '未確認').length
  }, [receivedRequests])

  const inProgressReceivedCount = useMemo(() => {
    return receivedRequests.filter((req) => req.status === '対応中').length
  }, [receivedRequests])

  const activeReceivedCount = useMemo(() => {
    return activeReceivedRequests.length
  }, [activeReceivedRequests])

  const activeSentCount = useMemo(() => {
    return activeSentRequests.length
  }, [activeSentRequests])

  const overdueUnconfirmedRequests = useMemo(() => {
    return sortedReceivedRequests.filter(
      (req) => req.status === '未確認' && isOverdue(req.deadline)
    )
  }, [sortedReceivedRequests])

  const unhandledRequests = useMemo(() => {
    return sortedReceivedRequests.filter((req) => req.status !== '完了')
  }, [sortedReceivedRequests])

  const recentSentRequests = useMemo(() => {
    return activeSentRequests
      .slice()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 4)
  }, [activeSentRequests])

  const pageInfo: Record<ViewKey, { title: string; description: string }> = {
    dashboard: {
      title: 'ダッシュボード',
      description: '今日の業務を確認しましょう。',
    },
    received: {
      title: '受信依頼',
      description: '自分に届いた依頼のみを表示しています。',
    },
    sent: {
      title: '送信依頼',
      description: '自分が送信した依頼のみを表示しています。',
    },
    history: {
      title: '履歴',
      description: '完了済みの依頼を確認できます。',
    },
  }

  const sidebarItems: Array<{
    key: ViewKey
    label: string
    icon: React.ReactNode
  }> = [
    { key: 'dashboard', label: 'ダッシュボード', icon: <HomeIcon /> },
    { key: 'received', label: '受信依頼', icon: <InboxIcon /> },
    { key: 'sent', label: '送信依頼', icon: <SendIcon /> },
    { key: 'history', label: '履歴', icon: <HistoryIcon /> },
  ]

  const changeView = (nextView: ViewKey) => {
    setActiveView(nextView)
    setMobileSidebarOpen(false)

    if (nextView !== 'sent') {
      setShowCreateForm(false)
    }
  }

  const openMyConnect = () => {
    window.open(MY_CONNECT_URL, '_blank', 'noopener,noreferrer')
  }

  const renderCreateForm = () => {
    if (!showCreateForm) return null

    const isAllSelected =
      availableRecipients.length > 0 && recipientIds.length === availableRecipients.length

    return (
      <section className="rounded-[20px] border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-lg font-semibold text-gray-900">新規依頼</h2>

        <form onSubmit={handleCreateRequest} className="mt-4 space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              送信先ユーザー（複数選択可）
            </label>

            <div className="rounded-xl border border-gray-300 bg-white p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-gray-700">
                  <span className="font-medium">選択中:</span> {recipientIds.length}名
                  {isAllSelected && availableRecipients.length > 0 && (
                    <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                      全員選択中
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAllRecipients}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 transition hover:bg-gray-50 sm:text-sm"
                  >
                    全選択
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAllRecipients}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 transition hover:bg-gray-50 sm:text-sm"
                  >
                    選択解除
                  </button>
                </div>
              </div>

              <div className="mt-3">
                <input
                  type="text"
                  value={recipientSearch}
                  onChange={(e) => setRecipientSearch(e.target.value)}
                  placeholder="ユーザー名・メールアドレスで検索"
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-gray-400"
                />
              </div>

              <div className="mt-3 max-h-44 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-2">
                {filteredRecipients.length === 0 ? (
                  <p className="px-2 py-3 text-sm text-gray-500">
                    該当するユーザーがいません
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                    {filteredRecipients.map((user) => {
                      const checked = recipientIds.includes(user.id)
                      const label = user.name?.trim() || user.email || '名称未設定'

                      return (
                        <label
                          key={user.id}
                          className="flex cursor-pointer items-center gap-3 rounded-lg bg-white px-3 py-2 transition hover:bg-gray-100"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleRecipient(user.id)}
                            className="h-4 w-4 rounded border-gray-300"
                          />
                          <span className="truncate text-sm text-gray-800">{label}</span>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>

              {recipientIds.length > 0 && (
                <div className="mt-3">
                  <div className="flex flex-wrap gap-2">
                    {selectedRecipientLabels.slice(0, 8).map((label, index) => (
                      <span
                        key={`${label}-${index}`}
                        className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700"
                      >
                        {label}
                      </span>
                    ))}

                    {selectedRecipientLabels.length > 8 && (
                      <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                        他 {selectedRecipientLabels.length - 8}名
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              タイトル
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="依頼のタイトルを入力"
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-gray-400"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              本文
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="依頼内容を入力"
              rows={5}
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-gray-400"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                対応期限
              </label>
              <input
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-gray-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                優先度
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-gray-400"
              >
                <option value="高">高</option>
                <option value="中">中</option>
                <option value="低">低</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-gray-900 py-3 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:px-6"
          >
            {submitting
              ? '保存中...'
              : `依頼を保存${recipientIds.length > 0 ? `（${recipientIds.length}名）` : ''}`}
          </button>
        </form>
      </section>
    )
  }

  const renderRequestCard = (
    req: RequestItem,
    mode: 'received' | 'sent' | 'history-received' | 'history-sent'
  ) => {
    const overdueUnconfirmed = req.status === '未確認' && isOverdue(req.deadline)
    const isHistory = mode === 'history-received' || mode === 'history-sent'

    return (
      <div
        key={req.id}
        className={`rounded-[20px] border p-4 shadow-sm ${
          overdueUnconfirmed && !isHistory
            ? 'border-red-200 bg-red-50'
            : 'border-gray-200 bg-white'
        }`}
      >
        {mode === 'sent' && editingId === req.id ? (
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                タイトル
              </label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-gray-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                本文
              </label>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={4}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-gray-400"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  対応期限
                </label>
                <input
                  type="datetime-local"
                  value={editDeadline}
                  onChange={(e) => setEditDeadline(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-gray-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  優先度
                </label>
                <select
                  value={editPriority}
                  onChange={(e) => setEditPriority(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-gray-400"
                >
                  <option value="高">高</option>
                  <option value="中">中</option>
                  <option value="低">低</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                ステータス
              </label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-gray-400"
              >
                <option value="未確認">未確認</option>
                <option value="対応中">対応中</option>
                <option value="完了">完了</option>
              </select>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                onClick={() => handleUpdateRequest(req.id)}
                className="w-full rounded-xl bg-gray-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-gray-800 sm:w-auto"
              >
                保存
              </button>
              <button
                onClick={cancelEdit}
                className="w-full rounded-xl bg-gray-100 px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-200 sm:w-auto"
              >
                キャンセル
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="line-clamp-2 text-lg font-semibold text-gray-900">
                  {req.title}
                </p>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {req.priority && (
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getPriorityStyle(
                      req.priority
                    )}`}
                  >
                    {req.priority}
                  </span>
                )}
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                    overdueUnconfirmed && mode === 'received'
                      ? 'bg-red-100 text-red-700'
                      : getStatusStyle(isHistory ? '完了' : req.status)
                  }`}
                >
                  {isHistory ? '完了' : req.status || '未設定'}
                </span>
              </div>
            </div>

            <p className="line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-gray-600">
              {req.content}
            </p>

            <div className="space-y-1 text-sm text-gray-500">
              {mode === 'received' || mode === 'history-received' ? (
                <div>送信者: {getUserLabel(req.sender_id)}</div>
              ) : (
                <div>送信先: {getUserLabel(req.recipient_id)}</div>
              )}

              {isHistory ? (
                <div>
                  完了日:{' '}
                  {req.completed_at
                    ? new Date(req.completed_at).toLocaleDateString('ja-JP', {
                        year: 'numeric',
                        month: 'numeric',
                        day: 'numeric',
                      })
                    : '未設定'}
                </div>
              ) : (
                <div>
                  期限:{' '}
                  {req.deadline
                    ? new Date(req.deadline).toLocaleDateString('ja-JP', {
                        month: 'numeric',
                        day: 'numeric',
                      })
                    : '期限未設定'}
                </div>
              )}
            </div>

            {overdueUnconfirmed && !isHistory && (
              <span className="inline-flex rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700">
                期限切れ
              </span>
            )}

            <div className="flex items-center gap-2">
              {!isHistory && (
                <select
                  value={req.status || '未確認'}
                  onChange={(e) => handleStatusChange(req.id, e.target.value)}
                  className="min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm outline-none transition focus:border-gray-400"
                >
                  <option value="未確認">未確認</option>
                  <option value="対応中">対応中</option>
                  <option value="完了">完了</option>
                </select>
              )}

              {isHistory && <div className="flex-1" />}

              <button
                onClick={() => setDetailItem(req)}
                className="rounded-xl border border-gray-200 p-3 text-gray-700 transition hover:bg-gray-100"
                aria-label="詳細"
                title="詳細"
              >
                <EyeIcon />
              </button>

              {mode === 'sent' && (
                <>
                  <button
                    onClick={() => startEdit(req)}
                    className="rounded-xl border border-gray-200 p-3 text-gray-700 transition hover:bg-gray-100"
                    aria-label="編集"
                    title="編集"
                  >
                    <PencilIcon />
                  </button>

                  <button
                    onClick={() => handleDeleteRequest(req.id)}
                    className="rounded-xl border border-gray-200 p-3 text-red-500 transition hover:bg-red-50"
                    aria-label="削除"
                    title="削除"
                  >
                    <TrashIcon />
                  </button>
                </>
              )}

              {mode === 'history-sent' && (
                <button
                  onClick={() => handleDeleteRequest(req.id)}
                  className="rounded-xl border border-gray-200 p-3 text-red-500 transition hover:bg-red-50"
                  aria-label="削除"
                  title="削除"
                >
                  <TrashIcon />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderBatchSentCard = (item: Extract<SentDisplayItem, { type: 'batch' }>) => {
    const overdueUnconfirmed =
      item.unconfirmedCount > 0 && item.deadline ? isOverdue(item.deadline) : false

    return (
      <div
        key={item.batchId}
        className={`rounded-[20px] border p-4 shadow-sm ${
          overdueUnconfirmed ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'
        }`}
      >
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="line-clamp-2 text-lg font-semibold text-gray-900">{item.title}</p>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {item.priority && (
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getPriorityStyle(
                    item.priority
                  )}`}
                >
                  {item.priority}
                </span>
              )}

              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                  item.allCompleted
                    ? 'bg-gray-100 text-gray-700'
                    : item.unconfirmedCount > 0
                    ? 'bg-red-100 text-red-700'
                    : 'bg-yellow-100 text-yellow-700'
                }`}
              >
                {item.allCompleted
                  ? '全員確認済み'
                  : item.unconfirmedCount > 0
                  ? `未確認 ${item.unconfirmedCount}名`
                  : `対応中 ${item.inProgressCount}名`}
              </span>

              <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                同時送信 {item.totalCount}名
              </span>
            </div>
          </div>

          <p className="line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-gray-600">
            {item.content}
          </p>

          <div className="space-y-2 text-sm text-gray-500">
            <div>
              未確認者:{' '}
              {item.unconfirmedCount > 0
                ? formatUserList(item.unconfirmedRecipients)
                : 'なし（全員確認済み）'}
            </div>

            {item.inProgressCount > 0 && (
              <div>対応中: {formatUserList(item.inProgressRecipients)}</div>
            )}

            <div>
              期限:{' '}
              {item.deadline
                ? new Date(item.deadline).toLocaleDateString('ja-JP', {
                    month: 'numeric',
                    day: 'numeric',
                  })
                : '期限未設定'}
            </div>
          </div>

          {overdueUnconfirmed && (
            <span className="inline-flex rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700">
              期限切れ
            </span>
          )}

          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() =>
                setDetailItem(
                  item.requests
                    .slice()
                    .sort(
                      (a, b) =>
                        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                    )[0]
                )
              }
              className="rounded-xl border border-gray-200 p-3 text-gray-700 transition hover:bg-gray-100"
              aria-label="詳細"
              title="詳細"
            >
              <EyeIcon />
            </button>

            <button
              onClick={() => handleDeleteBatch(item.batchId)}
              className="rounded-xl border border-gray-200 p-3 text-red-500 transition hover:bg-red-50"
              aria-label="削除"
              title="削除"
            >
              <TrashIcon />
            </button>
          </div>
        </div>
      </div>
    )
  }

  const renderDashboard = () => {
    return (
      <div className="space-y-6">
        <section className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
          <DashboardPanel
            title="マイコネクト"
            icon={<LinkIcon />}
            clickable
            onClick={openMyConnect}
          >
            <p className="text-sm text-gray-600">指定のリンク先へ移動します。</p>
            <div className="mt-4">
              <div className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-800">
                <span>マイコネクトを開く</span>
                <ExternalLinkIcon />
              </div>
            </div>
          </DashboardPanel>

          <DashboardPanel title="期限切れ・要対応" icon={<AlertIcon />}>
            {overdueUnconfirmedRequests.length === 0 ? (
              <p className="text-sm text-gray-500">期限切れの依頼はありません</p>
            ) : (
              <div className="space-y-3">
                {overdueUnconfirmedRequests.slice(0, 4).map((req) => (
                  <button
                    key={req.id}
                    onClick={() => {
                      setActiveView('received')
                      setDetailItem(req)
                    }}
                    className="flex w-full items-start justify-between gap-3 text-left"
                  >
                    <div className="min-w-0">
                      <p className="line-clamp-1 text-sm font-medium text-gray-900">
                        {req.title}
                      </p>
                      <p className="mt-1 text-xs text-gray-400">{getUserLabel(req.sender_id)}</p>
                    </div>
                    <span className="shrink-0 text-xs text-gray-400">
                      {req.deadline
                        ? new Date(req.deadline).toLocaleDateString('ja-JP', {
                            month: 'numeric',
                            day: 'numeric',
                          })
                        : ''}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </DashboardPanel>

          <DashboardPanel
            title="未対応の依頼"
            icon={<InboxIcon colorClass="text-red-500" />}
          >
            {unhandledRequests.length === 0 ? (
              <p className="text-sm text-gray-500">未対応の依頼はありません</p>
            ) : (
              <div className="space-y-3">
                {unhandledRequests.slice(0, 4).map((req) => (
                  <button
                    key={req.id}
                    onClick={() => {
                      setActiveView('received')
                      setDetailItem(req)
                    }}
                    className="flex w-full items-start justify-between gap-3 text-left"
                  >
                    <div className="min-w-0">
                      <p className="line-clamp-1 text-sm font-medium text-gray-900">
                        {req.title}
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                        {req.status || '未設定'} / {getUserLabel(req.sender_id)}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-gray-400">
                      {req.deadline
                        ? new Date(req.deadline).toLocaleDateString('ja-JP', {
                            month: 'numeric',
                            day: 'numeric',
                          })
                        : ''}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </DashboardPanel>
        </section>

        <section className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
          <DashboardPanel
            title="最近の送信依頼"
            icon={<SendIcon colorClass="text-blue-500" />}
          >
            {recentSentRequests.length === 0 ? (
              <p className="text-sm text-gray-500">送信依頼はありません</p>
            ) : (
              <div className="space-y-3">
                {recentSentRequests.map((req) => (
                  <button
                    key={req.id}
                    onClick={() => {
                      setActiveView('sent')
                      setDetailItem(req)
                    }}
                    className="w-full text-left"
                  >
                    <p className="line-clamp-1 text-sm font-medium text-gray-900">
                      {req.title}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      {req.status || '未設定'} / {getUserLabel(req.recipient_id)}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </DashboardPanel>

          <DashboardPanel title="操作" icon={<SparkIcon />}>
            <div className="space-y-3">
              <button
                onClick={() => {
                  setActiveView('sent')
                  setShowCreateForm(true)
                  setRecipientIds(availableRecipients.map((user) => user.id))
                  setRecipientSearch('')
                }}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-left text-sm font-medium text-gray-800 transition hover:bg-gray-50"
              >
                新規依頼を作成
              </button>

              <button
                onClick={() => setActiveView('received')}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-left text-sm font-medium text-gray-800 transition hover:bg-gray-50"
              >
                受信依頼を見る
              </button>

              <button
                onClick={() => setActiveView('history')}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-left text-sm font-medium text-gray-800 transition hover:bg-gray-50"
              >
                履歴を見る
              </button>
            </div>
          </DashboardPanel>

          <DashboardPanel title="概要" icon={<SummaryIcon />}>
            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex items-center justify-between gap-4">
                <span>未確認</span>
                <span className="font-medium text-gray-900">{unconfirmedReceivedCount}件</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>対応中</span>
                <span className="font-medium text-gray-900">{inProgressReceivedCount}件</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>受信依頼</span>
                <span className="font-medium text-gray-900">{activeReceivedCount}件</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>送信依頼</span>
                <span className="font-medium text-gray-900">{activeSentCount}件</span>
              </div>
            </div>
          </DashboardPanel>
        </section>
      </div>
    )
  }

  const renderReceivedView = () => {
    return (
      <section className="space-y-4">
        {sortedReceivedRequests.length === 0 ? (
          <div className="rounded-[20px] border border-gray-200 bg-white p-6 text-center text-gray-500 shadow-sm">
            自分に届いた依頼はありません
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sortedReceivedRequests.map((req) => renderRequestCard(req, 'received'))}
          </div>
        )}
      </section>
    )
  }

  const renderSentView = () => {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            onClick={handleToggleCreateForm}
            className="w-full rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-medium text-gray-800 transition hover:bg-gray-50 sm:w-auto"
          >
            {showCreateForm ? '新規依頼を閉じる' : '＋ 新規依頼'}
          </button>
        </div>

        {renderCreateForm()}

        <section className="space-y-4">
          {sentDisplayItems.length === 0 ? (
            <div className="rounded-[20px] border border-gray-200 bg-white p-6 text-center text-gray-500 shadow-sm">
              まだ送信した依頼はありません
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {sentDisplayItems.map((item) =>
                item.type === 'batch'
                  ? renderBatchSentCard(item)
                  : renderRequestCard(item.request, 'sent')
              )}
            </div>
          )}
        </section>
      </div>
    )
  }

  const renderHistoryView = () => {
    return (
      <div className="space-y-6">
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">履歴（自分に届いた依頼）</h2>

          {historyReceivedRequests.length === 0 ? (
            <div className="rounded-[20px] border border-gray-200 bg-white p-6 text-center text-gray-500 shadow-sm">
              履歴はありません
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {historyReceivedRequests.map((req) =>
                renderRequestCard(req, 'history-received')
              )}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">履歴（自分が送った依頼）</h2>

          {historySentRequests.length === 0 ? (
            <div className="rounded-[20px] border border-gray-200 bg-white p-6 text-center text-gray-500 shadow-sm">
              履歴はありません
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {historySentRequests.map((req) => renderRequestCard(req, 'history-sent'))}
            </div>
          )}
        </section>
      </div>
    )
  }

  const renderActiveView = () => {
    if (activeView === 'dashboard') return renderDashboard()
    if (activeView === 'received') return renderReceivedView()
    if (activeView === 'sent') return renderSentView()
    return renderHistoryView()
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fafafa] px-4">
        <p className="text-base text-gray-600">読み込み中...</p>
      </main>
    )
  }

  if (!userEmail) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fafafa] px-4">
        <div className="w-full max-w-md rounded-[20px] border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="space-y-3 text-center">
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">業務管理アプリ</h1>
            <p className="text-sm text-gray-600 sm:text-base">
              Googleアカウントでログインしてください
            </p>
          </div>

          <button
            onClick={handleLogin}
            className="mt-6 w-full rounded-xl bg-gray-900 py-3 text-sm font-medium text-white transition hover:bg-gray-800 sm:text-base"
          >
            Googleでログイン
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#fafafa] text-gray-900">
      <div className="flex min-h-screen">
        <aside
          className={`hidden shrink-0 border-r border-gray-200 bg-[#f8f8f8] transition-all duration-200 lg:flex lg:flex-col ${
            desktopSidebarOpen ? 'lg:w-[265px]' : 'lg:w-[74px]'
          }`}
        >
          <div className="border-b border-gray-200 px-4 py-6">
            {desktopSidebarOpen ? (
              <div className="flex items-center gap-3">
                <div className="text-gray-500">
                  <GridIcon />
                </div>
                <div>
                  <p className="text-[18px] font-semibold text-gray-900">業務管理</p>
                </div>
              </div>
            ) : (
              <div className="flex justify-center text-gray-500">
                <GridIcon />
              </div>
            )}
          </div>

          <nav className="flex-1 space-y-1 px-3 py-4">
            {sidebarItems.map((item) => {
              const isActive = activeView === item.key

              return (
                <button
                  key={item.key}
                  onClick={() => changeView(item.key)}
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-[15px] font-medium transition ${
                    isActive
                      ? 'bg-gray-200 text-gray-900'
                      : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                  } ${desktopSidebarOpen ? 'justify-start' : 'justify-center px-2'}`}
                  title={item.label}
                >
                  <span className={`${isActive ? 'text-gray-800' : 'text-gray-500'}`}>
                    {item.icon}
                  </span>
                  {desktopSidebarOpen && <span>{item.label}</span>}
                </button>
              )
            })}
          </nav>

          <div className="border-t border-gray-200 px-3 py-4">
            <button
              onClick={handleLogout}
              className={`w-full rounded-xl px-4 py-3 text-[15px] font-medium text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 ${
                desktopSidebarOpen ? 'text-left' : 'text-center'
              }`}
              title="ログアウト"
            >
              {desktopSidebarOpen ? 'ログアウト' : '→'}
            </button>
          </div>
        </aside>

        {mobileSidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/30 lg:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}

        <aside
          className={`fixed inset-y-0 left-0 z-50 w-[265px] transform border-r border-gray-200 bg-[#f8f8f8] transition-transform duration-200 lg:hidden ${
            mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between border-b border-gray-200 px-5 py-5">
            <div className="flex items-center gap-3">
              <div className="text-gray-500">
                <GridIcon />
              </div>
              <p className="text-[18px] font-semibold text-gray-900">業務管理</p>
            </div>
            <button
              onClick={() => setMobileSidebarOpen(false)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
            >
              閉じる
            </button>
          </div>

          <nav className="space-y-1 px-3 py-4">
            {sidebarItems.map((item) => {
              const isActive = activeView === item.key

              return (
                <button
                  key={item.key}
                  onClick={() => changeView(item.key)}
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-[15px] font-medium transition ${
                    isActive
                      ? 'bg-gray-200 text-gray-900'
                      : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <span className={`${isActive ? 'text-gray-800' : 'text-gray-500'}`}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </button>
              )
            })}
          </nav>

          <div className="border-t border-gray-200 px-4 py-4">
            <button
              onClick={handleLogout}
              className="w-full rounded-xl px-4 py-3 text-left text-[15px] font-medium text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
            >
              ログアウト
            </button>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 border-b border-gray-200 bg-[#fafafa]/95 backdrop-blur">
            <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  onClick={() => setMobileSidebarOpen(true)}
                  className="rounded-xl p-2 text-gray-700 transition hover:bg-gray-100 lg:hidden"
                  aria-label="メニューを開く"
                >
                  <MenuIcon />
                </button>

                <button
                  onClick={() => setDesktopSidebarOpen((prev) => !prev)}
                  className="hidden rounded-xl p-2 text-gray-700 transition hover:bg-gray-100 lg:inline-flex"
                  aria-label="サイドバーを開閉"
                  title="サイドバーを開閉"
                >
                  <MenuIcon />
                </button>

                <div className="min-w-0">
                  <h1 className="truncate text-[18px] font-bold text-gray-900 sm:text-[20px]">
                    {pageInfo[activeView].title}
                  </h1>
                  <p className="mt-1 text-sm text-gray-500">
                    {pageInfo[activeView].description}
                  </p>
                </div>
              </div>

              <div className="hidden items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 sm:flex">
                <span className="max-w-[120px] truncate">{displayName}</span>
                <ChevronDownIcon />
              </div>
            </div>
          </header>

          <div className="px-4 py-6 sm:px-6 lg:px-8">{renderActiveView()}</div>
        </div>
      </div>

      {detailItem && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[20px] bg-white p-5 shadow-xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="text-xl font-semibold text-gray-900">{detailItem.title}</h3>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {detailItem.priority && (
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getPriorityStyle(
                        detailItem.priority
                      )}`}
                    >
                      優先度: {detailItem.priority}
                    </span>
                  )}
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getStatusStyle(
                      detailItem.status
                    )}`}
                  >
                    ステータス: {detailItem.status || '未設定'}
                  </span>
                  {detailItem.batch_id && (
                    <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                      batch
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={() => setDetailItem(null)}
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 transition hover:bg-gray-100"
              >
                閉じる
              </button>
            </div>

            <div className="mt-5 space-y-4 text-sm text-gray-700">
              <div className="whitespace-pre-wrap rounded-xl bg-gray-50 p-4 leading-7">
                {detailItem.content}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-gray-200 p-4">
                  <p className="text-xs text-gray-500">送信者</p>
                  <p className="mt-1 text-sm text-gray-900">
                    {getUserLabel(detailItem.sender_id)}
                  </p>
                </div>

                <div className="rounded-xl border border-gray-200 p-4">
                  <p className="text-xs text-gray-500">送信先</p>
                  <p className="mt-1 text-sm text-gray-900">
                    {getUserLabel(detailItem.recipient_id)}
                  </p>
                </div>

                <div className="rounded-xl border border-gray-200 p-4">
                  <p className="text-xs text-gray-500">作成日</p>
                  <p className="mt-1 text-sm text-gray-900">
                    {new Date(detailItem.created_at).toLocaleString('ja-JP')}
                  </p>
                </div>

                <div className="rounded-xl border border-gray-200 p-4">
                  <p className="text-xs text-gray-500">期限</p>
                  <p className="mt-1 text-sm text-gray-900">
                    {detailItem.deadline
                      ? new Date(detailItem.deadline).toLocaleString('ja-JP')
                      : '期限未設定'}
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

function buildBatchDisplayItem(
  batchId: string,
  reqs: RequestItem[],
  users: UserItem[]
): Extract<SentDisplayItem, { type: 'batch' }> {
  const getUserLabel = (targetUserId: string | null) => {
    if (!targetUserId) return '未設定'
    const targetUser = users.find((user) => user.id === targetUserId)
    return targetUser?.name?.trim() || targetUser?.email || '未設定'
  }

  const base = [...reqs].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )[0]

  const unconfirmedRecipients = reqs
    .filter((r) => r.status === '未確認')
    .map((r) => getUserLabel(r.recipient_id))

  const inProgressRecipients = reqs
    .filter((r) => r.status === '対応中')
    .map((r) => getUserLabel(r.recipient_id))

  const completedRecipients = reqs
    .filter((r) => r.status === '完了')
    .map((r) => getUserLabel(r.recipient_id))

  return {
    type: 'batch',
    batchId,
    title: base.title,
    content: base.content,
    priority: base.priority,
    deadline: base.deadline,
    created_at: base.created_at,
    sender_id: base.sender_id,
    requests: reqs,
    unconfirmedRecipients,
    inProgressRecipients,
    completedRecipients,
    totalCount: reqs.length,
    unconfirmedCount: unconfirmedRecipients.length,
    inProgressCount: inProgressRecipients.length,
    completedCount: completedRecipients.length,
    allCompleted: reqs.every((r) => r.status === '完了'),
  }
}

function formatUserList(users: string[]) {
  if (users.length === 0) return 'なし'
  if (users.length <= 3) return users.join('、')
  return `${users.slice(0, 3).join('、')}、他 ${users.length - 3}名`
}

function DashboardPanel({
  title,
  icon,
  children,
  clickable = false,
  onClick,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
  clickable?: boolean
  onClick?: () => void
}) {
  const baseClassName =
    'h-full rounded-[20px] border border-gray-200 bg-white p-5 shadow-sm md:min-h-[230px]'

  const hoverClassName = clickable ? 'cursor-pointer transition hover:bg-gray-50' : ''

  if (clickable && onClick) {
    return (
      <button
        onClick={onClick}
        className={`${baseClassName} ${hoverClassName} flex flex-col text-left`}
      >
        <div className="flex items-center gap-2">
          <div>{icon}</div>
          <h2 className="text-[15px] font-semibold text-gray-900">{title}</h2>
        </div>
        <div className="mt-4 flex-1">{children}</div>
      </button>
    )
  }

  return (
    <div className={`${baseClassName} flex flex-col`}>
      <div className="flex items-center gap-2">
        <div>{icon}</div>
        <h2 className="text-[15px] font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="mt-4 flex-1">{children}</div>
    </div>
  )
}

function toDateTimeLocalValue(value: string) {
  const date = new Date(value)
  const offset = date.getTimezoneOffset()
  const localDate = new Date(date.getTime() - offset * 60 * 1000)
  return localDate.toISOString().slice(0, 16)
}

function MenuIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M3 12h18" />
      <path d="M3 18h18" />
    </svg>
  )
}

function GridIcon() {
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
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  )
}

function HomeIcon({ colorClass = 'text-current' }: { colorClass?: string }) {
  return (
    <span className={colorClass}>
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
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V21h14V9.5" />
      </svg>
    </span>
  )
}

function InboxIcon({ colorClass = 'text-current' }: { colorClass?: string }) {
  return (
    <span className={colorClass}>
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
        <path d="M22 12h-4l-2 3H8l-2-3H2" />
        <path d="M5.5 5h13l3.5 7v6H2v-6l3.5-7Z" />
      </svg>
    </span>
  )
}

function SendIcon({ colorClass = 'text-current' }: { colorClass?: string }) {
  return (
    <span className={colorClass}>
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
        <path d="M22 2 11 13" />
        <path d="M22 2 15 22l-4-9-9-4 20-7Z" />
      </svg>
    </span>
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
      <path d="M12 7v5l3 3" />
    </svg>
  )
}

function AlertIcon() {
  return (
    <span className="text-amber-500">
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
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v5" />
        <path d="M12 16h.01" />
      </svg>
    </span>
  )
}

function SummaryIcon() {
  return (
    <span className="text-blue-500">
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
        <path d="M4 19h16" />
        <path d="M7 16V8" />
        <path d="M12 16V5" />
        <path d="M17 16v-3" />
      </svg>
    </span>
  )
}

function LinkIcon() {
  return (
    <span className="text-gray-700">
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
        <path d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07L11 4" />
        <path d="M14 11a5 5 0 0 0-7.07 0L4.1 13.83a5 5 0 1 0 7.07 7.07L13 20" />
      </svg>
    </span>
  )
}

function ExternalLinkIcon() {
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
      <path d="M14 3h7v7" />
      <path d="M10 14 21 3" />
      <path d="M21 14v4a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3h4" />
    </svg>
  )
}

function SparkIcon() {
  return (
    <span className="text-violet-500">
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
        <path d="m12 3 1.9 3.9L18 8.8l-3 2.9.7 4.2L12 14l-3.7 1.9.7-4.2-3-2.9 4.1-.9L12 3Z" />
      </svg>
    </span>
  )
}

function EyeIcon() {
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
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function PencilIcon() {
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
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
    </svg>
  )
}

function TrashIcon() {
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
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
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