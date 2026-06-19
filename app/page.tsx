'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { sortActiveRequests, sortActiveTodos } from '@/lib/workhub/sort'

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
  last_login_at?: string | null
  is_active?: boolean | null
}

type UserSettingsItem = {
  id: string
  user_id: string
  default_view: 'dashboard' | 'received' | 'sent' | 'history' | 'links' | 'templates'
  notification_enabled: boolean
  mobile_grouped_layout: boolean
  created_at: string
  updated_at: string
}

type ActivityLogItem = {
  id: string
  user_id: string | null
  user_name: string | null
  action: string
  target_type: string
  target_id: string | null
  detail: string | null
  created_at: string
}

type LinkGroupItem = {
  id: string
  name: string
  parent_id: string | null
  sort_order: number
  admin_only: boolean
  created_at: string
  updated_at: string
}

type TemplateGroupItem = {
  id: string
  name: string
  parent_id: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

type TemplateItem = {
  id: string
  group_id: string | null
  title: string
  subject: string
  body: string
  sort_order: number
  created_at: string
  updated_at: string
}

type LinkItem = {
  id: string
  group_id: string | null
  title: string
  url: string
  sort_order: number
  created_at: string
  updated_at: string
}

type TodoItem = {
  id: string
  title: string
  content: string | null
  status: string | null
  priority: string | null
  deadline: string | null
  created_by: string
  assigned_to: string | null
  is_completed: boolean
  completed_at: string | null
  created_at: string
  updated_at: string
}

type ViewKey =
  | 'dashboard'
  | 'received'
  | 'sent'
  | 'history'
  | 'todo'
  | 'todo_history'
  | 'links'
  | 'templates'
  | 'settings'

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

const STATUS = {
  REQUEST: {
    NEW: '未確認',
    DOING: '対応中',
    DONE: '完了',
  },
  TODO: {
    NOT_STARTED: '未着手',
    IN_PROGRESS: '進行中',
    DONE: '完了',
  },
} as const

const PRIORITY = {
  LOW: '低',
  MEDIUM: '中',
  HIGH: '高',
} as const


type RequestStatusValue =
  | typeof STATUS.REQUEST.NEW
  | typeof STATUS.REQUEST.DOING
  | typeof STATUS.REQUEST.DONE

type TodoStatusValue =
  | typeof STATUS.TODO.NOT_STARTED
  | typeof STATUS.TODO.IN_PROGRESS
  | typeof STATUS.TODO.DONE

type PriorityValue =
  | typeof PRIORITY.LOW
  | typeof PRIORITY.MEDIUM
  | typeof PRIORITY.HIGH

const STATUS_OPTIONS = [STATUS.REQUEST.NEW, STATUS.REQUEST.DOING, STATUS.REQUEST.DONE]
const PRIORITY_OPTIONS = [PRIORITY.LOW, PRIORITY.MEDIUM, PRIORITY.HIGH]
const TODO_STATUS_OPTIONS = [STATUS.TODO.NOT_STARTED, STATUS.TODO.IN_PROGRESS, STATUS.TODO.DONE]

const MY_CONNECT_URL =
  'https://script.google.com/a/macros/chronusinc.jp/s/AKfycbzSKDnhFKHWFQZwlUVpi5yrXHuH2GCc4gUny2fUslMkrABG0vAQrTCHzyHBre1fJJT-dg/exec'

const QRAFT_URL =
  'https://qraft-rosy.vercel.app'

const STATUS_META: Record<
  string,
  {
    label: string
    className: string
  }
> = {
  [STATUS.REQUEST.NEW]: {
    label: '未完了',
    className: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200',
  },
  [STATUS.REQUEST.DOING]: {
    label: '保留中',
    className:
      'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
  },
  [STATUS.REQUEST.DONE]: {
    label: '完了',
    className:
      'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
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

function getStatusLabel(status: string | null | undefined) {
  const key = status ?? STATUS.REQUEST.NEW
  return STATUS_META[key]?.label ?? key
}

function getPriorityMeta(priority: string | null | undefined) {
  const key = priority ?? PRIORITY.MEDIUM

  if (key === PRIORITY.HIGH) {
    return {
      label: PRIORITY.HIGH,
      className: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200',
    }
  }

  if (key === PRIORITY.LOW) {
    return {
      label: PRIORITY.LOW,
      className: 'bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200',
    }
  }

  return {
    label: PRIORITY.MEDIUM,
    className:
      'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
  }
}

function getTodoStatusMeta(status: string | null | undefined) {
  const key = status ?? STATUS.TODO.NOT_STARTED

  if (key === STATUS.TODO.IN_PROGRESS) {
    return {
      label: '進行中',
      className: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200',
    }
  }

  if (key === STATUS.TODO.DONE) {
    return {
      label: '完了',
      className:
        'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
    }
  }

  return {
    label: STATUS.TODO.NOT_STARTED,
    className: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200',
  }
}

function getTodoCardStyle(todo: TodoItem) {
  const status = todo.status ?? STATUS.TODO.NOT_STARTED

  if (status === STATUS.TODO.NOT_STARTED && isOverdue(todo.deadline)) {
    return {
      cardClassName:
        'border border-red-200 bg-red-50/80 shadow-sm shadow-red-100/40',
      statusClassName:
        'bg-red-100 text-red-700 ring-1 ring-inset ring-red-200',
    }
  }

  if (status === STATUS.TODO.NOT_STARTED) {
    return {
      cardClassName: 'border border-slate-200 bg-white shadow-sm',
      statusClassName:
        'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200',
    }
  }

  if (status === STATUS.TODO.IN_PROGRESS) {
    return {
      cardClassName: 'border border-slate-200 bg-white shadow-sm',
      statusClassName:
        'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200',
    }
  }

  return {
    cardClassName: 'border border-slate-200 bg-white shadow-sm',
    statusClassName:
      'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
  }
}


function getRequestCardStyle(request: RequestItem) {
  const status = request.status ?? STATUS.REQUEST.NEW
  if (status === STATUS.REQUEST.NEW && isOverdue(request.deadline)) {
    return {
      cardClassName:
        'border border-red-200 bg-red-50/80 shadow-sm shadow-red-100/40',
      statusClassName:
        'bg-red-100 text-red-700 ring-1 ring-inset ring-red-200',
    }
  }

  if (status === STATUS.REQUEST.NEW) {
    return {
      cardClassName: 'border border-slate-200 bg-white shadow-sm',
      statusClassName:
        'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200',
    }
  }

  if (status === STATUS.REQUEST.DOING) {
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


function getUserLabel(user: UserItem | undefined) {
  if (!user) return '未設定ユーザー'
  return user.name?.trim() || user.email?.trim() || '名称未設定'
}

function getActorLabel(
  currentUserProfile: UserItem | undefined,
  effectiveUserProfile: UserItem | undefined,
  isProxyMode: boolean
) {
  const currentName = getUserLabel(currentUserProfile)
  const effectiveName = getUserLabel(effectiveUserProfile)

  if (isProxyMode) {
    return `${currentName}（${effectiveName}として操作）`
  }

  return currentName
}


function getActivityActionLabel(action: string) {
  const map: Record<string, string> = {
    request_created: '依頼作成',
    request_updated: '依頼更新',
    request_deleted: '依頼削除',
    request_status_updated: '依頼ステータス変更',
    role_updated: 'ロール変更',
    user_status_updated: 'アカウント状態変更',
    user_deleted: 'ユーザー削除',
    link_created: 'リンク作成',
    link_updated: 'リンク更新',
    link_deleted: 'リンク削除',
    link_group_created: 'グループ作成',
    link_group_updated: 'グループ更新',
    link_group_deleted: 'グループ削除',
    user_settings_updated: '設定更新',
    todo_created: 'ToDo作成',
    todo_updated: 'ToDo更新',
    todo_deleted: 'ToDo削除',
    todo_status_updated: 'ToDoステータス変更',
    template_created: 'テンプレート作成',
    template_updated: 'テンプレート更新',
    template_deleted: 'テンプレート削除',
    template_group_created: 'テンプレートグループ作成',
    template_group_updated: 'テンプレートグループ更新',
    template_group_deleted: 'テンプレートグループ削除',
  }

  return map[action] ?? action
}

function getActivityTargetTypeLabel(targetType: string) {
  const map: Record<string, string> = {
    request: '依頼',
    user: 'ユーザー',
    link: 'リンク',
    link_group: 'グループ',
    settings: '設定',
    todo: 'ToDo',
    template: 'テンプレート',
    template_group: 'テンプレートグループ',
  }

  return map[targetType] ?? targetType
}

function getActivityActionBadgeClass(action: string) {
  if (action.includes('deleted')) {
    return 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200'
  }

  if (action.includes('created')) {
    return 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200'
  }

  if (action.includes('updated') || action.includes('status')) {
    return 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200'
  }

  return 'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200'
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

function ChevronUpIcon() {
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
      <path d="m6 15 6-6 6 6" />
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

function TodoIcon() {
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
      <path d="M9 11.5 11 13.5l4-4" />
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 7h8" />
      <path d="M8 17h8" />
    </svg>
  )
}

function LinkListIcon() {
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
      <path d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07L11 4" />
      <path d="M14 11a5 5 0 0 0-7.07 0L4.1 13.83a5 5 0 1 0 7.07 7.07L13 20" />
    </svg>
  )
}

function SettingsIcon() {
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
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 8.91 4.6H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.36.58.93.94 1.6 1H21a2 2 0 1 1 0 4h-.09c-.67.06-1.24.42-1.51 1Z" />
    </svg>
  )
}

function DotAlertIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
    </svg>
  )
}

function ExternalLinkIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
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

function BarChartMini({
  tone,
}: {
  tone: 'amber' | 'blue' | 'green' | 'red'
}) {
  const toneClass =
    tone === 'amber'
      ? 'bg-amber-500/80'
      : tone === 'blue'
      ? 'bg-blue-500/80'
      : tone === 'red'
      ? 'bg-red-500/80'
      : 'bg-emerald-500/80'

  return (
    <div className="mt-4 flex items-end justify-center gap-1.5">
      <span className={cn('block w-3 rounded-full', toneClass, 'h-4')} />
      <span className={cn('block w-3 rounded-full', toneClass, 'h-7')} />
      <span className={cn('block w-3 rounded-full', toneClass, 'h-10')} />
    </div>
  )
}

export default function Home() {
  const [user, setUser] = useState<any>(null)
  const [requests, setRequests] = useState<RequestItem[]>([])
  const [todos, setTodos] = useState<TodoItem[]>([])
  const [users, setUsers] = useState<UserItem[]>([])
  const [linkGroups, setLinkGroups] = useState<LinkGroupItem[]>([])
  const [links, setLinks] = useState<LinkItem[]>([])
  const [templateGroups, setTemplateGroups] = useState<TemplateGroupItem[]>([])
  const [templates, setTemplates] = useState<TemplateItem[]>([])
  const [userSettings, setUserSettings] = useState<UserSettingsItem | null>(null)
  const [activityLogs, setActivityLogs] = useState<ActivityLogItem[]>([])
  const [activityLogFetchLimit, setActivityLogFetchLimit] = useState(20)
  const [activityLogUserFilter, setActivityLogUserFilter] = useState('all')
  const [activityLogActionFilter, setActivityLogActionFilter] = useState('all')
  const [activityLogDateFrom, setActivityLogDateFrom] = useState('')
  const [activityLogDateTo, setActivityLogDateTo] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [todoSubmitting, setTodoSubmitting] = useState(false)
  const [linkSubmitting, setLinkSubmitting] = useState(false)
  const [settingsSubmitting, setSettingsSubmitting] = useState(false)
  const [cleanupRunning, setCleanupRunning] = useState(false)
  const [cleanupResult, setCleanupResult] = useState<{ requests: number; todos: number } | null>(null)
  const [createFormOpen, setCreateFormOpen] = useState(false)
  const [todoFormOpen, setTodoFormOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [linkCreateOpen, setLinkCreateOpen] = useState(false)
  const [linkEditMode, setLinkEditMode] = useState(false)
  const [templateEditMode, setTemplateEditMode] = useState(false)
  const [activeView, setActiveView] = useState<ViewKey>('dashboard')
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] =
    useState(false)
  const [userSearch, setUserSearch] = useState('')
  const [linkSearch, setLinkSearch] = useState('')
  const [templateSearch, setTemplateSearch] = useState('')
  const [todoOwnerFilter, setTodoOwnerFilter] = useState<'mine' | 'all'>('mine')

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [recipientIds, setRecipientIds] = useState<string[]>([])
  const [status, setStatus] = useState<RequestStatusValue>(STATUS.REQUEST.NEW)
  const [priority, setPriority] = useState<PriorityValue>(PRIORITY.MEDIUM)
  const [deadline, setDeadline] = useState('')

  const [todoTitle, setTodoTitle] = useState('')
  const [todoContent, setTodoContent] = useState('')
  const [todoStatus, setTodoStatus] = useState<TodoStatusValue>(STATUS.TODO.NOT_STARTED)
  const [todoPriority, setTodoPriority] = useState<PriorityValue>(PRIORITY.MEDIUM)
  const [todoDeadline, setTodoDeadline] = useState('')

  const [newParentGroupName, setNewParentGroupName] = useState('')
  const [newParentGroupAdminOnly, setNewParentGroupAdminOnly] = useState(false)
  const [newChildGroupName, setNewChildGroupName] = useState('')
  const [childParentGroupId, setChildParentGroupId] = useState('')
  const [newLinkTitle, setNewLinkTitle] = useState('')
  const [newLinkUrl, setNewLinkUrl] = useState('')
  const [newLinkGroupId, setNewLinkGroupId] = useState('')

  const [newTemplateParentGroupName, setNewTemplateParentGroupName] = useState('')
  const [newTemplateChildGroupName, setNewTemplateChildGroupName] = useState('')
  const [templateChildParentGroupId, setTemplateChildParentGroupId] = useState('')
  const [newTemplateTitle, setNewTemplateTitle] = useState('')
  const [newTemplateSubject, setNewTemplateSubject] = useState('')
  const [newTemplateBody, setNewTemplateBody] = useState('')
  const [newTemplateGroupId, setNewTemplateGroupId] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null)
  const [detailTarget, setDetailTarget] = useState<RequestItem | null>(null)
  const [todoDetailTarget, setTodoDetailTarget] = useState<TodoItem | null>(null)
  const [selectedLinkGroupId, setSelectedLinkGroupId] = useState<string | null>(null)
  const [selectedTemplateGroupId, setSelectedTemplateGroupId] = useState<string | null>(null)

  const [editingLinkGroupTarget, setEditingLinkGroupTarget] = useState<LinkGroupItem | null>(null)
  const [editLinkGroupName, setEditLinkGroupName] = useState('')
  const [editLinkGroupParentId, setEditLinkGroupParentId] = useState('')
  const [editLinkGroupAdminOnly, setEditLinkGroupAdminOnly] = useState(false)

  const [editingLinkTarget, setEditingLinkTarget] = useState<LinkItem | null>(null)
  const [editLinkTitle, setEditLinkTitle] = useState('')
  const [editLinkUrl, setEditLinkUrl] = useState('')
  const [editLinkGroupId, setEditLinkGroupId] = useState('')

  const [editingTemplateGroupTarget, setEditingTemplateGroupTarget] = useState<TemplateGroupItem | null>(null)
  const [editTemplateGroupName, setEditTemplateGroupName] = useState('')
  const [editTemplateGroupParentId, setEditTemplateGroupParentId] = useState('')

  const [editingTemplateTarget, setEditingTemplateTarget] = useState<TemplateItem | null>(null)
  const [editTemplateTitle, setEditTemplateTitle] = useState('')
  const [editTemplateSubject, setEditTemplateSubject] = useState('')
  const [editTemplateBody, setEditTemplateBody] = useState('')
  const [editTemplateGroupId, setEditTemplateGroupId] = useState('')

  const [settingsDefaultView, setSettingsDefaultView] = useState<ViewKey>('dashboard')
  const [settingsNotificationEnabled, setSettingsNotificationEnabled] = useState(true)
  const [settingsMobileGroupedLayout, setSettingsMobileGroupedLayout] = useState(true)
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const [memberMenuOpen, setMemberMenuOpen] = useState(false)

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

  useEffect(() => {
    if (activeView === 'history') {
      setHistoryOpen(true)
    }
  }, [activeView])

  useEffect(() => {
    if (typeof document === 'undefined') return

    const originalOverflow = document.body.style.overflow

    if (mobileSidebarOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = originalOverflow || ''
    }

    return () => {
      document.body.style.overflow = originalOverflow || ''
    }
  }, [mobileSidebarOpen])

  useEffect(() => {
    if (activeView !== 'links') {
      setSelectedLinkGroupId(null)
      setLinkEditMode(false)
      if (linkCreateOpen) {
        setLinkCreateOpen(false)
        resetLinkCreateForm()
      }
    }

    if (activeView !== 'templates') {
      setSelectedTemplateGroupId(null)
      setTemplateEditMode(false)
      if (linkCreateOpen) {
        setLinkCreateOpen(false)
        resetTemplateCreateForm()
      }
    }
  }, [activeView])

  useEffect(() => {
    setMemberMenuOpen(false)
  }, [activeView])

  const currentUserProfile = useMemo(() => {
    return users.find((item) => item.id === currentUserId)
  }, [users, currentUserId])

  const isAdmin = useMemo(() => {
    return currentUserProfile?.role === 'admin'
  }, [currentUserProfile])

  const effectiveUserId = isAdmin
    ? selectedMemberId || currentUserId
    : currentUserId

  const effectiveUserProfile = useMemo(() => {
    return users.find((item) => item.id === effectiveUserId)
  }, [users, effectiveUserId])

  const isProxyMode =
    isAdmin && !!selectedMemberId && selectedMemberId !== currentUserId

  useEffect(() => {
    if (!isAdmin) {
      setSelectedMemberId(null)
      return
    }

    if (!selectedMemberId) return

    const exists = users.some((item) => item.id === selectedMemberId)
    if (!exists) {
      setSelectedMemberId(null)
    }
  }, [isAdmin, selectedMemberId, users])

  useEffect(() => {
    if (!currentUserId) return

    fetchUserSettings()
  }, [currentUserId])

  useEffect(() => {
    if (isAdmin) return

    if (activeView === 'todo' || activeView === 'todo_history' || activeView === 'templates') {
      setActiveView('dashboard')
    }
  }, [isAdmin, activeView])

  useEffect(() => {
    if (!currentUserId) return

    const syncLastLoginAt = async () => {
      const { error } = await supabase
        .from('users')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', currentUserId)

      if (error) {
        console.warn('last_login_at更新スキップ:', error.message)
        return
      }

      fetchUsers()
    }

    syncLastLoginAt()
  }, [currentUserId])

  useEffect(() => {
    setActivityLogFetchLimit(20)

    if (!currentUserId || !isAdmin) {
      setActivityLogs([])
      return
    }

    if (activeView === 'settings') {
      void fetchActivityLogs(20)
    }
  }, [currentUserId, isAdmin, activeView])

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo:
          typeof window !== 'undefined'
            ? window.location.origin
            : undefined,
      },
    })
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  const logActivity = async (
    action: string,
    targetType: string,
    targetId: string | null,
    detail: string
  ) => {
    if (!currentUserId) return

    const { error } = await supabase.from('activity_logs').insert({
      user_id: currentUserId,
      user_name:
        currentUserProfile?.name ||
        currentUserProfile?.email ||
        user?.email ||
        '不明ユーザー',
      action,
      target_type: targetType,
      target_id: targetId,
      detail,
    })

    if (error) {
      console.error('activity_logs記録エラー:', error)
    }
  }

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, name, role, last_login_at, is_active')
      .order('created_at', { ascending: true })

    if (error) {
      console.error('users取得エラー:', error)
      return
    }

    setUsers((data as UserItem[]) ?? [])
  }

  const fetchRequests = async () => {
    if (!effectiveUserId) {
      setRequests([])
      return
    }

    const { data, error } = await supabase
      .from('requests')
      .select(
        'id, title, content, sender_id, recipient_id, status, priority, deadline, created_at, completed_at, batch_id'
      )
      .or(`sender_id.eq.${effectiveUserId},recipient_id.eq.${effectiveUserId}`)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('requests取得エラー:', error)
      return
    }

    setRequests((data as RequestItem[]) ?? [])
  }

  const fetchTodos = async () => {
    if (!currentUserId || !isAdmin) {
      setTodos([])
      return
    }

    const { data, error } = await supabase
      .from('todos')
      .select(
        'id, title, content, status, priority, deadline, created_by, assigned_to, is_completed, completed_at, created_at, updated_at'
      )
      .order('created_at', { ascending: false })

    if (error) {
      console.error('todos取得エラー:', error)
      return
    }

    setTodos((data as TodoItem[]) ?? [])
  }

  const fetchLinkGroups = async () => {
    const { data, error } = await supabase
      .from('link_groups')
.select('id, name, parent_id, sort_order, admin_only, created_at, updated_at')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) {
      console.error('link_groups取得エラー:', error)
      return
    }

    setLinkGroups((data as LinkGroupItem[]) ?? [])
  }

  const fetchLinks = async () => {
    const { data, error } = await supabase
      .from('links')
      .select('id, group_id, title, url, sort_order, created_at, updated_at')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) {
      console.error('links取得エラー:', error)
      return
    }

    setLinks((data as LinkItem[]) ?? [])
  }

  const fetchTemplateGroups = async () => {
    if (!isAdmin) {
      setTemplateGroups([])
      return
    }

    const { data, error } = await supabase
      .from('template_groups')
      .select('id, name, parent_id, sort_order, created_at, updated_at')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) {
      console.error('template_groups取得エラー:', error)
      return
    }

    setTemplateGroups((data as TemplateGroupItem[]) ?? [])
  }

  const fetchTemplates = async () => {
    if (!isAdmin) {
      setTemplates([])
      return
    }

    const { data, error } = await supabase
      .from('templates')
      .select('id, group_id, title, subject, body, sort_order, created_at, updated_at')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) {
      console.error('templates取得エラー:', error)
      return
    }

    setTemplates((data as TemplateItem[]) ?? [])
  }

  const fetchUserSettings = async () => {
    if (!currentUserId) {
      setUserSettings(null)
      return
    }

    const { data, error } = await supabase
      .from('user_settings')
      .select(
        'id, user_id, default_view, notification_enabled, mobile_grouped_layout, created_at, updated_at'
      )
      .eq('user_id', currentUserId)
      .maybeSingle()

    if (error) {
      console.error('user_settings取得エラー:', error)
      return
    }

    const next = (data as UserSettingsItem | null) ?? null
    setUserSettings(next)

    if (next) {
      setSettingsDefaultView(next.default_view)
      setSettingsNotificationEnabled(next.notification_enabled)
      setSettingsMobileGroupedLayout(next.mobile_grouped_layout)
    }
  }

  const fetchActivityLogs = async (limit = 20) => {
    if (!currentUserId || !isAdmin) {
      setActivityLogs([])
      return
    }

    const { data, error } = await supabase
      .from('activity_logs')
      .select('id, user_id, user_name, action, target_type, target_id, detail, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('activity_logs取得エラー:', error)
      return
    }

    setActivityLogs((data as ActivityLogItem[]) ?? [])
    setActivityLogFetchLimit(limit)
  }

  const refreshLinksData = async () => {
    await Promise.all([fetchLinkGroups(), fetchLinks()])
  }

  const refreshTemplatesData = async () => {
    await Promise.all([fetchTemplateGroups(), fetchTemplates()])
  }

  const handleSelectMember = (userId: string | null) => {
    setSelectedMemberId(userId)
    setMemberMenuOpen(false)
    setCreateFormOpen(false)
    setTodoFormOpen(false)
    setDetailTarget(null)
    setTodoDetailTarget(null)
    setEditingId(null)
    setEditingTodoId(null)
  }

  useEffect(() => {
    if (!currentUserId) {
      setRequests([])
      setTodos([])
      setUsers([])
      setLinkGroups([])
      setLinks([])
      setTemplateGroups([])
      setTemplates([])
      return
    }

    fetchUsers()
    fetchRequests()
    fetchTodos()
  }, [currentUserId, effectiveUserId, isAdmin])

  useEffect(() => {
    if (!currentUserId) return
    if (activeView !== 'links') return
    if (linkGroups.length > 0 || links.length > 0) return

    void fetchLinkGroups()
    void fetchLinks()
  }, [currentUserId, activeView, linkGroups.length, links.length])

  useEffect(() => {
    if (!currentUserId || !isAdmin) return
    if (activeView !== 'templates') return
    if (templateGroups.length > 0 || templates.length > 0) return

    void fetchTemplateGroups()
    void fetchTemplates()
  }, [currentUserId, isAdmin, activeView, templateGroups.length, templates.length])

  useEffect(() => {
    if (!effectiveUserId) return

    const channel = supabase
      .channel(`requests-realtime-${effectiveUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'requests',
        },
        async () => {
          await fetchRequests()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [effectiveUserId])

  useEffect(() => {
    if (!currentUserId || !isAdmin) return

    const channel = supabase
      .channel(`todos-realtime-${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'todos',
        },
        async () => {
          await fetchTodos()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUserId, isAdmin])

  useEffect(() => {
    if (!userSettings) return
    if (activeView !== 'dashboard') return

    const nextDefaultView = userSettings.default_view
    if (nextDefaultView && nextDefaultView !== 'dashboard') {
      setActiveView(nextDefaultView)
    }
  }, [userSettings])

  const userMap = useMemo(() => {
    return new Map(users.map((item) => [item.id, item]))
  }, [users])

  const switchableMembers = useMemo(() => {
    if (!isAdmin) return []

    return users.filter((item) => item.is_active !== false)
  }, [users, isAdmin])

  const activityLogUserOptions = useMemo(() => {
    const names = Array.from(
      new Set(
        activityLogs
          .map((log) => log.user_name?.trim())
          .filter((value): value is string => !!value)
      )
    )

    return names.sort((a, b) => a.localeCompare(b, 'ja'))
  }, [activityLogs])

  const activityLogActionOptions = useMemo(() => {
    const actions = Array.from(new Set(activityLogs.map((log) => log.action)))
    return actions.sort((a, b) => getActivityActionLabel(a).localeCompare(getActivityActionLabel(b), 'ja'))
  }, [activityLogs])

  const filteredActivityLogs = useMemo(() => {
    return activityLogs.filter((log) => {
      const matchesUser =
        activityLogUserFilter === 'all' ||
        (log.user_name || '不明ユーザー') === activityLogUserFilter

      const matchesAction =
        activityLogActionFilter === 'all' ||
        log.action === activityLogActionFilter

      const createdAt = new Date(log.created_at)
      const matchesFrom =
        !activityLogDateFrom ||
        createdAt >= new Date(`${activityLogDateFrom}T00:00:00`)

      const matchesTo =
        !activityLogDateTo ||
        createdAt <= new Date(`${activityLogDateTo}T23:59:59`)

      return matchesUser && matchesAction && matchesFrom && matchesTo
    })
  }, [
    activityLogs,
    activityLogUserFilter,
    activityLogActionFilter,
    activityLogDateFrom,
    activityLogDateTo,
  ])

  const receivedRequests = useMemo(() => {
    return requests.filter((item) => item.recipient_id === effectiveUserId)
  }, [requests, effectiveUserId])

  const sentRequests = useMemo(() => {
    return requests.filter((item) => item.sender_id === effectiveUserId)
  }, [requests, currentUserId])

  const activeReceivedRequests = useMemo(() => {
    return sortActiveRequests(
      receivedRequests.filter((item) => (item.status ?? STATUS.REQUEST.NEW) !== STATUS.REQUEST.DONE)
    )
  }, [receivedRequests])

  const historyRequests = useMemo(() => {
    return requests
      .filter((item) => (item.status ?? STATUS.REQUEST.NEW) === STATUS.REQUEST.DONE)
      .sort((a, b) => {
        const completedA = a.completed_at
          ? new Date(a.completed_at).getTime()
          : 0
        const completedB = b.completed_at
          ? new Date(b.completed_at).getTime()
          : 0
        return completedB - completedA
      })
  }, [requests])

  const activeTodos = useMemo(() => {
    return sortActiveTodos(
      todos.filter(
        (item) => !item.is_completed && (item.status ?? STATUS.TODO.NOT_STARTED) !== STATUS.TODO.DONE
      )
    )
  }, [todos])

  const todoHistoryItems = useMemo(() => {
    return todos
      .filter((item) => item.is_completed || (item.status ?? STATUS.TODO.NOT_STARTED) === STATUS.TODO.DONE)
      .sort((a, b) => {
        const completedA = a.completed_at
          ? new Date(a.completed_at).getTime()
          : 0
        const completedB = b.completed_at
          ? new Date(b.completed_at).getTime()
          : 0
        return completedB - completedA
      })
  }, [todos])

  const isOwnTodo = useMemo(() => {
    return (todo: TodoItem) => {
      if (!currentUserId) return false
      return todo.assigned_to === currentUserId
    }
  }, [currentUserId])

  const visibleActiveTodos = useMemo(() => {
    if (!isAdmin || todoOwnerFilter === 'all') return activeTodos
    return activeTodos.filter((item) => isOwnTodo(item))
  }, [activeTodos, isAdmin, todoOwnerFilter, isOwnTodo])

  const visibleTodoHistoryItems = useMemo(() => {
    if (!isAdmin || todoOwnerFilter === 'all') return todoHistoryItems
    return todoHistoryItems.filter((item) => isOwnTodo(item))
  }, [todoHistoryItems, isAdmin, todoOwnerFilter, isOwnTodo])

  const activeSentRequests = useMemo(() => {
    return sentRequests.filter((item) => (item.status ?? STATUS.REQUEST.NEW) !== STATUS.REQUEST.DONE)
  }, [sentRequests])

  const sentDisplayItems = useMemo<SentDisplayItem[]>(() => {
    const grouped = new Map<string, RequestItem[]>()
    const singles: RequestItem[] = []

    for (const item of activeSentRequests) {
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
  }, [activeSentRequests])

  const filteredRecipientCandidates = useMemo(() => {
    const keyword = userSearch.trim().toLowerCase()
    const candidates = users.filter((item) => item.id !== effectiveUserId)

    if (!keyword) return candidates

    return candidates.filter((item) => {
      const name = item.name?.toLowerCase() ?? ''
      const email = item.email?.toLowerCase() ?? ''
      return name.includes(keyword) || email.includes(keyword)
    })
  }, [users, effectiveUserId, userSearch])

  const dashboardCounts = useMemo(() => {
    const overduePendingCount = receivedRequests.filter((item) => {
      const currentStatus = item.status ?? STATUS.REQUEST.NEW
      return currentStatus !== STATUS.REQUEST.DONE && isOverdue(item.deadline)
    }).length

    const pendingCount = receivedRequests.filter((item) => {
      const currentStatus = item.status ?? STATUS.REQUEST.NEW
      return currentStatus !== STATUS.REQUEST.DONE
    }).length

    const recentSent = sentDisplayItems.slice(0, 5)

    const ownActiveTodos = isAdmin
      ? activeTodos.filter((item) => isOwnTodo(item))
      : []
    const todoPendingCount = ownActiveTodos.length
    const todoOverdueCount = ownActiveTodos.filter((item) =>
      (item.status ?? STATUS.TODO.NOT_STARTED) === STATUS.TODO.NOT_STARTED &&
      isOverdue(item.deadline)
    ).length
    const allTodoOverdueCount = isAdmin
      ? activeTodos.filter((item) =>
          (item.status ?? STATUS.TODO.NOT_STARTED) === STATUS.TODO.NOT_STARTED &&
          isOverdue(item.deadline)
        ).length
      : 0
    const combinedOverdueCount = overduePendingCount + allTodoOverdueCount

    return {
      overduePendingCount,
      pendingCount,
      recentSent,
      receivedTotal: activeReceivedRequests.length,
      sentTotal: activeSentRequests.length,
      completedTotal: historyRequests.length,
      todoPendingCount,
      todoOverdueCount,
      combinedOverdueCount,
    }
  }, [receivedRequests, activeReceivedRequests, activeSentRequests, sentDisplayItems, historyRequests, activeTodos, isAdmin, isOwnTodo])

  const sidebarReceivedPendingCount = useMemo(() => {
    if (!currentUserId) return 0

    return requests.filter((item) => {
      const currentStatus = item.status ?? STATUS.REQUEST.NEW
      return item.recipient_id === currentUserId && currentStatus !== STATUS.REQUEST.DONE
    }).length
  }, [requests, currentUserId])

  const sidebarTodoOverdueCount = useMemo(() => {
    if (!isAdmin || !currentUserId) return 0

    return todos.filter((item) => {
      const currentStatus = item.status ?? STATUS.TODO.NOT_STARTED
      return (
        isOwnTodo(item) &&
        !item.is_completed &&
        currentStatus === STATUS.TODO.NOT_STARTED &&
        isOverdue(item.deadline)
      )
    }).length
  }, [todos, isAdmin, currentUserId, isOwnTodo])

  const filteredLinks = useMemo(() => {
    const keyword = linkSearch.trim().toLowerCase()
    if (!keyword) return links

    return links.filter((link) => link.title.toLowerCase().includes(keyword))
  }, [links, linkSearch])

  const accessibleLinkGroups = useMemo(() => {
    if (isAdmin) return linkGroups
    return linkGroups.filter((group) => !group.admin_only)
  }, [linkGroups, isAdmin])

  const rootLinkGroups = useMemo(() => {
    return [...accessibleLinkGroups]
      .filter((group) => !group.parent_id)
      .sort((a, b) => {
        if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
        return a.name.localeCompare(b.name, 'ja')
      })
  }, [accessibleLinkGroups])

  const childGroupsMap = useMemo(() => {
    const map = new Map<string, LinkGroupItem[]>()

    for (const group of accessibleLinkGroups) {
      if (!group.parent_id) continue
      const current = map.get(group.parent_id) ?? []
      current.push(group)
      map.set(group.parent_id, current)
    }

    for (const [key, value] of map.entries()) {
      map.set(
        key,
        value.sort((a, b) => {
          if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
          return a.name.localeCompare(b.name, 'ja')
        })
      )
    }

    return map
  }, [accessibleLinkGroups])

  const ungroupedLinks = useMemo(() => {
    return filteredLinks
      .filter((link) => !link.group_id)
      .sort((a, b) => {
        if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
        return a.title.localeCompare(b.title, 'ja')
      })
  }, [filteredLinks])

  const linksByGroupId = useMemo(() => {
    const map = new Map<string, LinkItem[]>()

    for (const link of filteredLinks) {
      if (!link.group_id) continue
      const current = map.get(link.group_id) ?? []
      current.push(link)
      map.set(link.group_id, current)
    }

    for (const [key, value] of map.entries()) {
      map.set(
        key,
        value.sort((a, b) => {
          if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
          return a.title.localeCompare(b.title, 'ja')
        })
      )
    }

    return map
  }, [filteredLinks])

  const visibleRootGroups = useMemo(() => {
    return rootLinkGroups.filter((group) => {
      const ownLinks = linksByGroupId.get(group.id) ?? []
      const childGroups = childGroupsMap.get(group.id) ?? []

      const visibleChildGroups = childGroups.filter((child) => {
        const childLinks = linksByGroupId.get(child.id) ?? []
        return childLinks.length > 0
      })

      return ownLinks.length > 0 || visibleChildGroups.length > 0
    })
  }, [rootLinkGroups, linksByGroupId, childGroupsMap])

  const allGroupOptions = useMemo(() => {
    const result: Array<{ id: string; label: string }> = []

    const adminRootGroups = [...linkGroups]
      .filter((group) => !group.parent_id)
      .sort((a, b) => {
        if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
        return a.name.localeCompare(b.name, 'ja')
      })

    const adminChildGroupsMap = new Map<string, LinkGroupItem[]>()
    for (const group of linkGroups) {
      if (!group.parent_id) continue
      const current = adminChildGroupsMap.get(group.parent_id) ?? []
      current.push(group)
      adminChildGroupsMap.set(group.parent_id, current)
    }

    for (const [key, value] of adminChildGroupsMap.entries()) {
      adminChildGroupsMap.set(
        key,
        value.sort((a, b) => {
          if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
          return a.name.localeCompare(b.name, 'ja')
        })
      )
    }

    adminRootGroups.forEach((parent) => {
      result.push({ id: parent.id, label: `${parent.name}${parent.admin_only ? '（管理者のみ）' : ''}` })
      const children = adminChildGroupsMap.get(parent.id) ?? []
      children.forEach((child) => {
        result.push({ id: child.id, label: `└ ${child.name}` })
      })
    })

    return result
  }, [linkGroups])

  const resetForm = () => {
    setTitle('')
    setContent('')
    setRecipientIds([])
    setStatus(STATUS.REQUEST.NEW)
    setPriority(PRIORITY.MEDIUM)
    setDeadline('')
    setEditingId(null)
    setUserSearch('')
  }

  const resetTodoForm = () => {
    setTodoTitle('')
    setTodoContent('')
    setTodoStatus(STATUS.TODO.NOT_STARTED)
    setTodoPriority(PRIORITY.MEDIUM)
    setTodoDeadline('')
    setEditingTodoId(null)
  }

  const resetLinkCreateForm = () => {
    setNewParentGroupName('')
    setNewParentGroupAdminOnly(false)
    setNewChildGroupName('')
    setChildParentGroupId('')
    setNewLinkTitle('')
    setNewLinkUrl('')
    setNewLinkGroupId('')
  }

  const closeLinkGroupEditModal = () => {
    setEditingLinkGroupTarget(null)
    setEditLinkGroupName('')
    setEditLinkGroupParentId('')
    setEditLinkGroupAdminOnly(false)
  }

  const closeLinkEditModal = () => {
    setEditingLinkTarget(null)
    setEditLinkTitle('')
    setEditLinkUrl('')
    setEditLinkGroupId('')
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

        await logActivity(
          'request_updated',
          'request',
          editingId,
          `${trimmedTitle} を更新`
        )

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
        sender_id: effectiveUserId,
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

      await logActivity(
        'request_created',
        'request',
        null,
        `${trimmedTitle} を作成（${recipientIds.length}名に送信）`
      )

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

  const handleCreateTodo = async () => {
    if (!currentUserId || !isAdmin) return

    const trimmedTitle = todoTitle.trim()
    const trimmedContent = todoContent.trim()

    if (!trimmedTitle) {
      alert('ToDoのタイトルを入力してください。')
      return
    }

    setTodoSubmitting(true)

    try {
      if (editingTodoId) {
        const nextIsCompleted = todoStatus === STATUS.TODO.DONE
        const { error } = await supabase
          .from('todos')
          .update({
            title: trimmedTitle,
            content: trimmedContent || null,
            status: todoStatus,
            priority: todoPriority,
            deadline: todoDeadline || null,
            is_completed: nextIsCompleted,
            completed_at: nextIsCompleted ? new Date().toISOString() : null,
          })
          .eq('id', editingTodoId)

        if (error) {
          console.error('ToDo更新エラー:', error)
          alert('ToDoの更新に失敗しました。')
          setTodoSubmitting(false)
          return
        }

        await logActivity(
          'todo_updated',
          'todo',
          editingTodoId,
          `${trimmedTitle} を更新`
        )

        resetTodoForm()
        setTodoFormOpen(false)
        setTodoSubmitting(false)
        fetchTodos()
        return
      }

      const nextIsCompleted = todoStatus === STATUS.TODO.DONE
      const { error } = await supabase.from('todos').insert({
        title: trimmedTitle,
        content: trimmedContent || null,
        status: todoStatus,
        priority: todoPriority,
        deadline: todoDeadline || null,
        created_by: currentUserId,
        assigned_to: currentUserId,
        is_completed: nextIsCompleted,
        completed_at: nextIsCompleted ? new Date().toISOString() : null,
      })

      if (error) {
        console.error('ToDo作成エラー:', error)
        alert('ToDoの保存に失敗しました。')
        setTodoSubmitting(false)
        return
      }

      await logActivity('todo_created', 'todo', null, `${trimmedTitle} を作成`)

      resetTodoForm()
      setTodoFormOpen(false)
      setTodoSubmitting(false)
      fetchTodos()
    } catch (error) {
      console.error('ToDo保存処理エラー:', error)
      alert('ToDoの保存に失敗しました。')
      setTodoSubmitting(false)
    }
  }

  const handleStartEditTodo = (todo: TodoItem) => {
    setEditingTodoId(todo.id)
    setTodoTitle(todo.title)
    setTodoContent(todo.content ?? '')
    setTodoStatus((todo.status as TodoStatusValue | null) ?? STATUS.TODO.NOT_STARTED)
    setTodoPriority((todo.priority as PriorityValue | null) ?? PRIORITY.MEDIUM)
    setTodoDeadline(todo.deadline ?? '')
    setTodoFormOpen(true)
    setCreateFormOpen(false)
    setActiveView('todo')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDeleteTodo = async (todoId: string) => {
    if (!isAdmin) return

    const confirmed = window.confirm('このToDoを削除しますか？')
    if (!confirmed) return

    const targetTodo = todos.find((item) => item.id === todoId)

    const { error } = await supabase.from('todos').delete().eq('id', todoId)

    if (error) {
      console.error('ToDo削除エラー:', error)
      alert('ToDoの削除に失敗しました。')
      return
    }

    await logActivity(
      'todo_deleted',
      'todo',
      todoId,
      targetTodo ? `${targetTodo.title} を削除` : 'ToDoを削除'
    )

    fetchTodos()
  }

  const handleTodoStatusChange = async (todoId: string, nextStatus: string) => {
    if (!isAdmin) return

    const nextIsCompleted = nextStatus === STATUS.TODO.DONE

    const { error } = await supabase
      .from('todos')
      .update({
        status: nextStatus,
        is_completed: nextIsCompleted,
        completed_at: nextIsCompleted ? new Date().toISOString() : null,
      })
      .eq('id', todoId)

    if (error) {
      console.error('ToDoステータス更新エラー:', error)
      alert('ToDoステータスの更新に失敗しました。')
      return
    }

    await logActivity(
      'todo_status_updated',
      'todo',
      todoId,
      `ステータスを${nextStatus}に変更`
    )

    fetchTodos()
  }

  const handleCreateParentGroup = async () => {
    if (!isAdmin) return

    const trimmed = newParentGroupName.trim()
    if (!trimmed) {
      alert('親グループ名を入力してください。')
      return
    }

    setLinkSubmitting(true)

    const maxSortOrder =
      rootLinkGroups.length > 0
        ? Math.max(...rootLinkGroups.map((group) => group.sort_order))
        : -1

    const { error } = await supabase.from('link_groups').insert({
      name: trimmed,
      parent_id: null,
      sort_order: maxSortOrder + 1,
      admin_only: newParentGroupAdminOnly,
    })

    if (error) {
      console.error('親グループ作成エラー:', error)
      alert('親グループの作成に失敗しました。')
      setLinkSubmitting(false)
      return
    }

    await logActivity(
      'link_group_created',
      'link_group',
      null,
      `親グループ ${trimmed} を作成`
    )

    setNewParentGroupName('')
    setNewParentGroupAdminOnly(false)
    await refreshLinksData()
    setLinkSubmitting(false)
  }

  const handleCreateChildGroup = async () => {
    if (!isAdmin) return

    const trimmed = newChildGroupName.trim()
    if (!trimmed) {
      alert('子グループ名を入力してください。')
      return
    }

    if (!childParentGroupId) {
      alert('親グループを選択してください。')
      return
    }

    setLinkSubmitting(true)

    const siblingChildGroups = linkGroups.filter(
      (group) => group.parent_id === childParentGroupId
    )
    const maxSortOrder =
      siblingChildGroups.length > 0
        ? Math.max(...siblingChildGroups.map((group) => group.sort_order))
        : -1

    const parentGroup = linkGroups.find((group) => group.id === childParentGroupId)

    const { error } = await supabase.from('link_groups').insert({
      name: trimmed,
      parent_id: childParentGroupId,
      sort_order: maxSortOrder + 1,
      admin_only: parentGroup?.admin_only ?? false,
    })

    if (error) {
      console.error('子グループ作成エラー:', error)
      alert('子グループの作成に失敗しました。')
      setLinkSubmitting(false)
      return
    }

    await logActivity(
      'link_group_created',
      'link_group',
      null,
      `子グループ ${trimmed} を作成`
    )

    setNewChildGroupName('')
    await refreshLinksData()
    setLinkSubmitting(false)
  }

  const handleCreateLink = async () => {
    if (!isAdmin) return

    const trimmedTitle = newLinkTitle.trim()
    const trimmedUrl = newLinkUrl.trim()

    if (!trimmedTitle || !trimmedUrl) {
      alert('リンクタイトルとURLを入力してください。')
      return
    }

    setLinkSubmitting(true)

    const sameGroupLinks = links.filter(
      (link) => (link.group_id ?? '') === (newLinkGroupId || '')
    )
    const maxSortOrder =
      sameGroupLinks.length > 0
        ? Math.max(...sameGroupLinks.map((link) => link.sort_order))
        : -1

    const { error } = await supabase.from('links').insert({
      title: trimmedTitle,
      url: trimmedUrl,
      group_id: newLinkGroupId || null,
      sort_order: maxSortOrder + 1,
    })

    if (error) {
      console.error('リンク作成エラー:', error)
      alert('リンクの作成に失敗しました。')
      setLinkSubmitting(false)
      return
    }

    await logActivity(
      'link_created',
      'link',
      null,
      `${trimmedTitle} を作成`
    )

    setNewLinkTitle('')
    setNewLinkUrl('')
    setNewLinkGroupId('')
    await refreshLinksData()
    setLinkSubmitting(false)
  }

  const handleEditLinkGroup = (group: LinkGroupItem) => {
    if (!isAdmin) return

    setEditingLinkGroupTarget(group)
    setEditLinkGroupName(group.name)
    setEditLinkGroupParentId(group.parent_id ?? '')
    setEditLinkGroupAdminOnly(group.admin_only ?? false)
  }

  const handleSaveLinkGroupEdit = async () => {
    if (!isAdmin || !editingLinkGroupTarget) return

    const trimmedName = editLinkGroupName.trim()
    if (!trimmedName) {
      alert('グループ名を入力してください。')
      return
    }

    const updatePayload: {
      name: string
      parent_id?: string | null
      sort_order?: number
      admin_only?: boolean
    } = {
      name: trimmedName,
      admin_only: editLinkGroupAdminOnly,
    }

    if (editingLinkGroupTarget.parent_id) {
      if (!editLinkGroupParentId) {
        alert('親グループを選択してください。')
        return
      }

      updatePayload.parent_id = editLinkGroupParentId

      if (editLinkGroupParentId !== editingLinkGroupTarget.parent_id) {
        const siblingChildGroups = linkGroups.filter(
          (group) =>
            group.parent_id === editLinkGroupParentId &&
            group.id !== editingLinkGroupTarget.id
        )
        const maxSortOrder =
          siblingChildGroups.length > 0
            ? Math.max(...siblingChildGroups.map((group) => group.sort_order))
            : -1

        updatePayload.sort_order = maxSortOrder + 1
      }
    }

    const { error } = await supabase
      .from('link_groups')
      .update(updatePayload)
      .eq('id', editingLinkGroupTarget.id)

    if (error) {
      console.error('グループ編集エラー:', error)
      alert('グループの更新に失敗しました。')
      return
    }

    await logActivity(
      'link_group_updated',
      'link_group',
      editingLinkGroupTarget.id,
      `${editingLinkGroupTarget.name} を ${trimmedName} に更新`
    )

    closeLinkGroupEditModal()
    await refreshLinksData()
  }

  const handleDeleteLinkGroup = async (group: LinkGroupItem) => {
    if (!isAdmin) return

    const childGroups = linkGroups.filter((item) => item.parent_id === group.id)
    const targetGroupIds = [group.id, ...childGroups.map((item) => item.id)]

    const confirmed = window.confirm(
      childGroups.length > 0
        ? 'この親グループを削除すると、子グループと配下リンクも削除されます。削除しますか？'
        : 'このグループと配下リンクを削除しますか？'
    )
    if (!confirmed) return

    const { error: linksError } = await supabase
      .from('links')
      .delete()
      .in('group_id', targetGroupIds)

    if (linksError) {
      console.error('リンク削除エラー:', linksError)
      alert('グループ配下のリンク削除に失敗しました。')
      return
    }

    if (childGroups.length > 0) {
      const { error: childError } = await supabase
        .from('link_groups')
        .delete()
        .in('id', childGroups.map((item) => item.id))

      if (childError) {
        console.error('子グループ削除エラー:', childError)
        alert('子グループの削除に失敗しました。')
        return
      }
    }

    const { error } = await supabase
      .from('link_groups')
      .delete()
      .eq('id', group.id)

    if (error) {
      console.error('グループ削除エラー:', error)
      alert('グループの削除に失敗しました。')
      return
    }

    await logActivity(
      'link_group_deleted',
      'link_group',
      group.id,
      `${group.name} を削除`
    )

    if (selectedLinkGroupId === group.id) {
      setSelectedLinkGroupId(null)
    }

    await refreshLinksData()
  }

  const handleEditLink = (link: LinkItem) => {
    if (!isAdmin) return

    setEditingLinkTarget(link)
    setEditLinkTitle(link.title)
    setEditLinkUrl(link.url)
    setEditLinkGroupId(link.group_id ?? '')
  }

  const handleSaveLinkEdit = async () => {
    if (!isAdmin || !editingLinkTarget) return

    const trimmedTitle = editLinkTitle.trim()
    const trimmedUrl = editLinkUrl.trim()

    if (!trimmedTitle || !trimmedUrl) {
      alert('リンク名とURLを入力してください。')
      return
    }

    const nextGroupId = editLinkGroupId || null
    const updatePayload: {
      title: string
      url: string
      group_id: string | null
      sort_order?: number
    } = {
      title: trimmedTitle,
      url: trimmedUrl,
      group_id: nextGroupId,
    }

    if ((editingLinkTarget.group_id ?? null) !== nextGroupId) {
      const siblingLinks = links.filter(
        (link) =>
          (link.group_id ?? null) === nextGroupId &&
          link.id !== editingLinkTarget.id
      )
      const maxSortOrder =
        siblingLinks.length > 0
          ? Math.max(...siblingLinks.map((link) => link.sort_order))
          : -1

      updatePayload.sort_order = maxSortOrder + 1
    }

    const { error } = await supabase
      .from('links')
      .update(updatePayload)
      .eq('id', editingLinkTarget.id)

    if (error) {
      console.error('リンク編集エラー:', error)
      alert('リンクの更新に失敗しました。')
      return
    }

    await logActivity(
      'link_updated',
      'link',
      editingLinkTarget.id,
      `${editingLinkTarget.title} を ${trimmedTitle} に更新`
    )

    closeLinkEditModal()
    await refreshLinksData()
  }

  const swapLinkGroupSortOrder = async (
    currentGroup: LinkGroupItem,
    targetGroup: LinkGroupItem
  ) => {
    const currentSortOrder = currentGroup.sort_order
    const targetSortOrder = targetGroup.sort_order

    const [{ error: currentError }, { error: targetError }] = await Promise.all([
      supabase
        .from('link_groups')
        .update({ sort_order: targetSortOrder })
        .eq('id', currentGroup.id),
      supabase
        .from('link_groups')
        .update({ sort_order: currentSortOrder })
        .eq('id', targetGroup.id),
    ])

    if (currentError || targetError) {
      console.error('グループ並び替えエラー:', currentError ?? targetError)
      alert('グループの並び替えに失敗しました。')
      return
    }

    await refreshLinksData()
  }

  const handleMoveRootLinkGroup = async (
    group: LinkGroupItem,
    direction: 'up' | 'down'
  ) => {
    if (!isAdmin) return

    const currentIndex = rootLinkGroups.findIndex((item) => item.id === group.id)
    if (currentIndex === -1) return

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    const targetGroup = rootLinkGroups[targetIndex]
    if (!targetGroup) return

    await swapLinkGroupSortOrder(group, targetGroup)
  }

  const handleMoveChildLinkGroup = async (
    group: LinkGroupItem,
    direction: 'up' | 'down'
  ) => {
    if (!isAdmin || !group.parent_id) return

    const siblings = childGroupsMap.get(group.parent_id) ?? []
    const currentIndex = siblings.findIndex((item) => item.id === group.id)
    if (currentIndex === -1) return

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    const targetGroup = siblings[targetIndex]
    if (!targetGroup) return

    await swapLinkGroupSortOrder(group, targetGroup)
  }

  const swapLinkSortOrder = async (currentLink: LinkItem, targetLink: LinkItem) => {
    const currentSortOrder = currentLink.sort_order
    const targetSortOrder = targetLink.sort_order

    const [{ error: currentError }, { error: targetError }] = await Promise.all([
      supabase
        .from('links')
        .update({ sort_order: targetSortOrder })
        .eq('id', currentLink.id),
      supabase
        .from('links')
        .update({ sort_order: currentSortOrder })
        .eq('id', targetLink.id),
    ])

    if (currentError || targetError) {
      console.error('リンク並び替えエラー:', currentError ?? targetError)
      alert('リンクの並び替えに失敗しました。')
      return
    }

    await refreshLinksData()
  }

  const handleMoveLink = async (link: LinkItem, direction: 'up' | 'down') => {
    if (!isAdmin) return

    const siblings = link.group_id
      ? linksByGroupId.get(link.group_id) ?? []
      : ungroupedLinks

    const currentIndex = siblings.findIndex((item) => item.id === link.id)
    if (currentIndex === -1) return

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    const targetLink = siblings[targetIndex]
    if (!targetLink) return

    await swapLinkSortOrder(link, targetLink)
  }

  const handleDeleteLink = async (linkId: string) => {
    if (!isAdmin) return

    const targetLink = links.find((item) => item.id === linkId)
    const confirmed = window.confirm('このリンクを削除しますか？')
    if (!confirmed) return

    const { error } = await supabase.from('links').delete().eq('id', linkId)

    if (error) {
      console.error('リンク削除エラー:', error)
      alert('リンクの削除に失敗しました。')
      return
    }

    await logActivity(
      'link_deleted',
      'link',
      linkId,
      targetLink ? `${targetLink.title} を削除` : 'リンクを削除'
    )

    await refreshLinksData()
  }

  const handleStartEdit = (request: RequestItem) => {
    setEditingId(request.id)
    setTitle(request.title)
    setContent(request.content)
    setRecipientIds(request.recipient_id ? [request.recipient_id] : [])
    setStatus((request.status as RequestStatusValue | null) ?? STATUS.REQUEST.NEW)
    setPriority((request.priority as PriorityValue | null) ?? PRIORITY.MEDIUM)
    setDeadline(request.deadline ?? '')
    setCreateFormOpen(true)
    setTodoFormOpen(false)
    setActiveView('sent')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = async (requestId: string) => {
    const confirmed = window.confirm('この依頼を削除しますか？')
    if (!confirmed) return

    const targetRequest = requests.find((item) => item.id === requestId)

    const { error } = await supabase
      .from('requests')
      .delete()
      .eq('id', requestId)

    if (error) {
      console.error('削除エラー:', error)
      alert('削除に失敗しました。')
      return
    }

    await logActivity(
      'request_deleted',
      'request',
      requestId,
      targetRequest ? `${targetRequest.title} を削除` : '依頼を削除'
    )

    fetchRequests()
  }

  const handleStatusChange = async (requestId: string, nextStatus: string) => {
    const updatePayload: {
      status: string
      completed_at?: string | null
    } = {
      status: nextStatus,
    }

    if (nextStatus === STATUS.REQUEST.DONE) {
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

    await logActivity(
      'request_status_updated',
      'request',
      requestId,
      `ステータスを${nextStatus}に変更`
    )

    fetchRequests()
  }

  const handleSaveUserSettings = async () => {
    if (!currentUserId) return

    setSettingsSubmitting(true)

    const payload = {
      user_id: currentUserId,
      default_view: settingsDefaultView === 'settings' ? 'dashboard' : settingsDefaultView,
      notification_enabled: settingsNotificationEnabled,
      mobile_grouped_layout: settingsMobileGroupedLayout,
    }

    const { error } = await supabase
      .from('user_settings')
      .upsert(payload, { onConflict: 'user_id' })

    if (error) {
      console.error('user_settings保存エラー:', error)
      alert('設定の保存に失敗しました。')
      setSettingsSubmitting(false)
      return
    }

    await fetchUserSettings()
    setSettingsSubmitting(false)
    alert('設定を保存しました。')
  }

  const handleManualCleanup = async () => {
    if (!isAdmin) return
    if (!window.confirm('7日以上前の完了済み依頼・ToDoを今すぐ削除しますか？')) return

    setCleanupRunning(true)
    setCleanupResult(null)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      alert('セッションが取得できませんでした。')
      setCleanupRunning(false)
      return
    }

    const res = await fetch('/api/admin/cleanup', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    const json = await res.json()

    setCleanupRunning(false)

    if (json.ok) {
      setCleanupResult({ requests: json.deleted.requests, todos: json.deleted.todos })
      void fetchRequests()
      void fetchTodos()
    } else {
      alert(`クリーンアップ失敗: ${json.error}`)
    }
  }

  const handleRoleChange = async (targetUserId: string, nextRole: string) => {
    if (!isAdmin) return

    const { error } = await supabase
      .from('users')
      .update({ role: nextRole })
      .eq('id', targetUserId)

    if (error) {
      console.error('ロール変更エラー:', error)
      alert('ロール変更に失敗しました。')
      return
    }

    await logActivity(
      'role_updated',
      'user',
      targetUserId,
      `roleを${nextRole}に変更`
    )

    fetchUsers()
    fetchActivityLogs()
  }

  const handleToggleUserActive = async (targetUserId: string, nextValue: boolean) => {
    if (!isAdmin) return

    const { error } = await supabase
      .from('users')
      .update({ is_active: nextValue })
      .eq('id', targetUserId)

    if (error) {
      console.error('アカウント状態変更エラー:', error)
      alert('アカウント状態の更新に失敗しました。')
      return
    }

    await logActivity(
      'user_status_updated',
      'user',
      targetUserId,
      nextValue ? '再開' : '停止'
    )

    fetchUsers()
    fetchActivityLogs()
  }

  const handleDeleteUser = async (targetUser: UserItem) => {
    if (!isAdmin) return

    if (targetUser.id === currentUserId) {
      alert('自分自身のアカウントは削除できません。')
      return
    }

    if (targetUser.is_active !== false) {
      alert('削除する前に、先に対象ユーザーを停止してください。')
      return
    }

    const confirmed = window.confirm(
      `${getUserLabel(targetUser)} を削除しますか?

この操作を行うと、アカウント管理一覧から対象ユーザーが消えます。`
    )
    if (!confirmed) return

    await logActivity(
      'user_deleted',
      'user',
      targetUser.id,
      `${getUserLabel(targetUser)} を削除`
    )

    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', targetUser.id)

    if (error) {
      console.error('ユーザー削除エラー:', error)
      alert('ユーザー削除に失敗しました。')
      return
    }

    fetchUsers()
    fetchActivityLogs()
  }


  const templateRootGroups = useMemo(() => {
    return [...templateGroups]
      .filter((group) => !group.parent_id)
      .sort((a, b) => {
        if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
        return a.name.localeCompare(b.name, 'ja')
      })
  }, [templateGroups])

  const templateChildGroupsMap = useMemo(() => {
    const map = new Map<string, TemplateGroupItem[]>()

    for (const group of templateGroups) {
      if (!group.parent_id) continue
      const current = map.get(group.parent_id) ?? []
      current.push(group)
      map.set(group.parent_id, current)
    }

    for (const [key, value] of map.entries()) {
      map.set(
        key,
        value.sort((a, b) => {
          if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
          return a.name.localeCompare(b.name, 'ja')
        })
      )
    }

    return map
  }, [templateGroups])

  const filteredTemplates = useMemo(() => {
    const keyword = templateSearch.trim().toLowerCase()
    if (!keyword) return templates

    return templates.filter((item) => {
      return (
        item.title.toLowerCase().includes(keyword) ||
        item.subject.toLowerCase().includes(keyword) ||
        item.body.toLowerCase().includes(keyword)
      )
    })
  }, [templates, templateSearch])

  const templatesByGroupId = useMemo(() => {
    const map = new Map<string, TemplateItem[]>()

    for (const item of filteredTemplates) {
      if (!item.group_id) continue
      const current = map.get(item.group_id) ?? []
      current.push(item)
      map.set(item.group_id, current)
    }

    for (const [key, value] of map.entries()) {
      map.set(
        key,
        value.sort((a, b) => {
          if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
          return a.title.localeCompare(b.title, 'ja')
        })
      )
    }

    return map
  }, [filteredTemplates])

  const visibleTemplateRootGroups = useMemo(() => {
    return templateRootGroups.filter((group) => {
      const ownTemplates = templatesByGroupId.get(group.id) ?? []
      const childGroups = templateChildGroupsMap.get(group.id) ?? []
      const visibleChildGroups = childGroups.filter((child) => {
        const childTemplates = templatesByGroupId.get(child.id) ?? []
        return childTemplates.length > 0
      })
      return ownTemplates.length > 0 || visibleChildGroups.length > 0
    })
  }, [templateRootGroups, templatesByGroupId, templateChildGroupsMap])

  const allTemplateGroupOptions = useMemo(() => {
    const result: Array<{ id: string; label: string }> = []

    templateRootGroups.forEach((parent) => {
      result.push({ id: parent.id, label: parent.name })
      const children = templateChildGroupsMap.get(parent.id) ?? []
      children.forEach((child) => {
        result.push({ id: child.id, label: `└ ${child.name}` })
      })
    })

    return result
  }, [templateRootGroups, templateChildGroupsMap])

  const resetTemplateCreateForm = () => {
    setNewTemplateParentGroupName('')
    setNewTemplateChildGroupName('')
    setTemplateChildParentGroupId('')
    setNewTemplateTitle('')
    setNewTemplateSubject('')
    setNewTemplateBody('')
    setNewTemplateGroupId('')
  }

  const closeTemplateGroupEditModal = () => {
    setEditingTemplateGroupTarget(null)
    setEditTemplateGroupName('')
    setEditTemplateGroupParentId('')
  }

  const closeTemplateEditModal = () => {
    setEditingTemplateTarget(null)
    setEditTemplateTitle('')
    setEditTemplateSubject('')
    setEditTemplateBody('')
    setEditTemplateGroupId('')
  }

  const handleCreateTemplateParentGroup = async () => {
    if (!isAdmin) return

    const trimmed = newTemplateParentGroupName.trim()
    if (!trimmed) {
      alert('親グループ名を入力してください。')
      return
    }

    setLinkSubmitting(true)

    const maxSortOrder =
      templateRootGroups.length > 0
        ? Math.max(...templateRootGroups.map((group) => group.sort_order))
        : -1

    const { error } = await supabase.from('template_groups').insert({
      name: trimmed,
      parent_id: null,
      sort_order: maxSortOrder + 1,
    })

    if (error) {
      console.error('テンプレート親グループ作成エラー:', error)
      alert('親グループの作成に失敗しました。')
      setLinkSubmitting(false)
      return
    }

    await logActivity('template_group_created', 'template_group', null, `親グループ ${trimmed} を作成`)
    setNewTemplateParentGroupName('')
    await refreshTemplatesData()
    setLinkSubmitting(false)
  }

  const handleCreateTemplateChildGroup = async () => {
    if (!isAdmin) return

    const trimmed = newTemplateChildGroupName.trim()
    if (!trimmed) {
      alert('子グループ名を入力してください。')
      return
    }

    if (!templateChildParentGroupId) {
      alert('親グループを選択してください。')
      return
    }

    setLinkSubmitting(true)

    const siblingGroups = templateGroups.filter((group) => group.parent_id === templateChildParentGroupId)
    const maxSortOrder =
      siblingGroups.length > 0
        ? Math.max(...siblingGroups.map((group) => group.sort_order))
        : -1

    const { error } = await supabase.from('template_groups').insert({
      name: trimmed,
      parent_id: templateChildParentGroupId,
      sort_order: maxSortOrder + 1,
    })

    if (error) {
      console.error('テンプレート子グループ作成エラー:', error)
      alert('子グループの作成に失敗しました。')
      setLinkSubmitting(false)
      return
    }

    await logActivity('template_group_created', 'template_group', null, `子グループ ${trimmed} を作成`)
    setNewTemplateChildGroupName('')
    await refreshTemplatesData()
    setLinkSubmitting(false)
  }

  const handleCreateTemplate = async () => {
    if (!isAdmin) return

    const trimmedTitle = newTemplateTitle.trim()
    const trimmedSubject = newTemplateSubject.trim()
    const trimmedBody = newTemplateBody.trim()

    if (!trimmedTitle || !trimmedBody) {
      alert('タイトルと本文を入力してください。')
      return
    }

    setLinkSubmitting(true)

    const sameGroupTemplates = templates.filter((item) => (item.group_id ?? '') === (newTemplateGroupId || ''))
    const maxSortOrder =
      sameGroupTemplates.length > 0
        ? Math.max(...sameGroupTemplates.map((item) => item.sort_order))
        : -1

    const { error } = await supabase.from('templates').insert({
      title: trimmedTitle,
      subject: trimmedSubject,
      body: trimmedBody,
      group_id: newTemplateGroupId || null,
      sort_order: maxSortOrder + 1,
    })

    if (error) {
      console.error('テンプレート作成エラー:', error)
      alert('テンプレートの作成に失敗しました。')
      setLinkSubmitting(false)
      return
    }

    await logActivity('template_created', 'template', null, `${trimmedTitle} を作成`)
    setNewTemplateTitle('')
    setNewTemplateSubject('')
    setNewTemplateBody('')
    setNewTemplateGroupId('')
    await refreshTemplatesData()
    setLinkSubmitting(false)
  }

  const handleEditTemplateGroup = (group: TemplateGroupItem) => {
    if (!isAdmin) return
    setEditingTemplateGroupTarget(group)
    setEditTemplateGroupName(group.name)
    setEditTemplateGroupParentId(group.parent_id ?? '')
  }

  const handleSaveTemplateGroupEdit = async () => {
    if (!isAdmin || !editingTemplateGroupTarget) return

    const trimmedName = editTemplateGroupName.trim()
    if (!trimmedName) {
      alert('グループ名を入力してください。')
      return
    }

    const updatePayload: { name: string; parent_id?: string | null; sort_order?: number } = {
      name: trimmedName,
    }

    if (editingTemplateGroupTarget.parent_id) {
      if (!editTemplateGroupParentId) {
        alert('親グループを選択してください。')
        return
      }
      updatePayload.parent_id = editTemplateGroupParentId
      if (editTemplateGroupParentId !== editingTemplateGroupTarget.parent_id) {
        const siblings = templateGroups.filter((group) => group.parent_id === editTemplateGroupParentId && group.id !== editingTemplateGroupTarget.id)
        const maxSortOrder = siblings.length > 0 ? Math.max(...siblings.map((group) => group.sort_order)) : -1
        updatePayload.sort_order = maxSortOrder + 1
      }
    }

    const { error } = await supabase.from('template_groups').update(updatePayload).eq('id', editingTemplateGroupTarget.id)
    if (error) {
      console.error('テンプレートグループ編集エラー:', error)
      alert('グループの更新に失敗しました。')
      return
    }

    await logActivity('template_group_updated', 'template_group', editingTemplateGroupTarget.id, `${editingTemplateGroupTarget.name} を ${trimmedName} に更新`)
    closeTemplateGroupEditModal()
    await refreshTemplatesData()
  }

  const handleDeleteTemplateGroup = async (group: TemplateGroupItem) => {
    if (!isAdmin) return

    const childGroups = templateGroups.filter((item) => item.parent_id === group.id)
    const targetGroupIds = [group.id, ...childGroups.map((item) => item.id)]
    const confirmed = window.confirm(childGroups.length > 0 ? 'この親グループを削除すると、子グループと配下テンプレートも削除されます。削除しますか？' : 'このグループと配下テンプレートを削除しますか？')
    if (!confirmed) return

    const { error: templatesError } = await supabase.from('templates').delete().in('group_id', targetGroupIds)
    if (templatesError) {
      console.error('テンプレート削除エラー:', templatesError)
      alert('グループ配下のテンプレート削除に失敗しました。')
      return
    }

    if (childGroups.length > 0) {
      const { error: childError } = await supabase.from('template_groups').delete().in('id', childGroups.map((item) => item.id))
      if (childError) {
        console.error('テンプレート子グループ削除エラー:', childError)
        alert('子グループの削除に失敗しました。')
        return
      }
    }

    const { error } = await supabase.from('template_groups').delete().eq('id', group.id)
    if (error) {
      console.error('テンプレートグループ削除エラー:', error)
      alert('グループの削除に失敗しました。')
      return
    }

    await logActivity('template_group_deleted', 'template_group', group.id, `${group.name} を削除`)
    if (selectedTemplateGroupId === group.id) setSelectedTemplateGroupId(null)
    await refreshTemplatesData()
  }

  const handleEditTemplate = (item: TemplateItem) => {
    if (!isAdmin) return
    setEditingTemplateTarget(item)
    setEditTemplateTitle(item.title)
    setEditTemplateSubject(item.subject)
    setEditTemplateBody(item.body)
    setEditTemplateGroupId(item.group_id ?? '')
  }

  const handleSaveTemplateEdit = async () => {
    if (!isAdmin || !editingTemplateTarget) return

    const trimmedTitle = editTemplateTitle.trim()
    const trimmedSubject = editTemplateSubject.trim()
    const trimmedBody = editTemplateBody.trim()

    if (!trimmedTitle || !trimmedBody) {
      alert('タイトルと本文を入力してください。')
      return
    }

    const nextGroupId = editTemplateGroupId || null
    const updatePayload: { title: string; subject: string; body: string; group_id: string | null; sort_order?: number } = {
      title: trimmedTitle,
      subject: trimmedSubject,
      body: trimmedBody,
      group_id: nextGroupId,
    }

    if ((editingTemplateTarget.group_id ?? null) !== nextGroupId) {
      const siblings = templates.filter((item) => (item.group_id ?? null) === nextGroupId && item.id !== editingTemplateTarget.id)
      const maxSortOrder = siblings.length > 0 ? Math.max(...siblings.map((item) => item.sort_order)) : -1
      updatePayload.sort_order = maxSortOrder + 1
    }

    const { error } = await supabase.from('templates').update(updatePayload).eq('id', editingTemplateTarget.id)
    if (error) {
      console.error('テンプレート編集エラー:', error)
      alert('テンプレートの更新に失敗しました。')
      return
    }

    await logActivity('template_updated', 'template', editingTemplateTarget.id, `${editingTemplateTarget.title} を ${trimmedTitle} に更新`)
    closeTemplateEditModal()
    await refreshTemplatesData()
  }

  const swapTemplateGroupSortOrder = async (currentGroup: TemplateGroupItem, targetGroup: TemplateGroupItem) => {
    const [{ error: currentError }, { error: targetError }] = await Promise.all([
      supabase.from('template_groups').update({ sort_order: targetGroup.sort_order }).eq('id', currentGroup.id),
      supabase.from('template_groups').update({ sort_order: currentGroup.sort_order }).eq('id', targetGroup.id),
    ])

    if (currentError || targetError) {
      console.error('テンプレートグループ並び替えエラー:', currentError ?? targetError)
      alert('グループの並び替えに失敗しました。')
      return
    }

    await refreshTemplatesData()
  }

  const handleMoveTemplateRootGroup = async (group: TemplateGroupItem, direction: 'up' | 'down') => {
    if (!isAdmin) return
    const currentIndex = templateRootGroups.findIndex((item) => item.id === group.id)
    if (currentIndex === -1) return
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    const targetGroup = templateRootGroups[targetIndex]
    if (!targetGroup) return
    await swapTemplateGroupSortOrder(group, targetGroup)
  }

  const handleMoveTemplateChildGroup = async (group: TemplateGroupItem, direction: 'up' | 'down') => {
    if (!isAdmin || !group.parent_id) return
    const siblings = templateChildGroupsMap.get(group.parent_id) ?? []
    const currentIndex = siblings.findIndex((item) => item.id === group.id)
    if (currentIndex === -1) return
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    const targetGroup = siblings[targetIndex]
    if (!targetGroup) return
    await swapTemplateGroupSortOrder(group, targetGroup)
  }

  const swapTemplateSortOrder = async (currentItem: TemplateItem, targetItem: TemplateItem) => {
    const [{ error: currentError }, { error: targetError }] = await Promise.all([
      supabase.from('templates').update({ sort_order: targetItem.sort_order }).eq('id', currentItem.id),
      supabase.from('templates').update({ sort_order: currentItem.sort_order }).eq('id', targetItem.id),
    ])

    if (currentError || targetError) {
      console.error('テンプレート並び替えエラー:', currentError ?? targetError)
      alert('テンプレートの並び替えに失敗しました。')
      return
    }

    await refreshTemplatesData()
  }

  const handleMoveTemplate = async (item: TemplateItem, direction: 'up' | 'down') => {
    if (!isAdmin) return
    const siblings = item.group_id ? templatesByGroupId.get(item.group_id) ?? [] : []
    const currentIndex = siblings.findIndex((current) => current.id === item.id)
    if (currentIndex === -1) return
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    const targetItem = siblings[targetIndex]
    if (!targetItem) return
    await swapTemplateSortOrder(item, targetItem)
  }

  const handleDeleteTemplate = async (templateId: string) => {
    if (!isAdmin) return
    const targetTemplate = templates.find((item) => item.id === templateId)
    const confirmed = window.confirm('このテンプレートを削除しますか？')
    if (!confirmed) return

    const { error } = await supabase.from('templates').delete().eq('id', templateId)
    if (error) {
      console.error('テンプレート削除エラー:', error)
      alert('テンプレートの削除に失敗しました。')
      return
    }

    await logActivity('template_deleted', 'template', templateId, targetTemplate ? `${targetTemplate.title} を削除` : 'テンプレートを削除')
    await refreshTemplatesData()
  }

  const handleCopyTemplate = async (item: TemplateItem) => {
    const text = item.body || ''
    try {
      await navigator.clipboard.writeText(text)
      alert('テンプレートをコピーしました。')
    } catch (error) {
      console.error('テンプレートコピーエラー:', error)
      alert('コピーに失敗しました。')
    }
  }

  const menuItems: Array<{
    key: ViewKey
    label: string
    icon: ReactNode
  }> = isAdmin
    ? [
        { key: 'dashboard', label: 'ダッシュボード', icon: <DashboardIcon /> },
        { key: 'todo', label: 'ToDo', icon: <TodoIcon /> },
        { key: 'received', label: '受信依頼', icon: <InboxIcon /> },
        { key: 'sent', label: '送信依頼', icon: <SendIcon /> },
        { key: 'todo_history', label: 'ToDo履歴', icon: <HistoryIcon /> },
        { key: 'history', label: '依頼履歴', icon: <HistoryIcon /> },
        { key: 'links', label: 'リンク一覧', icon: <LinkListIcon /> },
        { key: 'templates', label: 'テンプレート', icon: <HistoryIcon /> },
        { key: 'settings', label: '設定', icon: <SettingsIcon /> },
      ]
    : [
        { key: 'dashboard', label: 'ダッシュボード', icon: <DashboardIcon /> },
        { key: 'received', label: '受信依頼', icon: <InboxIcon /> },
        { key: 'sent', label: '送信依頼', icon: <SendIcon /> },
        { key: 'history', label: '依頼履歴', icon: <HistoryIcon /> },
        { key: 'links', label: 'リンク一覧', icon: <LinkListIcon /> },
        { key: 'settings', label: '設定', icon: <SettingsIcon /> },
      ]

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <div
      className={cn(
        'relative flex max-h-dvh min-h-dvh flex-col overflow-hidden border-r border-white/10 bg-[linear-gradient(180deg,#07111f_0%,#0b1830_42%,#0a1425_100%)] text-white shadow-[0_24px_80px_rgba(2,8,23,0.45)]',
        mobile
          ? 'w-72 max-w-[calc(100vw-24px)] rounded-r-[32px]'
          : desktopSidebarCollapsed
          ? 'w-[88px]'
          : 'w-72'
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(96,165,250,0.22),_transparent_30%),radial-gradient(circle_at_20%_35%,_rgba(59,130,246,0.16),_transparent_22%)]" />
      <div className="relative shrink-0 border-b border-white/10 px-4 py-4">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div
            className={cn(
              'min-w-0',
              desktopSidebarCollapsed && !mobile && 'hidden'
            )}
          >
            <p className="text-[13px] font-semibold tracking-[0.04em] text-white/90">
              Work-Hub
            </p>
            <h1 className="mt-1 truncate text-[28px] font-bold leading-none text-white">
              業務管理アプリ
            </h1>
            <p className="mt-2 text-xs text-slate-300">
              Aesthetic Operations Management
            </p>
          </div>

          {!mobile && (
            <button
              type="button"
              onClick={() => setDesktopSidebarCollapsed((prev) => !prev)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-200 backdrop-blur transition hover:bg-white/10"
            >
              {desktopSidebarCollapsed ? (
                <ChevronRightIcon />
              ) : (
                <ChevronDownIcon />
              )}
            </button>
          )}

          {mobile && (
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(false)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-200 backdrop-blur transition hover:bg-white/10"
            >
              <CloseIcon />
            </button>
          )}
        </div>
      </div>

      <div className="relative shrink-0 border-b border-white/10 px-4 py-5">
        <div
          className={cn(
            'rounded-[28px] border border-sky-300/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_18px_40px_rgba(37,99,235,0.18),0_0_0_1px_rgba(148,163,184,0.08)] backdrop-blur-xl',
            desktopSidebarCollapsed &&
              !mobile &&
              'flex items-center justify-center p-3'
          )}
        >
          {desktopSidebarCollapsed && !mobile ? (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white shadow-[0_0_24px_rgba(96,165,250,0.35)]">
              {(currentUserProfile?.name?.trim() || user?.email || 'U').slice(
                0,
                1
              )}
            </div>
          ) : (
            <>
              <p className="text-[30px] font-semibold leading-none text-white">
                {currentUserProfile?.name?.trim() || 'ログイン中'}
              </p>
              <p className="mt-2 truncate text-sm text-slate-200">
                {user?.email || 'メール未取得'}
              </p>
              <p className="mt-2 text-sm text-slate-400">
                {isAdmin ? '役職：管理者' : '役職：パートナー'}
              </p>
            </>
          )}
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <nav className="space-y-2 px-3 py-5">
          {menuItems.map((item) => {
            const active = activeView === item.key
            const badgeCount =
              item.key === 'todo'
                ? sidebarTodoOverdueCount
                : item.key === 'received'
                ? sidebarReceivedPendingCount
                : 0
            const showLabel = !desktopSidebarCollapsed || mobile

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setActiveView(item.key)
                  setMobileSidebarOpen(false)
                }}
                className={cn(
                  'relative flex w-full items-center gap-3 rounded-[22px] px-4 py-3 text-left text-[15px] font-medium transition backdrop-blur',
                  active
                    ? 'border border-sky-300/20 bg-[linear-gradient(90deg,rgba(255,255,255,0.14),rgba(255,255,255,0.05))] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_0_30px_rgba(96,165,250,0.14)]'
                    : 'text-slate-200 hover:bg-white/8',
                  desktopSidebarCollapsed && !mobile && 'justify-center px-0'
                )}
              >
                <span className={cn('relative inline-flex', active ? 'text-white' : 'text-slate-300')}>
                  {item.icon}
                  {!showLabel && badgeCount > 0 && (
                    <span className="absolute -right-2 -top-2 inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white shadow-[0_6px_16px_rgba(239,68,68,0.35)]">
                      {badgeCount > 99 ? '99+' : badgeCount}
                    </span>
                  )}
                </span>
                {showLabel && (
                  <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                    <span className="truncate">{item.label}</span>
                    {badgeCount > 0 && (
                      <span className="inline-flex min-w-[22px] items-center justify-center rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold leading-none text-white shadow-[0_6px_16px_rgba(239,68,68,0.35)]">
                        {badgeCount > 99 ? '99+' : badgeCount}
                      </span>
                    )}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </div>

      <div className="relative shrink-0 border-t border-white/10 p-3">
        <button
          type="button"
          onClick={handleLogout}
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.18),rgba(255,255,255,0.08))] px-3 py-4 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_10px_30px_rgba(15,23,42,0.3)] backdrop-blur transition hover:bg-white/15',
            desktopSidebarCollapsed && !mobile ? 'px-0' : ''
          )}
        >
          <LogoutIcon />
          {(!desktopSidebarCollapsed || mobile) && <span>ログアウト</span>}
        </button>
      </div>
    </div>
  )


  const renderReceivedStatusSelect = (request: RequestItem) => {
    const currentStatus = request.status ?? STATUS.REQUEST.NEW
    const currentMeta = STATUS_META[currentStatus] ?? STATUS_META[STATUS.REQUEST.NEW]

    return (
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[170px]">
          <select
            value={currentStatus}
            onChange={(event) =>
              handleStatusChange(request.id, event.target.value)
            }
            className={cn(
              'w-full appearance-none rounded-2xl border px-4 py-3 pr-10 text-sm font-semibold outline-none transition',
              currentStatus === STATUS.REQUEST.NEW &&
                'border-red-200 bg-red-50 text-red-700',
              currentStatus === STATUS.REQUEST.DOING &&
                'border-amber-200 bg-amber-50 text-amber-700',
              currentStatus === STATUS.REQUEST.DONE &&
                'border-emerald-200 bg-emerald-50 text-emerald-700'
            )}
          >
            <option value="未確認">未完了</option>
            <option value="対応中">保留中</option>
            <option value="完了">完了</option>
          </select>
          <span
            className={cn(
              'pointer-events-none absolute right-3 top-1/2 -translate-y-1/2',
              currentStatus === STATUS.REQUEST.NEW && 'text-red-500',
              currentStatus === STATUS.REQUEST.DOING && 'text-amber-500',
              currentStatus === STATUS.REQUEST.DONE && 'text-emerald-500'
            )}
          >
            <ChevronDownIcon />
          </span>
        </div>
      </div>
    )
  }

  const renderPriorityBadge = (priority: string | null | undefined) => {
    const meta = getPriorityMeta(priority)

    return (
      <span
        className={cn(
          'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold',
          meta.className
        )}
      >
        優先度：{meta.label}
      </span>
    )
  }

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
          'flex h-full flex-col rounded-[28px] p-4 transition sm:p-5',
          cardStyle.cardClassName
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-slate-900">
                {request.title}
              </h3>
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold',
                  cardStyle.statusClassName
                )}
              >
                {getStatusLabel(request.status)}
              </span>
              {renderPriorityBadge(request.priority)}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {request.sender_id === effectiveUserId && (
              <>
                {(request.status ?? STATUS.REQUEST.NEW) !== STATUS.REQUEST.DONE && (
                  <button
                    type="button"
                    onClick={() => handleStartEdit(request)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
                    title="編集"
                  >
                    <EditIcon />
                  </button>
                )}
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

        <div className="mt-3">
          <p className="line-clamp-3 text-sm leading-6 text-slate-700">
            {request.content}
          </p>
        </div>

        <div className="mt-auto pt-4">
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
            <span>送信者：{senderName}</span>
            {showRecipient && <span>共有先：{recipientName}</span>}
            <span>期限：{formatDate(request.deadline)}</span>
            <span>作成日：{formatDateTime(request.created_at)}</span>
            {(request.status ?? STATUS.REQUEST.NEW) === STATUS.REQUEST.DONE && (
              <span>完了日：{formatDateTime(request.completed_at)}</span>
            )}
          </div>

          {request.recipient_id === effectiveUserId &&
            (request.status ?? STATUS.REQUEST.NEW) !== STATUS.REQUEST.DONE &&
            renderReceivedStatusSelect(request)}
        </div>
      </div>
    )
  }

  const renderSentCard = (item: SentDisplayItem) => {
    if (item.type === 'single') {
      return renderRequestCard(item.request, true)
    }

    const unresolved = item.requests.filter(
      (request) => (request.status ?? STATUS.REQUEST.NEW) !== STATUS.REQUEST.DONE
    )
    const unresolvedNames = unresolved.map((request) =>
      getUserLabel(
        request.recipient_id ? userMap.get(request.recipient_id) : undefined
      )
    )

    return (
      <div
        key={item.batchId}
        className="flex h-full flex-col rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-slate-900">
              {item.title}
            </h3>
            <span className="inline-flex items-center rounded-full bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white">
              同時送信 {item.requests.length}名
            </span>
            {renderPriorityBadge(item.priority)}
          </div>
        </div>

        <div className="mt-3">
          <p className="line-clamp-3 text-sm leading-6 text-slate-700">
            {item.content}
          </p>
        </div>

        <div className="mt-auto pt-4">
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
            <span>期限：{formatDate(item.deadline)}</span>
            <span>作成日：{formatDateTime(item.created_at)}</span>
          </div>

          <div className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">
            <p className="font-semibold text-slate-800">未確認者：</p>
            <p className="mt-1 break-words">
              {unresolvedNames.length > 0
                ? unresolvedNames.join('、')
                : '全員対応済み'}
            </p>
          </div>

          <div className="mt-4 grid gap-3">
            {item.requests
              .slice()
              .sort((a, b) => {
                const statusA = a.status ?? STATUS.REQUEST.NEW
                const statusB = b.status ?? STATUS.REQUEST.NEW
                if (statusA === statusB) return 0
                if (statusA === STATUS.REQUEST.NEW) return -1
                if (statusB === STATUS.REQUEST.NEW) return 1
                if (statusA === STATUS.REQUEST.DOING) return -1
                if (statusB === STATUS.REQUEST.DOING) return 1
                return 0
              })
              .map((request) => {
                const recipientName = getUserLabel(
                  request.recipient_id
                    ? userMap.get(request.recipient_id)
                    : undefined
                )
                const rowStyle = getRequestCardStyle(request)

                return (
                  <div
                    key={request.id}
                    className={cn(
                      'rounded-2xl border px-4 py-3',
                      rowStyle.cardClassName
                    )}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-slate-800">
                            {recipientName}
                          </p>
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold',
                              rowStyle.statusClassName
                            )}
                          >
                            {getStatusLabel(request.status)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {request.sender_id === effectiveUserId && (
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
            {(editingId
              ? users.filter((item) => item.id !== effectiveUserId)
              : filteredRecipientCandidates
            ).map((item) => {
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
            })}

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
              onChange={(event) => setStatus(event.target.value as RequestStatusValue)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400"
            >
              {STATUS_OPTIONS.filter((item) => item !== STATUS.REQUEST.DONE).map((item) => (
                <option key={item} value={item}>
                  {getStatusLabel(item)}
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
              onChange={(event) => setPriority(event.target.value as PriorityValue)}
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

  const renderTodoStatusSelect = (todo: TodoItem) => {
    const currentStatus = todo.status ?? STATUS.TODO.NOT_STARTED
    const currentMeta = getTodoStatusMeta(currentStatus)

    return (
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[170px]">
          <select
            value={currentStatus}
            onChange={(event) =>
              handleTodoStatusChange(todo.id, event.target.value)
            }
            className={cn(
              'w-full appearance-none rounded-2xl border px-4 py-3 pr-10 text-sm font-semibold outline-none transition',
              currentStatus === STATUS.TODO.NOT_STARTED &&
                'border-red-200 bg-red-50 text-red-700',
              currentStatus === STATUS.TODO.IN_PROGRESS &&
                'border-amber-200 bg-amber-50 text-amber-700',
              currentStatus === STATUS.REQUEST.DONE &&
                'border-emerald-200 bg-emerald-50 text-emerald-700'
            )}
          >
            <option value="未着手">未着手</option>
            <option value="進行中">進行中</option>
            <option value="完了">完了</option>
          </select>
          <span
            className={cn(
              'pointer-events-none absolute right-3 top-1/2 -translate-y-1/2',
              currentStatus === STATUS.TODO.NOT_STARTED && 'text-red-500',
              currentStatus === STATUS.TODO.IN_PROGRESS && 'text-amber-500',
              currentStatus === STATUS.REQUEST.DONE && 'text-emerald-500'
            )}
          >
            <ChevronDownIcon />
          </span>
        </div>
      </div>
    )
  }

  const renderTodoForm = () => (
    <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            {editingTodoId ? 'ToDoを編集' : '新規ToDoを作成'}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            タイトル・内容・優先度・期限を入力してください
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setTodoFormOpen(false)
            resetTodoForm()
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
            value={todoTitle}
            onChange={(event) => setTodoTitle(event.target.value)}
            placeholder="例：月末集計の確認"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            内容
          </label>
          <textarea
            value={todoContent}
            onChange={(event) => setTodoContent(event.target.value)}
            rows={5}
            placeholder="ToDoの詳細を入力してください"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              ステータス
            </label>
            <select
              value={todoStatus}
              onChange={(event) => setTodoStatus(event.target.value as TodoStatusValue)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400"
            >
              {TODO_STATUS_OPTIONS.map((item) => (
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
              value={todoPriority}
              onChange={(event) => setTodoPriority(event.target.value as PriorityValue)}
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
              value={todoDeadline}
              onChange={(event) => setTodoDeadline(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400"
            />
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              resetTodoForm()
              setTodoFormOpen(false)
            }}
            className="inline-flex h-11 items-center rounded-2xl border border-slate-200 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            キャンセル
          </button>

          <button
            type="button"
            onClick={handleCreateTodo}
            disabled={todoSubmitting}
            className="inline-flex h-11 items-center rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {todoSubmitting ? '保存中...' : editingTodoId ? '更新する' : '保存する'}
          </button>
        </div>
      </div>
    </div>
  )

  const renderTodoCard = (todo: TodoItem, isHistory = false) => {
    const cardStyle = getTodoCardStyle(todo)
    const creatorName = getUserLabel(userMap.get(todo.created_by))
    const assigneeName = getUserLabel(
      todo.assigned_to ? userMap.get(todo.assigned_to) : undefined
    )

    return (
      <div
        key={todo.id}
        className={cn(
          'flex h-full flex-col rounded-[28px] p-4 transition sm:p-5',
          cardStyle.cardClassName
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-slate-900">
                {todo.title}
              </h3>
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold',
                  cardStyle.statusClassName
                )}
              >
                {todo.status ?? STATUS.TODO.NOT_STARTED}
              </span>
              {renderPriorityBadge(todo.priority)}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {!isHistory && (
              <>
                <button
                  type="button"
                  onClick={() => handleStartEditTodo(todo)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
                  title="編集"
                >
                  <EditIcon />
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteTodo(todo.id)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-red-200 bg-white text-red-600 transition hover:bg-red-50"
                  title="削除"
                >
                  <TrashIcon />
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => setTodoDetailTarget(todo)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
              title="詳細"
            >
              <EyeIcon />
            </button>
          </div>
        </div>

        <div className="mt-3">
          <p className="line-clamp-3 text-sm leading-6 text-slate-700">
            {todo.content || '内容なし'}
          </p>
        </div>

        <div className="mt-auto pt-4">
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
            <span>作成者：{creatorName}</span>
            <span>担当：{assigneeName}</span>
            <span>期限：{formatDate(todo.deadline)}</span>
            <span>作成日：{formatDateTime(todo.created_at)}</span>
            {isHistory && <span>完了日：{formatDateTime(todo.completed_at)}</span>}
          </div>

          {!isHistory && renderTodoStatusSelect(todo)}
        </div>
      </div>
    )
  }

  const renderTodo = () => {
    if (!isAdmin) return null

    return (
      <div className="space-y-5">
        <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">ToDo</h2>
              <p className="mt-1 text-sm text-slate-500">
                管理者専用のToDo一覧です。未完了・進行中のみ表示します。
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
                <button
                  type="button"
                  onClick={() => setTodoOwnerFilter('mine')}
                  className={cn(
                    'rounded-xl px-3 py-2 text-sm font-semibold transition',
                    todoOwnerFilter === 'mine'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-white'
                  )}
                >
                  自分のToDo
                </button>
                <button
                  type="button"
                  onClick={() => setTodoOwnerFilter('all')}
                  className={cn(
                    'rounded-xl px-3 py-2 text-sm font-semibold transition',
                    todoOwnerFilter === 'all'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-white'
                  )}
                >
                  すべて
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  resetTodoForm()
                  setCreateFormOpen(false)
                  setTodoFormOpen((prev) => !prev)
                  setActiveView('todo')
                }}
                className="inline-flex h-11 items-center gap-2 rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                <PlusIcon />
                新規ToDoを追加
              </button>
            </div>
          </div>
        </div>

        {visibleActiveTodos.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleActiveTodos.map((todo) => renderTodoCard(todo))}
          </div>
        ) : (
          <div className="rounded-[28px] border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
            表示するToDoはありません。
          </div>
        )}
      </div>
    )
  }

  const renderTodoHistory = () => {
    if (!isAdmin) return null

    return (
      <div className="space-y-5">
        <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">ToDo履歴</h2>
              <p className="mt-1 text-sm text-slate-500">
                完了したToDoを表示します。完了後7日で自動削除されます。
              </p>
            </div>

            <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => setTodoOwnerFilter('mine')}
                className={cn(
                  'rounded-xl px-3 py-2 text-sm font-semibold transition',
                  todoOwnerFilter === 'mine'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-white'
                )}
              >
                自分のToDo
              </button>
              <button
                type="button"
                onClick={() => setTodoOwnerFilter('all')}
                className={cn(
                  'rounded-xl px-3 py-2 text-sm font-semibold transition',
                  todoOwnerFilter === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-white'
                )}
              >
                すべて
              </button>
            </div>
          </div>
        </div>

        {visibleTodoHistoryItems.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleTodoHistoryItems.map((todo) => renderTodoCard(todo, true))}
          </div>
        ) : (
          <div className="rounded-[28px] border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
            完了済みToDoはありません。
          </div>
        )}
      </div>
    )
  }

  const renderAdminLinkCreatePanel = () => {
    if (!isAdmin) return null

    return (
      <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <p className="text-base font-semibold text-slate-900">
                親グループ作成
              </p>
              <p className="mt-1 text-xs text-slate-500">
                例：営業、社内ツール、媒体
              </p>

              <div className="mt-4">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  親グループ名
                </label>
                <input
                  value={newParentGroupName}
                  onChange={(event) => setNewParentGroupName(event.target.value)}
                  placeholder="親グループ名を入力"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                />
              </div>

              <div className="mt-4">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  表示設定
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewParentGroupAdminOnly(false)}
                    className={cn(
                      'rounded-2xl border px-4 py-3 text-sm font-medium transition',
                      !newParentGroupAdminOnly
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    )}
                  >
                    一般表示
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewParentGroupAdminOnly(true)}
                    className={cn(
                      'rounded-2xl border px-4 py-3 text-sm font-medium transition',
                      newParentGroupAdminOnly
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    )}
                  >
                    管理者のみ
                  </button>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  管理者のみを選ぶと、一般ユーザー画面には表示されません。
                </p>
              </div>

              <button
                type="button"
                onClick={handleCreateParentGroup}
                disabled={linkSubmitting}
                className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {linkSubmitting ? '保存中...' : '親グループを追加'}
              </button>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <p className="text-base font-semibold text-slate-900">
                子グループ作成
              </p>
              <p className="mt-1 text-xs text-slate-500">
                親グループの下に作成します
              </p>

              <div className="mt-4">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  親グループ
                </label>
                <select
                  value={childParentGroupId}
                  onChange={(event) => setChildParentGroupId(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                >
                  <option value="">選択してください</option>
                  {rootLinkGroups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-4">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  子グループ名
                </label>
                <input
                  value={newChildGroupName}
                  onChange={(event) => setNewChildGroupName(event.target.value)}
                  placeholder="子グループ名を入力"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                />
              </div>

              <button
                type="button"
                onClick={handleCreateChildGroup}
                disabled={linkSubmitting}
                className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {linkSubmitting ? '保存中...' : '子グループを追加'}
              </button>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <p className="text-base font-semibold text-slate-900">
                リンク作成
              </p>
              <p className="mt-1 text-xs text-slate-500">
                グループを選んでリンクを追加します
              </p>

              <div className="mt-4">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  所属グループ
                </label>
                <select
                  value={newLinkGroupId}
                  onChange={(event) => setNewLinkGroupId(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                >
                  <option value="">未分類</option>
                  {allGroupOptions.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-4">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  リンクタイトル
                </label>
                <input
                  value={newLinkTitle}
                  onChange={(event) => setNewLinkTitle(event.target.value)}
                  placeholder="例：マイコネクト"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                />
              </div>

              <div className="mt-4">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  URL
                </label>
                <input
                  value={newLinkUrl}
                  onChange={(event) => setNewLinkUrl(event.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                />
              </div>

              <button
                type="button"
                onClick={handleCreateLink}
                disabled={linkSubmitting}
                className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {linkSubmitting ? '保存中...' : 'リンクを追加'}
              </button>
            </div>
          </div>
      </div>
    )
  }

  const renderRecentSentCard = (item: SentDisplayItem) => {
    const hasOverdueUnconfirmed =
      item.type === 'single'
        ? (item.request.status ?? STATUS.REQUEST.NEW) === STATUS.REQUEST.NEW &&
          isOverdue(item.request.deadline)
        : item.requests.some(
            (request) =>
              (request.status ?? STATUS.REQUEST.NEW) === STATUS.REQUEST.NEW &&
              isOverdue(request.deadline)
          )

    const title = item.type === 'single' ? item.request.title : item.title
    const subtitle =
      item.type === 'single'
        ? `共有先：${getUserLabel(
            item.request.recipient_id
              ? userMap.get(item.request.recipient_id)
              : undefined
          )}`
        : `同時送信 ${item.requests.length}名`

    return (
      <div
        key={item.type === 'single' ? item.request.id : item.batchId}
        className="flex items-center justify-between rounded-[22px] border border-slate-200 bg-white px-4 py-3 shadow-sm"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">
            {title}
          </p>
          <p className="mt-1 truncate text-xs text-slate-500">{subtitle}</p>
        </div>

        <span
          className={cn(
            'ml-3 inline-flex h-8 w-8 items-center justify-center rounded-full',
            hasOverdueUnconfirmed
              ? 'bg-amber-100 text-amber-600'
              : 'bg-slate-100 text-slate-400'
          )}
          title={hasOverdueUnconfirmed ? '期限切れかつ未確認あり' : '通常'}
        >
          <DotAlertIcon />
        </span>
      </div>
    )
  }

  const renderDashboard = () => (
    <div className="grid min-w-0 gap-5 lg:grid-cols-3 lg:gap-6">
      <div className="min-w-0 max-w-full overflow-hidden rounded-[28px] border border-white/60 bg-white/65 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.12)] backdrop-blur-xl sm:rounded-[32px] sm:p-6">
        <div className="flex h-full flex-col">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <p className="text-[15px] font-semibold text-slate-800">
              マイコネクト／Qraft
            </p>
            <span className="shrink-0 whitespace-nowrap rounded-full border border-white/70 bg-white/70 px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
              外部リンク
            </span>
          </div>
          <div className="mt-4 flex min-w-0 flex-1 flex-col gap-3 sm:mt-5">
            <a
              href={MY_CONNECT_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-[20px] bg-[linear-gradient(90deg,#53b8ff_0%,#7c6cff_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(99,102,241,0.35)] transition hover:opacity-90 sm:px-5"
            >
              <ExternalLinkIcon />
              マイコネクトを開く
            </a>
            <a
              href={QRAFT_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-[20px] bg-[linear-gradient(90deg,#53b8ff_0%,#7c6cff_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(99,102,241,0.35)] transition hover:opacity-90 sm:px-5"
            >
              <ExternalLinkIcon />
              Qraftを開く
            </a>
          </div>
        </div>
      </div>

      <div
        className={cn(
          'min-w-0 max-w-full overflow-hidden rounded-[28px] border bg-white/65 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.12)] backdrop-blur-xl sm:rounded-[32px] sm:p-6',
          dashboardCounts.overduePendingCount > 0
            ? 'border-red-200/80'
            : 'border-white/60'
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <p
              className={cn(
                'text-[15px] font-semibold',
                dashboardCounts.overduePendingCount > 0
                  ? 'text-red-700'
                  : 'text-slate-800'
              )}
            >
              期限切れ・要対応
            </p>
            <span className="shrink-0 whitespace-nowrap rounded-full border border-white/70 bg-white/70 px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
              優先確認
            </span>
          </div>

          <div className="mt-4 flex min-w-0 flex-1 items-end justify-between gap-3 sm:mt-5 sm:gap-4">
            <div>
              <p
                className={cn(
                  'text-6xl font-bold leading-none tracking-tight sm:text-7xl',
                  dashboardCounts.overduePendingCount > 0
                    ? 'text-red-700'
                    : 'text-slate-900'
                )}
              >
                {isAdmin ? dashboardCounts.combinedOverdueCount : dashboardCounts.overduePendingCount}
              </p>
            </div>
            <div className="text-right text-sm text-slate-500">
              <p>0 out of total</p>
            </div>
          </div>

          <div className="mt-5 flex gap-1.5">
            {Array.from({ length: 16 }).map((_, index) => {
              const activeCount = Math.min(
                isAdmin ? dashboardCounts.combinedOverdueCount : dashboardCounts.overduePendingCount,
                16
              )
              return (
                <span
                  key={index}
                  className={cn(
                    'h-3 flex-1 rounded-full shadow-sm',
                    index < activeCount
                      ? 'bg-[linear-gradient(180deg,#7cc4ff_0%,#4f8fff_100%)]'
                      : 'bg-white/70 ring-1 ring-inset ring-slate-200/80'
                  )}
                />
              )
            })}
          </div>

          <p
            className={cn(
              'mt-4 text-sm leading-6',
              dashboardCounts.overduePendingCount > 0
                ? 'text-red-700/80'
                : 'text-slate-600'
            )}
          >
            {isAdmin ? '期限切れの依頼と自分のToDoの合計件数です。' : '期限切れで未完了の依頼件です。'}
          </p>
        </div>
      </div>

      <div className="min-w-0 max-w-full overflow-hidden rounded-[28px] border border-white/60 bg-white/65 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.12)] backdrop-blur-xl sm:rounded-[32px] sm:p-6">
        <div className="flex h-full flex-col">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <p className="text-[15px] font-semibold text-slate-800">
              未対応の依頼
            </p>
            <span className="shrink-0 whitespace-nowrap rounded-full border border-white/70 bg-white/70 px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
              受信
            </span>
          </div>

          <div className="mt-4 flex min-w-0 flex-1 items-end justify-between gap-3 sm:mt-5 sm:gap-4">
            <div>
              <p className="text-7xl font-bold leading-none tracking-tight text-slate-900">
                {dashboardCounts.pendingCount}
              </p>
            </div>
            <div className="text-right text-sm text-slate-500">
              <p>0 out of total</p>
            </div>
          </div>

          <div className="mt-5 flex gap-1.5">
            {Array.from({ length: 16 }).map((_, index) => {
              const activeCount = Math.min(dashboardCounts.pendingCount, 16)
              return (
                <span
                  key={index}
                  className={cn(
                    'h-3 flex-1 rounded-full shadow-sm',
                    index < activeCount
                      ? 'bg-[linear-gradient(180deg,#7cc4ff_0%,#4f8fff_100%)]'
                      : 'bg-white/70 ring-1 ring-inset ring-slate-200/80'
                  )}
                />
              )
            })}
          </div>

          <p className="mt-4 text-sm leading-6 text-slate-600">
            まだ完了していない受信依頼の件です。
          </p>
        </div>
      </div>

      <div className="min-w-0 max-w-full overflow-hidden rounded-[28px] border border-white/60 bg-white/65 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.12)] backdrop-blur-xl sm:rounded-[32px] sm:p-6">
        <div className="flex h-full flex-col">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <p className="text-[15px] font-semibold text-slate-800">
              最近の送信依頼
            </p>
            <span className="shrink-0 whitespace-nowrap rounded-full border border-white/70 bg-white/70 px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
              最新5件
            </span>
          </div>

          <div className="mt-5 flex-1 space-y-3">
            {dashboardCounts.recentSent.length > 0 ? (
              dashboardCounts.recentSent.map((item) => renderRecentSentCard(item))
            ) : (
              <p className="text-sm text-slate-500">送信した依頼はありません。</p>
            )}
          </div>
        </div>
      </div>

      {!isAdmin && (
        <div className="min-w-0 max-w-full overflow-hidden rounded-[28px] border border-white/60 bg-white/65 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.12)] backdrop-blur-xl sm:rounded-[32px] sm:p-6">
          <div className="flex h-full flex-col">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <p className="text-[15px] font-semibold text-slate-800">操作</p>
              <span className="shrink-0 whitespace-nowrap rounded-full border border-white/70 bg-white/70 px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
                クイック
              </span>
            </div>

            <div className="mt-5 flex-1 space-y-3">
              <button
                type="button"
                onClick={() => {
                  resetForm()
                  setTodoFormOpen(false)
                  setCreateFormOpen((prev) => !prev)
                  setActiveView('dashboard')
                }}
                className="flex w-full items-center justify-between rounded-[22px] bg-[linear-gradient(90deg,#53b8ff_0%,#7c6cff_100%)] px-4 py-3 text-left text-sm font-semibold text-white shadow-[0_10px_30px_rgba(99,102,241,0.25)] transition hover:opacity-95"
              >
                <span>新規依頼を追加</span>
                <PlusIcon />
              </button>

              <button
                type="button"
                onClick={() => setActiveView('received')}
                className="flex w-full items-center justify-between rounded-[22px] border border-white/70 bg-white/80 px-4 py-3 text-left text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-white"
              >
                <span>受信依頼を見る</span>
                <ChevronRightIcon />
              </button>

              <button
                type="button"
                onClick={() => setActiveView('sent')}
                className="flex w-full items-center justify-between rounded-[22px] border border-white/70 bg-white/80 px-4 py-3 text-left text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-white"
              >
                <span>送信依頼を見る</span>
                <ChevronRightIcon />
              </button>
            </div>
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="min-w-0 max-w-full overflow-hidden rounded-[28px] border border-white/60 bg-white/65 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.12)] backdrop-blur-xl sm:rounded-[32px] sm:p-6">
          <div className="flex h-full flex-col">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <p className="text-[15px] font-semibold text-slate-800">自分のToDo</p>
              <span className="shrink-0 whitespace-nowrap rounded-full border border-white/70 bg-white/70 px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
                管理者のみ
              </span>
            </div>

            <div className="mt-5 grid flex-1 grid-cols-2 gap-4">
              <div className="rounded-[24px] border border-amber-100 bg-[linear-gradient(180deg,rgba(255,251,235,0.95),rgba(254,243,199,0.9))] p-4 text-center shadow-sm">
                <p className="text-sm font-semibold text-amber-700">未着手・進行中</p>
                <p className="mt-3 text-5xl font-bold leading-none text-[#9a4b00]">
                  {dashboardCounts.todoPendingCount}
                </p>
              </div>

              <div className="rounded-[24px] border border-red-100 bg-[linear-gradient(180deg,rgba(254,242,242,0.95),rgba(254,226,226,0.9))] p-4 text-center shadow-sm">
                <p className="text-sm font-semibold text-red-700">期限切れToDo</p>
                <p className="mt-3 text-5xl font-bold leading-none text-[#b42318]">
                  {dashboardCounts.todoOverdueCount}
                </p>
              </div>
            </div>

            <div className="mt-5 h-4 overflow-hidden rounded-full bg-white/75 ring-1 ring-inset ring-slate-200/70">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#5a8fff_0%,#4fc3a1_45%,#f59e0b_78%,#f0abfc_100%)]"
                style={{
                  width: `${Math.max(
                    18,
                    Math.min(
                      100,
                      (dashboardCounts.todoPendingCount + dashboardCounts.todoOverdueCount) * 16
                    )
                  )}%`,
                }}
              />
            </div>
          </div>
        </div>
      )}

      <div className="min-w-0 max-w-full overflow-hidden rounded-[28px] border border-white/60 bg-white/65 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.12)] backdrop-blur-xl sm:rounded-[32px] sm:p-6">
        <div className="flex h-full flex-col">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <p className="text-[15px] font-semibold text-slate-800">概要</p>
            <span className="shrink-0 whitespace-nowrap rounded-full border border-white/70 bg-white/70 px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
              件数サマリ
            </span>
          </div>

          <div className="mt-5 grid flex-1 grid-cols-3 gap-4">
            <div className="rounded-[24px] border border-amber-100 bg-[linear-gradient(180deg,rgba(255,249,219,0.95),rgba(255,237,188,0.92))] p-4 text-center shadow-sm">
              <p className="text-sm font-semibold text-amber-700">受信</p>
              <p className="mt-3 text-5xl font-bold leading-none text-[#9a4b00]">
                {dashboardCounts.receivedTotal}
              </p>
              <BarChartMini tone="amber" />
            </div>

            <div className="rounded-[24px] border border-blue-100 bg-[linear-gradient(180deg,rgba(236,244,255,0.95),rgba(219,234,254,0.92))] p-4 text-center shadow-sm">
              <p className="text-sm font-semibold text-blue-700">送信</p>
              <p className="mt-3 text-5xl font-bold leading-none text-[#2d4bb3]">
                {dashboardCounts.sentTotal}
              </p>
              <BarChartMini tone="blue" />
            </div>

            <div className="rounded-[24px] border border-red-100 bg-[linear-gradient(180deg,rgba(254,242,242,0.95),rgba(254,226,226,0.92))] p-4 text-center shadow-sm">
              <p className="text-sm font-semibold text-red-700">期限切れ</p>
              <p className="mt-3 text-5xl font-bold leading-none text-[#b42318]">
                {dashboardCounts.overduePendingCount}
              </p>
              <BarChartMini tone="red" />
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
            setTodoFormOpen(false)
            setCreateFormOpen(true)
          }}
          className="inline-flex h-11 items-center gap-2 rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          <PlusIcon />
          新規依頼
        </button>
      </div>

      {activeReceivedRequests.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
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
            setTodoFormOpen(false)
            setCreateFormOpen(true)
          }}
          className="inline-flex h-11 items-center gap-2 rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          <PlusIcon />
          新規依頼
        </button>
      </div>

      {sentDisplayItems.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
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
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {historyRequests.map((request) =>
              renderRequestCard(request, request.sender_id === effectiveUserId)
            )}
          </div>
        ) : (
          <div className="rounded-[28px] border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
            履歴はまだありません。
          </div>
        ))}
    </div>
  )

  const renderMoveButtons = ({
    onMoveUp,
    onMoveDown,
    disableUp,
    disableDown,
  }: {
    onMoveUp: () => void
    onMoveDown: () => void
    disableUp: boolean
    disableDown: boolean
  }) => (
    <div className="flex shrink-0 items-center gap-2">
      <button
        type="button"
        onClick={onMoveUp}
        disabled={disableUp}
        className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        title="上へ"
      >
        <ChevronUpIcon />
      </button>
      <button
        type="button"
        onClick={onMoveDown}
        disabled={disableDown}
        className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        title="下へ"
      >
        <ChevronDownIcon />
      </button>
    </div>
  )

  const renderLinkRow = (
    link: LinkItem,
    options?: {
      disableMoveUp?: boolean
      disableMoveDown?: boolean
    }
  ) => (
    <div
      key={link.id}
      className="flex items-center justify-between gap-3 rounded-[20px] border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:bg-slate-50"
    >
      <a
        href={link.url}
        target="_blank"
        rel="noreferrer"
        className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900 hover:text-blue-600"
      >
        {link.title}
      </a>

      {isAdmin && linkEditMode && (
        <div className="flex shrink-0 items-center gap-2">
          {renderMoveButtons({
            onMoveUp: () => handleMoveLink(link, 'up'),
            onMoveDown: () => handleMoveLink(link, 'down'),
            disableUp: options?.disableMoveUp ?? false,
            disableDown: options?.disableMoveDown ?? false,
          })}
          <button
            type="button"
            onClick={() => handleEditLink(link)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
            title="編集"
          >
            <EditIcon />
          </button>
          <button
            type="button"
            onClick={() => handleDeleteLink(link.id)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-red-200 bg-white text-red-600 transition hover:bg-red-50"
            title="削除"
          >
            <TrashIcon />
          </button>
        </div>
      )}
    </div>
  )

  const renderLinks = () => {
    if (!selectedLinkGroupId) {
      return (
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">リンク一覧</h2>
            </div>

            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
              <div className="w-full sm:w-[320px]">
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <SearchIcon />
                  </span>
                  <input
                    value={linkSearch}
                    onChange={(event) => setLinkSearch(event.target.value)}
                    placeholder="タイトルで検索"
                    className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm outline-none transition focus:border-slate-400"
                  />
                </div>
              </div>

              {isAdmin && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setLinkEditMode((prev) => !prev)}
                    className={cn(
                      'inline-flex h-11 items-center justify-center gap-2 rounded-2xl border px-5 text-sm font-semibold transition',
                      linkEditMode
                        ? 'border-slate-900 bg-slate-900 text-white hover:bg-slate-800'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    )}
                  >
                    <EditIcon />
                    {linkEditMode ? '編集終了' : '編集'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLinkCreateOpen((prev) => !prev)
                      if (linkCreateOpen) resetLinkCreateForm()
                    }}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    {linkCreateOpen ? <CloseIcon /> : <PlusIcon />}
                    {linkCreateOpen ? '閉じる' : '追加'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {isAdmin && linkCreateOpen && renderAdminLinkCreatePanel()}

          {visibleRootGroups.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visibleRootGroups.map((group, index) => (
                <div
                  key={group.id}
                  className="group rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedLinkGroupId(group.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 text-blue-600">
                          <LinkListIcon />
                        </span>
                        <p className="truncate text-base font-semibold text-slate-900">
                          {group.name}
                        </p>
                      </div>
                    </button>

                    {isAdmin && linkEditMode && (
                      <div className="flex shrink-0 items-center gap-2">
                        {renderMoveButtons({
                          onMoveUp: () => handleMoveRootLinkGroup(group, 'up'),
                          onMoveDown: () => handleMoveRootLinkGroup(group, 'down'),
                          disableUp: index === 0,
                          disableDown: index === visibleRootGroups.length - 1,
                        })}
                        <button
                          type="button"
                          onClick={() => handleEditLinkGroup(group)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
                          title="編集"
                        >
                          <EditIcon />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteLinkGroup(group)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-red-200 bg-white text-red-600 transition hover:bg-red-50"
                          title="削除"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-[28px] border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
              該当するリンクがありません。
            </div>
          )}

          {ungroupedLinks.length > 0 && (
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-slate-900">その他</p>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {ungroupedLinks.map((link, index) =>
                  renderLinkRow(link, {
                    disableMoveUp: index === 0,
                    disableMoveDown: index === ungroupedLinks.length - 1,
                  })
                )}
              </div>
            </div>
          )}
        </div>
      )
    }

    const selectedGroup = accessibleLinkGroups.find((group) => group.id === selectedLinkGroupId)
    const selectedChildGroups = childGroupsMap.get(selectedLinkGroupId) ?? []
    const selectedOwnLinks = linksByGroupId.get(selectedLinkGroupId) ?? []

    if (!selectedGroup) {
      return (
        <div className="rounded-[28px] border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          グループが見つかりません。
        </div>
      )
    }

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <button
              type="button"
              onClick={() => setSelectedLinkGroupId(null)}
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900"
            >
              <span>←</span>
              <span>戻る</span>
            </button>
            <h2 className="mt-3 text-xl font-semibold text-slate-900">
              {selectedGroup.name}
            </h2>
          </div>

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
            <div className="w-full sm:w-[320px]">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <SearchIcon />
                </span>
                <input
                  value={linkSearch}
                  onChange={(event) => setLinkSearch(event.target.value)}
                  placeholder="タイトルで検索"
                  className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm outline-none transition focus:border-slate-400"
                />
              </div>
            </div>

            {isAdmin && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setLinkEditMode((prev) => !prev)}
                  className={cn(
                    'inline-flex h-11 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-semibold transition',
                    linkEditMode
                      ? 'border-slate-900 bg-slate-900 text-white hover:bg-slate-800'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  )}
                >
                  <EditIcon />
                  {linkEditMode ? '編集終了' : '編集'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLinkCreateOpen((prev) => !prev)
                    if (linkCreateOpen) resetLinkCreateForm()
                  }}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  {linkCreateOpen ? <CloseIcon /> : <PlusIcon />}
                  {linkCreateOpen ? '閉じる' : '追加'}
                </button>
                {linkEditMode && (
                  <>
                    {renderMoveButtons({
                      onMoveUp: () => handleMoveRootLinkGroup(selectedGroup, 'up'),
                      onMoveDown: () => handleMoveRootLinkGroup(selectedGroup, 'down'),
                      disableUp:
                        rootLinkGroups.findIndex((item) => item.id === selectedGroup.id) === 0,
                      disableDown:
                        rootLinkGroups.findIndex((item) => item.id === selectedGroup.id) ===
                        rootLinkGroups.length - 1,
                    })}
                    <button
                      type="button"
                      onClick={() => handleEditLinkGroup(selectedGroup)}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
                      title="編集"
                    >
                      <EditIcon />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteLinkGroup(selectedGroup)}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-red-200 bg-white text-red-600 transition hover:bg-red-50"
                      title="削除"
                    >
                      <TrashIcon />
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {isAdmin && linkCreateOpen && renderAdminLinkCreatePanel()}

        {selectedOwnLinks.length > 0 && (
          <div className="space-y-2">
            {selectedOwnLinks.map((link, index) =>
              renderLinkRow(link, {
                disableMoveUp: index === 0,
                disableMoveDown: index === selectedOwnLinks.length - 1,
              })
            )}
          </div>
        )}

        {selectedChildGroups.map((child, childIndex) => {
          const childLinks = linksByGroupId.get(child.id) ?? []
          if (childLinks.length === 0) return null

          return (
            <div
              key={child.id}
              className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="truncate text-base font-semibold text-slate-900">
                  {child.name}
                </p>

                {isAdmin && linkEditMode && (
                  <div className="flex shrink-0 items-center gap-2">
                    {renderMoveButtons({
                      onMoveUp: () => handleMoveChildLinkGroup(child, 'up'),
                      onMoveDown: () => handleMoveChildLinkGroup(child, 'down'),
                      disableUp: childIndex === 0,
                      disableDown: childIndex === selectedChildGroups.length - 1,
                    })}
                    <button
                      type="button"
                      onClick={() => handleEditLinkGroup(child)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
                      title="編集"
                    >
                      <EditIcon />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteLinkGroup(child)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-red-200 bg-white text-red-600 transition hover:bg-red-50"
                      title="削除"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                {childLinks.map((link, linkIndex) =>
                  renderLinkRow(link, {
                    disableMoveUp: linkIndex === 0,
                    disableMoveDown: linkIndex === childLinks.length - 1,
                  })
                )}
              </div>
            </div>
          )
        })}

        {selectedOwnLinks.length === 0 &&
          selectedChildGroups.every((child) => (linksByGroupId.get(child.id) ?? []).length === 0) && (
            <div className="rounded-[28px] border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
              該当するリンクがありません。
            </div>
          )}
      </div>
    )
  }


  const renderLinkGroupEditModal = () => {
    if (!editingLinkGroupTarget) return null

    const isChildGroup = !!editingLinkGroupTarget.parent_id

    return (
      <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/50 px-4">
        <div className="w-full max-w-lg rounded-[28px] border border-slate-200 bg-white p-5 shadow-xl sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">{isChildGroup ? '子グループを編集' : 'グループを編集'}</h3>
              <p className="mt-1 text-sm text-slate-500">必要な項目を修正して保存してください</p>
            </div>
            <button
              type="button"
              onClick={closeLinkGroupEditModal}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
              title="閉じる"
            >
              <CloseIcon />
            </button>
          </div>

          <div className="mt-6 grid gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">グループ名</label>
              <input
                value={editLinkGroupName}
                onChange={(event) => setEditLinkGroupName(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                placeholder="グループ名を入力"
              />
            </div>

            {!isChildGroup && (
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={editLinkGroupAdminOnly}
                  onChange={(event) => setEditLinkGroupAdminOnly(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <span>管理者のみ開けるグループにする</span>
              </label>
            )}

            {isChildGroup && (
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">親グループ</label>
                <select
                  value={editLinkGroupParentId}
                  onChange={(event) => setEditLinkGroupParentId(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                >
                  <option value="">選択してください</option>
                  {rootLinkGroups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={closeLinkGroupEditModal}
              className="inline-flex h-11 items-center rounded-2xl border border-slate-200 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleSaveLinkGroupEdit}
              className="inline-flex h-11 items-center rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              保存する
            </button>
          </div>
        </div>
      </div>
    )
  }

  const renderLinkEditModal = () => {
    if (!editingLinkTarget) return null

    return (
      <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/50 px-4">
        <div className="w-full max-w-lg rounded-[28px] border border-slate-200 bg-white p-5 shadow-xl sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">リンクを編集</h3>
              <p className="mt-1 text-sm text-slate-500">リンク名・URL・所属グループを変更できます</p>
            </div>
            <button
              type="button"
              onClick={closeLinkEditModal}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
              title="閉じる"
            >
              <CloseIcon />
            </button>
          </div>

          <div className="mt-6 grid gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">リンク名</label>
              <input
                value={editLinkTitle}
                onChange={(event) => setEditLinkTitle(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                placeholder="リンク名を入力"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">URL</label>
              <input
                value={editLinkUrl}
                onChange={(event) => setEditLinkUrl(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                placeholder="https://..."
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">所属グループ</label>
              <select
                value={editLinkGroupId}
                onChange={(event) => setEditLinkGroupId(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400"
              >
                <option value="">未分類</option>
                {allGroupOptions.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={closeLinkEditModal}
              className="inline-flex h-11 items-center rounded-2xl border border-slate-200 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleSaveLinkEdit}
              className="inline-flex h-11 items-center rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              保存する
            </button>
          </div>
        </div>
      </div>
    )
  }


  const renderTemplateAdminCreatePanel = () => (
    <div className="space-y-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-900">親グループ追加</p>
          <div className="mt-3 space-y-3">
            <input
              value={newTemplateParentGroupName}
              onChange={(event) => setNewTemplateParentGroupName(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400"
              placeholder="親グループ名を入力"
            />
            <button
              type="button"
              onClick={handleCreateTemplateParentGroup}
              disabled={linkSubmitting}
              className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              親グループを追加
            </button>
          </div>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-900">子グループ追加</p>
          <div className="mt-3 space-y-3">
            <select
              value={templateChildParentGroupId}
              onChange={(event) => setTemplateChildParentGroupId(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400"
            >
              <option value="">親グループを選択</option>
              {templateRootGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
            <input
              value={newTemplateChildGroupName}
              onChange={(event) => setNewTemplateChildGroupName(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400"
              placeholder="子グループ名を入力"
            />
            <button
              type="button"
              onClick={handleCreateTemplateChildGroup}
              disabled={linkSubmitting}
              className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              子グループを追加
            </button>
          </div>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-900">テンプレート追加</p>
          <div className="mt-3 space-y-3">
            <select
              value={newTemplateGroupId}
              onChange={(event) => setNewTemplateGroupId(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400"
            >
              <option value="">所属グループを選択</option>
              {allTemplateGroupOptions.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.label}
                </option>
              ))}
            </select>
            <input
              value={newTemplateTitle}
              onChange={(event) => setNewTemplateTitle(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400"
              placeholder="タイトル"
            />
            <input
              value={newTemplateSubject}
              onChange={(event) => setNewTemplateSubject(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400"
              placeholder="件名"
            />
            <textarea
              value={newTemplateBody}
              onChange={(event) => setNewTemplateBody(event.target.value)}
              rows={5}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400"
              placeholder="本文"
            />
            <button
              type="button"
              onClick={handleCreateTemplate}
              disabled={linkSubmitting}
              className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              テンプレートを追加
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  const renderTemplateCard = (item: TemplateItem, options?: { disableMoveUp?: boolean; disableMoveDown?: boolean }) => (
    <div key={item.id} className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-slate-900">{item.title}</p>
          {item.subject && <p className="mt-3 text-sm text-slate-600">件名：{item.subject}</p>}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => handleCopyTemplate(item)}
            className="inline-flex h-9 items-center rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            コピー
          </button>

          {isAdmin && templateEditMode && (
            <>
              {renderMoveButtons({
                onMoveUp: () => handleMoveTemplate(item, 'up'),
                onMoveDown: () => handleMoveTemplate(item, 'down'),
                disableUp: options?.disableMoveUp ?? false,
                disableDown: options?.disableMoveDown ?? false,
              })}
              <button
                type="button"
                onClick={() => handleEditTemplate(item)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
                title="編集"
              >
                <EditIcon />
              </button>
              <button
                type="button"
                onClick={() => handleDeleteTemplate(item.id)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-red-200 bg-white text-red-600 transition hover:bg-red-50"
                title="削除"
              >
                <TrashIcon />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-slate-50 p-4">
        <pre className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{item.body}</pre>
      </div>
    </div>
  )

  const renderTemplates = () => {
    if (!selectedTemplateGroupId) {
      return (
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">テンプレート</h2>
            </div>

            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
              <div className="w-full sm:w-[320px]">
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <SearchIcon />
                  </span>
                  <input
                    value={templateSearch}
                    onChange={(event) => setTemplateSearch(event.target.value)}
                    placeholder="タイトル・件名・本文で検索"
                    className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm outline-none transition focus:border-slate-400"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTemplateEditMode((prev) => !prev)}
                  className={cn(
                    'inline-flex h-11 items-center justify-center gap-2 rounded-2xl border px-5 text-sm font-semibold transition',
                    templateEditMode
                      ? 'border-slate-900 bg-slate-900 text-white hover:bg-slate-800'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  )}
                >
                  <EditIcon />
                  {templateEditMode ? '編集終了' : '編集'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLinkCreateOpen((prev) => !prev)
                    if (linkCreateOpen) resetTemplateCreateForm()
                  }}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  {linkCreateOpen ? <CloseIcon /> : <PlusIcon />}
                  {linkCreateOpen ? '閉じる' : '追加'}
                </button>
              </div>
            </div>
          </div>

          {linkCreateOpen && renderTemplateAdminCreatePanel()}

          {visibleTemplateRootGroups.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visibleTemplateRootGroups.map((group, index) => (
                <div key={group.id} className="group rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <button type="button" onClick={() => setSelectedTemplateGroupId(group.id)} className="min-w-0 flex-1 text-left">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 text-blue-600">
                          <HistoryIcon />
                        </span>
                        <p className="truncate text-base font-semibold text-slate-900">{group.name}</p>
                      </div>
                    </button>

                    {templateEditMode && (
                      <div className="flex shrink-0 items-center gap-2">
                        {renderMoveButtons({
                        onMoveUp: () => handleMoveTemplateRootGroup(group, 'up'),
                        onMoveDown: () => handleMoveTemplateRootGroup(group, 'down'),
                        disableUp: index === 0,
                        disableDown: index === visibleTemplateRootGroups.length - 1,
                      })}
                      <button type="button" onClick={() => handleEditTemplateGroup(group)} className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50" title="編集"><EditIcon /></button>
                        <button type="button" onClick={() => handleDeleteTemplateGroup(group)} className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-red-200 bg-white text-red-600 transition hover:bg-red-50" title="削除"><TrashIcon /></button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-[28px] border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
              該当するテンプレートがありません。
            </div>
          )}
        </div>
      )
    }

    const selectedGroup = templateGroups.find((group) => group.id === selectedTemplateGroupId)
    const selectedChildGroups = templateChildGroupsMap.get(selectedTemplateGroupId) ?? []
    const selectedOwnTemplates = templatesByGroupId.get(selectedTemplateGroupId) ?? []

    if (!selectedGroup) {
      return <div className="rounded-[28px] border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">グループが見つかりません。</div>
    }

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <button type="button" onClick={() => setSelectedTemplateGroupId(null)} className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900">
              <span>←</span>
              <span>戻る</span>
            </button>
            <h2 className="mt-3 text-xl font-semibold text-slate-900">{selectedGroup.name}</h2>
          </div>

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
            <div className="w-full sm:w-[320px]">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <SearchIcon />
                </span>
                <input
                  value={templateSearch}
                  onChange={(event) => setTemplateSearch(event.target.value)}
                  placeholder="タイトル・件名・本文で検索"
                  className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm outline-none transition focus:border-slate-400"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTemplateEditMode((prev) => !prev)}
                className={cn(
                  'inline-flex h-11 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-semibold transition',
                  templateEditMode
                    ? 'border-slate-900 bg-slate-900 text-white hover:bg-slate-800'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                )}
              >
                <EditIcon />
                {templateEditMode ? '編集終了' : '編集'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setLinkCreateOpen((prev) => !prev)
                  if (linkCreateOpen) resetTemplateCreateForm()
                }}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                {linkCreateOpen ? <CloseIcon /> : <PlusIcon />}
                {linkCreateOpen ? '閉じる' : '追加'}
              </button>
              {templateEditMode && (
                <>
                  {renderMoveButtons({
                    onMoveUp: () => handleMoveTemplateRootGroup(selectedGroup, 'up'),
                    onMoveDown: () => handleMoveTemplateRootGroup(selectedGroup, 'down'),
                    disableUp: templateRootGroups.findIndex((item) => item.id === selectedGroup.id) === 0,
                    disableDown: templateRootGroups.findIndex((item) => item.id === selectedGroup.id) === templateRootGroups.length - 1,
                  })}
                  <button type="button" onClick={() => handleEditTemplateGroup(selectedGroup)} className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50" title="編集"><EditIcon /></button>
                  <button type="button" onClick={() => handleDeleteTemplateGroup(selectedGroup)} className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-red-200 bg-white text-red-600 transition hover:bg-red-50" title="削除"><TrashIcon /></button>
                </>
              )}
            </div>
          </div>
        </div>

        {linkCreateOpen && renderTemplateAdminCreatePanel()}

        {selectedOwnTemplates.length > 0 && (
          <div className="space-y-3">
            {selectedOwnTemplates.map((item, index) => renderTemplateCard(item, { disableMoveUp: index === 0, disableMoveDown: index === selectedOwnTemplates.length - 1 }))}
          </div>
        )}

        {selectedChildGroups.map((child, childIndex) => {
          const childTemplates = templatesByGroupId.get(child.id) ?? []
          if (childTemplates.length === 0) return null

          return (
            <div key={child.id} className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="truncate text-base font-semibold text-slate-900">{child.name}</p>
                {templateEditMode && (
                  <div className="flex shrink-0 items-center gap-2">
                    {renderMoveButtons({
                      onMoveUp: () => handleMoveTemplateChildGroup(child, 'up'),
                      onMoveDown: () => handleMoveTemplateChildGroup(child, 'down'),
                      disableUp: childIndex === 0,
                      disableDown: childIndex === selectedChildGroups.length - 1,
                    })}
                    <button type="button" onClick={() => handleEditTemplateGroup(child)} className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50" title="編集"><EditIcon /></button>
                    <button type="button" onClick={() => handleDeleteTemplateGroup(child)} className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-red-200 bg-white text-red-600 transition hover:bg-red-50" title="削除"><TrashIcon /></button>
                  </div>
                )}
              </div>
              <div className="space-y-3">
                {childTemplates.map((item, index) => renderTemplateCard(item, { disableMoveUp: index === 0, disableMoveDown: index === childTemplates.length - 1 }))}
              </div>
            </div>
          )
        })}

        {selectedOwnTemplates.length === 0 && selectedChildGroups.every((child) => (templatesByGroupId.get(child.id) ?? []).length === 0) && (
          <div className="rounded-[28px] border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
            該当するテンプレートがありません。
          </div>
        )}
      </div>
    )
  }

  const renderTemplateGroupEditModal = () => {
    if (!editingTemplateGroupTarget) return null
    const isChildGroup = !!editingTemplateGroupTarget.parent_id

    return (
      <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/50 px-4">
        <div className="w-full max-w-lg rounded-[28px] border border-slate-200 bg-white p-5 shadow-xl sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">{isChildGroup ? '子グループを編集' : 'グループを編集'}</h3>
              <p className="mt-1 text-sm text-slate-500">必要な項目を修正して保存してください</p>
            </div>
            <button type="button" onClick={closeTemplateGroupEditModal} className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50" title="閉じる"><CloseIcon /></button>
          </div>

          <div className="mt-6 grid gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">グループ名</label>
              <input
                value={editTemplateGroupName}
                onChange={(event) => setEditTemplateGroupName(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                placeholder="グループ名を入力"
              />
            </div>
            {isChildGroup && (
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">親グループ</label>
                <select
                  value={editTemplateGroupParentId}
                  onChange={(event) => setEditTemplateGroupParentId(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                >
                  <option value="">選択してください</option>
                  {templateRootGroups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <button type="button" onClick={closeTemplateGroupEditModal} className="inline-flex h-11 items-center rounded-2xl border border-slate-200 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">キャンセル</button>
            <button type="button" onClick={handleSaveTemplateGroupEdit} className="inline-flex h-11 items-center rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800">保存する</button>
          </div>
        </div>
      </div>
    )
  }

  const renderTemplateEditModal = () => {
    if (!editingTemplateTarget) return null

    return (
      <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/50 px-4">
        <div className="w-full max-w-2xl rounded-[28px] border border-slate-200 bg-white p-5 shadow-xl sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">テンプレートを編集</h3>
              <p className="mt-1 text-sm text-slate-500">タイトル・件名・本文・所属グループを変更できます</p>
            </div>
            <button type="button" onClick={closeTemplateEditModal} className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50" title="閉じる"><CloseIcon /></button>
          </div>

          <div className="mt-6 grid gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">タイトル</label>
              <input value={editTemplateTitle} onChange={(event) => setEditTemplateTitle(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400" placeholder="タイトル" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">件名</label>
              <input value={editTemplateSubject} onChange={(event) => setEditTemplateSubject(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400" placeholder="件名" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">本文</label>
              <textarea value={editTemplateBody} onChange={(event) => setEditTemplateBody(event.target.value)} rows={10} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400" placeholder="本文" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">所属グループ</label>
              <select value={editTemplateGroupId} onChange={(event) => setEditTemplateGroupId(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400">
                <option value="">未分類</option>
                {allTemplateGroupOptions.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <button type="button" onClick={closeTemplateEditModal} className="inline-flex h-11 items-center rounded-2xl border border-slate-200 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">キャンセル</button>
            <button type="button" onClick={handleSaveTemplateEdit} className="inline-flex h-11 items-center rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800">保存する</button>
          </div>
        </div>
      </div>
    )
  }



  const renderSettings = () => {
    const activeUsersCount = users.filter((item) => item.is_active !== false).length
    const adminUsersCount = users.filter((item) => item.role === 'admin').length

    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">設定</h2>
            <p className="mt-1 text-sm text-slate-500">
              {isAdmin
                ? 'アカウント管理・管理設定・操作履歴を確認できます'
                : 'アカウント情報と表示設定を確認できます'}
            </p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex h-12 items-center gap-2 rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            <LogoutIcon />
            ログアウト
          </button>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <p className="text-base font-semibold text-slate-900">アカウント情報</p>
          </div>
          <div className="grid grid-cols-1 gap-0 sm:grid-cols-2 xl:grid-cols-4">
            <div className="border-b border-slate-200 px-5 py-4 xl:border-b-0 xl:border-r">
              <p className="text-xs font-medium text-slate-500">名前</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{currentUserProfile?.name || '未設定'}</p>
            </div>
            <div className="border-b border-slate-200 px-5 py-4 sm:border-l-0 xl:border-b-0 xl:border-r">
              <p className="text-xs font-medium text-slate-500">メール</p>
              <p className="mt-1 break-all text-sm font-semibold text-slate-900">{currentUserProfile?.email || user?.email || '未取得'}</p>
            </div>
            <div className="border-b border-slate-200 px-5 py-4 xl:border-b-0 xl:border-r">
              <p className="text-xs font-medium text-slate-500">権限</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{isAdmin ? '管理者' : 'パートナー'}</p>
            </div>
            <div className="px-5 py-4">
              <p className="text-xs font-medium text-slate-500">最終ログイン</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{formatDateTime(currentUserProfile?.last_login_at)}</p>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <p className="text-base font-semibold text-slate-900">表示設定</p>
          </div>
          <div className="grid grid-cols-1 gap-4 px-5 py-5 xl:grid-cols-3">
            <div className="xl:col-span-1">
              <label className="mb-2 block text-sm font-medium text-slate-700">初期表示画面</label>
              <select
                value={settingsDefaultView}
                onChange={(event) => setSettingsDefaultView(event.target.value as ViewKey)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400"
              >
                <option value="dashboard">ダッシュボード</option>
                <option value="received">受信依頼</option>
                <option value="sent">送信依頼</option>
                <option value="history">履歴</option>
                <option value="links">リンク一覧</option>
                {isAdmin && <option value="templates">テンプレート</option>}
              </select>
            </div>

            <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 xl:col-span-1">
              <div>
                <p className="text-sm font-semibold text-slate-900">スマホでグループ単位表示</p>
                <p className="mt-1 text-xs text-slate-500">リンク一覧を縦並びで見やすく表示します</p>
              </div>
              <input
                type="checkbox"
                checked={settingsMobileGroupedLayout}
                onChange={(event) => setSettingsMobileGroupedLayout(event.target.checked)}
                className="h-5 w-5 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
              />
            </label>

            {isAdmin ? (
              <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 xl:col-span-1">
                <div>
                  <p className="text-sm font-semibold text-slate-900">通知表示</p>
                  <p className="mt-1 text-xs text-slate-500">未確認・期限切れを画面内で強調表示します</p>
                </div>
                <input
                  type="checkbox"
                  checked={settingsNotificationEnabled}
                  onChange={(event) => setSettingsNotificationEnabled(event.target.checked)}
                  className="h-5 w-5 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                />
              </label>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 xl:col-span-1">
                <p className="text-sm font-semibold text-slate-900">通知設定</p>
                <p className="mt-1 text-xs text-slate-500">通知設定は管理者のみ変更できます。</p>
              </div>
            )}
          </div>
          <div className="border-t border-slate-200 px-5 py-4">
            <button
              type="button"
              onClick={handleSaveUserSettings}
              disabled={settingsSubmitting}
              className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400 sm:w-auto sm:min-w-[180px]"
            >
              {settingsSubmitting ? '保存中...' : '設定を保存する'}
            </button>
          </div>
        </div>

        {isAdmin && (
          <>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_0.8fr]">
              <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
                  <div>
                    <p className="text-base font-semibold text-slate-900">アカウント管理</p>
                    <p className="mt-1 text-sm text-slate-500">ロール変更・停止 / 再開・削除を行えます</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    {users.length}名
                  </span>
                </div>

                <div className="hidden xl:block">
                  <div className="grid grid-cols-[1.5fr_1.9fr_0.9fr_1fr_1.3fr_1.7fr] gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold text-slate-500">
                    <p>名前</p>
                    <p>メール</p>
                    <p>ロール</p>
                    <p>アカウント状態</p>
                    <p>最終ログイン</p>
                    <p>操作</p>
                  </div>

                  <div className="divide-y divide-slate-200">
                    {users.map((item) => (
                      <div key={item.id} className="grid grid-cols-[1.5fr_1.9fr_0.9fr_1fr_1.3fr_1.7fr] gap-3 px-5 py-4 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">{getUserLabel(item)}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-slate-600">{item.email || 'メール未設定'}</p>
                        </div>
                        <div>
                          <select
                            value={item.role ?? 'user'}
                            onChange={(event) => handleRoleChange(item.id, event.target.value)}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-400"
                          >
                            <option value="admin">管理者</option>
                            <option value="user">パートナー</option>
                          </select>
                        </div>
                        <div>
                          <span
                            className={cn(
                              'inline-flex rounded-full px-3 py-1 text-xs font-semibold',
                              item.is_active === false
                                ? 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200'
                                : 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200'
                            )}
                          >
                            {item.is_active === false ? '停止中' : '有効'}
                          </span>
                        </div>
                        <div>
                          <p className="text-slate-600">{formatDateTime(item.last_login_at)}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleUserActive(item.id, item.is_active === false)}
                            disabled={item.id === currentUserId}
                            className={cn(
                              'inline-flex h-11 min-w-[76px] items-center justify-center rounded-2xl px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400',
                              item.is_active === false
                                ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                                : 'bg-slate-900 text-white hover:bg-slate-800'
                            )}
                          >
                            {item.is_active === false ? '再開' : '停止'}
                          </button>

                          {item.is_active === false && item.id !== currentUserId && (
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(item)}
                              className="inline-flex h-11 min-w-[76px] items-center justify-center rounded-2xl bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-500"
                            >
                              削除
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="divide-y divide-slate-200 xl:hidden">
                  {users.map((item) => (
                    <div key={item.id} className="px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{getUserLabel(item)}</p>
                          <p className="mt-1 break-all text-xs text-slate-500">{item.email || 'メール未設定'}</p>
                        </div>
                        <span
                          className={cn(
                            'shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold',
                            item.is_active === false
                              ? 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200'
                              : 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200'
                          )}
                        >
                          {item.is_active === false ? '停止中' : '有効'}
                        </span>
                      </div>

                      <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-500">ロール</label>
                          <select
                            value={item.role ?? 'user'}
                            onChange={(event) => handleRoleChange(item.id, event.target.value)}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-slate-400"
                          >
                            <option value="admin">管理者</option>
                            <option value="user">パートナー</option>
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-500">最終ログイン</label>
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                            {formatDateTime(item.last_login_at)}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleUserActive(item.id, item.is_active === false)}
                          disabled={item.id === currentUserId}
                          className={cn(
                            'inline-flex h-11 flex-1 items-center justify-center rounded-2xl px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400',
                            item.is_active === false
                              ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                              : 'bg-slate-900 text-white hover:bg-slate-800'
                          )}
                        >
                          {item.is_active === false ? '再開' : '停止'}
                        </button>

                        {item.is_active === false && item.id !== currentUserId && (
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(item)}
                            className="inline-flex h-11 flex-1 items-center justify-center rounded-2xl bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-500"
                          >
                            削除
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-200 px-5 py-4">
                    <p className="text-base font-semibold text-slate-900">利用状況確認</p>
                  </div>
                  <div className="grid grid-cols-1 divide-y divide-slate-200">
                    <div className="px-5 py-4">
                      <p className="text-xs font-medium text-slate-500">全ユーザー数</p>
                      <p className="mt-1 text-2xl font-bold text-slate-900">{users.length}</p>
                    </div>
                    <div className="px-5 py-4">
                      <p className="text-xs font-medium text-slate-500">有効ユーザー数</p>
                      <p className="mt-1 text-2xl font-bold text-slate-900">{activeUsersCount}</p>
                    </div>
                    <div className="px-5 py-4">
                      <p className="text-xs font-medium text-slate-500">管理者数</p>
                      <p className="mt-1 text-2xl font-bold text-slate-900">{adminUsersCount}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-200 px-5 py-4">
                    <p className="text-base font-semibold text-slate-900">最終ログイン確認</p>
                  </div>
                  <div className="divide-y divide-slate-200">
                    {users.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-3 px-5 py-4">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{getUserLabel(item)}</p>
                          <p className="mt-1 text-xs text-slate-500">{item.role === 'admin' ? '管理者' : 'パートナー'}</p>
                        </div>
                        <p className="shrink-0 text-xs font-medium text-slate-600">{formatDateTime(item.last_login_at)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-5 py-4">
                <p className="text-base font-semibold text-slate-900">履歴クリーンアップ</p>
                <p className="mt-1 text-sm text-slate-500">完了後7日以上経過した依頼・ToDoを手動で削除します（自動削除の補完用）</p>
              </div>
              <div className="flex flex-wrap items-center gap-4 px-5 py-5">
                <button
                  type="button"
                  onClick={() => void handleManualCleanup()}
                  disabled={cleanupRunning}
                  className="inline-flex h-11 items-center gap-2 rounded-2xl bg-red-600 px-5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                >
                  {cleanupRunning ? '削除中...' : '古い履歴を今すぐ削除'}
                </button>
                {cleanupResult && (
                  <p className="text-sm text-slate-600">
                    完了：依頼 {cleanupResult.requests}件・ToDo {cleanupResult.todos}件 を削除しました
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-slate-900">アクティビティログ確認</p>
                    <p className="mt-1 text-sm text-slate-500">誰が・何を・いつ実行したかを確認します（最新20件）</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void fetchActivityLogs(activityLogFetchLimit)}
                    className="inline-flex h-11 items-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    更新
                  </button>
                </div>

                <div className="grid gap-3 lg:grid-cols-4">
                  <div>
                    <label className="mb-2 block text-xs font-semibold text-slate-500">実行者</label>
                    <select
                      value={activityLogUserFilter}
                      onChange={(event) => setActivityLogUserFilter(event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                    >
                      <option value="all">すべて</option>
                      {activityLogUserOptions.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold text-slate-500">操作種別</label>
                    <select
                      value={activityLogActionFilter}
                      onChange={(event) => setActivityLogActionFilter(event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                    >
                      <option value="all">すべて</option>
                      {activityLogActionOptions.map((action) => (
                        <option key={action} value={action}>
                          {getActivityActionLabel(action)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold text-slate-500">開始日</label>
                    <input
                      type="date"
                      value={activityLogDateFrom}
                      onChange={(event) => setActivityLogDateFrom(event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold text-slate-500">終了日</label>
                    <input
                      type="date"
                      value={activityLogDateTo}
                      onChange={(event) => setActivityLogDateTo(event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                    />
                  </div>
                </div>
              </div>

              {filteredActivityLogs.length > 0 ? (
                <>
                  <div className="overflow-x-auto">
                    <div className="min-w-[880px]">
                    <div className="grid grid-cols-[180px_170px_170px_120px_minmax(220px,1fr)] gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold text-slate-500">
                      <p>実行日時</p>
                      <p>実行者</p>
                      <p>操作種別</p>
                      <p>対象</p>
                      <p>詳細</p>
                    </div>

                    <div className="max-h-[520px] overflow-y-auto divide-y divide-slate-200">
                      {filteredActivityLogs.map((log) => (
                        <div
                          key={log.id}
                          className="grid grid-cols-[180px_170px_170px_120px_minmax(220px,1fr)] gap-3 px-5 py-4 text-sm text-slate-700"
                        >
                          <p className="text-xs text-slate-500">{formatDateTime(log.created_at)}</p>
                          <p className="font-semibold text-slate-900">{log.user_name || '不明ユーザー'}</p>
                          <div>
                            <span
                              className={cn(
                                'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold',
                                getActivityActionBadgeClass(log.action)
                              )}
                            >
                              {getActivityActionLabel(log.action)}
                            </span>
                          </div>
                          <p>{getActivityTargetTypeLabel(log.target_type)}</p>
                          <p className="break-words text-xs text-slate-500">{log.detail || '-'}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {filteredActivityLogs.length >= activityLogFetchLimit ? (
                  <div className="border-t border-slate-200 px-5 py-4">
                    <button
                      type="button"
                      onClick={() => void fetchActivityLogs(activityLogFetchLimit + 20)}
                      className="inline-flex h-11 items-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      さらに読み込む
                    </button>
                  </div>
                ) : null}
                </>
              ) : (
                <div className="px-5 py-8 text-center text-sm text-slate-500">
                  条件に一致するログがありません。
                </div>
              )}
            </div>
          </>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(96,165,250,0.18),_transparent_24%),linear-gradient(135deg,_#edf5ff_0%,_#f8fbff_42%,_#fffaf5_100%)] px-4">
        <div className="rounded-[32px] border border-white/60 bg-white/70 px-6 py-5 text-sm font-medium text-slate-600 shadow-[0_24px_60px_rgba(15,23,42,0.12)] backdrop-blur-xl">
          読み込み中...
        </div>
      </main>
    )
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(96,165,250,0.18),_transparent_24%),linear-gradient(135deg,_#edf5ff_0%,_#f8fbff_42%,_#fffaf5_100%)] px-4">
        <div className="w-full max-w-md rounded-[36px] border border-white/60 bg-white/70 p-8 shadow-[0_24px_60px_rgba(15,23,42,0.12)] backdrop-blur-xl">
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
            className="mt-8 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(90deg,#53b8ff_0%,#7c6cff_100%)] px-5 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(99,102,241,0.25)] transition hover:opacity-95"
          >
            <LoginIcon />
            Googleでログイン
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.10),_transparent_30%),linear-gradient(to_bottom,_#f8fafc,_#eef2f7)] text-slate-900">
      <div className="min-h-screen">
        <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:block">
          <Sidebar />
        </div>

        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(false)}
              className="absolute inset-0 bg-slate-950/40"
            />
            <div className="absolute left-0 top-0 h-dvh max-w-full overflow-hidden">
              <Sidebar mobile />
            </div>
          </div>
        )}

        <div
          className={cn(
            'flex min-h-screen min-w-0 flex-col overflow-x-hidden',
            desktopSidebarCollapsed ? 'lg:pl-[88px]' : 'lg:pl-72'
          )}
        >
          <header className="sticky top-0 z-20 border-b border-white/50 bg-white/55 backdrop-blur-xl">
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
                    WORK-HUB
                  </p>
                  <h1 className="text-2xl font-bold leading-tight text-slate-900">
                    業務管理アプリ
                  </h1>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative hidden sm:block">
                  <button
                    type="button"
                    onClick={() => isAdmin && setMemberMenuOpen((prev) => !prev)}
                    className={cn(
                      'inline-flex min-w-[140px] items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm',
                      isAdmin ? 'cursor-pointer hover:bg-slate-50' : 'cursor-default'
                    )}
                  >
                    <span className="truncate">
                      {effectiveUserProfile?.name?.trim() || user.email}
                    </span>
                    {isAdmin && <ChevronDownIcon />}
                  </button>

                  {isAdmin && memberMenuOpen && (
                    <div className="absolute right-0 top-[calc(100%+8px)] z-30 w-56 rounded-[24px] border border-slate-200 bg-white p-2 shadow-[0_18px_45px_rgba(15,23,42,0.18)]">
                      <button
                        type="button"
                        onClick={() => handleSelectMember(null)}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-medium transition',
                          !selectedMemberId
                            ? 'bg-slate-100 text-slate-900'
                            : 'text-slate-700 hover:bg-slate-50'
                        )}
                      >
                        <span className="inline-flex w-5 justify-center">
                          {!selectedMemberId ? '✓' : ''}
                        </span>
                        <span className="truncate">{getUserLabel(currentUserProfile)}</span>
                      </button>

                      {switchableMembers
                        .filter((item) => item.id !== currentUserId)
                        .map((item) => {
                          const active = selectedMemberId === item.id
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => handleSelectMember(item.id)}
                              className={cn(
                                'flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-medium transition',
                                active
                                  ? 'bg-slate-100 text-slate-900'
                                  : 'text-slate-700 hover:bg-slate-50'
                              )}
                            >
                              <span className="inline-flex w-5 justify-center">
                                {active ? '✓' : ''}
                              </span>
                              <span className="truncate">{getUserLabel(item)}</span>
                            </button>
                          )
                        })}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex h-11 items-center gap-2 rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  <LogoutIcon />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            </div>
          </header>

          <div className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl space-y-5">
              {isProxyMode && (
                <div className="flex items-center justify-between rounded-[24px] border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                  <p>
                    <span className="font-semibold">
                      {getUserLabel(effectiveUserProfile)}
                    </span>
                    の画面を表示中です。
                  </p>
                  <button
                    type="button"
                    onClick={() => handleSelectMember(null)}
                    className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-200 transition hover:bg-blue-100"
                  >
                    自分に戻る
                  </button>
                </div>
              )}

              {createFormOpen && renderCreateForm()}
              {todoFormOpen && renderTodoForm()}

              {!createFormOpen && !todoFormOpen && activeView === 'dashboard' && renderDashboard()}
              {!createFormOpen && !todoFormOpen && activeView === 'received' && renderReceived()}
              {!createFormOpen && !todoFormOpen && activeView === 'sent' && renderSent()}
              {!createFormOpen && !todoFormOpen && activeView === 'history' && renderHistory()}
              {!createFormOpen && !todoFormOpen && activeView === 'todo' && renderTodo()}
              {!createFormOpen && !todoFormOpen && activeView === 'todo_history' && renderTodoHistory()}
              {!createFormOpen && !todoFormOpen && activeView === 'links' && renderLinks()}
              {!createFormOpen && !todoFormOpen && activeView === 'templates' && renderTemplates()}
              {!createFormOpen && !todoFormOpen && activeView === 'settings' && renderSettings()}
            </div>
          </div>
        </div>
      </div>

      {renderLinkGroupEditModal()}
      {renderLinkEditModal()}
      {renderTemplateGroupEditModal()}
      {renderTemplateEditModal()}

      {todoDetailTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 px-4 py-6">
          <button
            type="button"
            onClick={() => setTodoDetailTarget(null)}
            className="absolute inset-0"
          />
          <div className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[32px] border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-400">
                  Todo Detail
                </p>
                <h2 className="mt-2 text-xl font-semibold text-slate-900">
                  {todoDetailTarget.title}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setTodoDetailTarget(null)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
              >
                <CloseIcon />
              </button>
            </div>

            <div className="mt-5 grid gap-5">
              <div className="grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                    作成者
                  </p>
                  <p className="mt-1">
                    {getUserLabel(userMap.get(todoDetailTarget.created_by))}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                    担当
                  </p>
                  <p className="mt-1">
                    {getUserLabel(
                      todoDetailTarget.assigned_to
                        ? userMap.get(todoDetailTarget.assigned_to)
                        : undefined
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                    ステータス
                  </p>
                  <p className="mt-1">{todoDetailTarget.status ?? STATUS.TODO.NOT_STARTED}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                    優先度
                  </p>
                  <p className="mt-1">{todoDetailTarget.priority ?? PRIORITY.MEDIUM}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                    期限
                  </p>
                  <p className="mt-1">{formatDate(todoDetailTarget.deadline)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                    作成日
                  </p>
                  <p className="mt-1">
                    {formatDateTime(todoDetailTarget.created_at)}
                  </p>
                </div>
                {(todoDetailTarget.status ?? STATUS.TODO.NOT_STARTED) === STATUS.TODO.DONE && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                      完了日
                    </p>
                    <p className="mt-1">
                      {formatDateTime(todoDetailTarget.completed_at)}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-800">内容</p>
                <div className="mt-2 rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                    {todoDetailTarget.content || '内容なし'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {detailTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 px-4 py-6">
          <button
            type="button"
            onClick={() => setDetailTarget(null)}
            className="absolute inset-0"
          />
          <div className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[32px] border border-slate-200 bg-white p-6 shadow-xl">
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
                  <p className="mt-1">{getStatusLabel(detailTarget.status)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                    優先度
                  </p>
                  <p className="mt-1">{detailTarget.priority ?? PRIORITY.MEDIUM}</p>
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
                  <p className="mt-1">
                    {formatDateTime(detailTarget.created_at)}
                  </p>
                </div>
                {(detailTarget.status ?? STATUS.REQUEST.NEW) === STATUS.REQUEST.DONE && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                      完了日
                    </p>
                    <p className="mt-1">
                      {formatDateTime(detailTarget.completed_at)}
                    </p>
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