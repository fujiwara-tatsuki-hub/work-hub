export type SortableRequestItem = {
  status: string | null | undefined
  deadline: string | null | undefined
  created_at: string
}

export type SortableTodoItem = {
  status: string | null | undefined
  deadline: string | null | undefined
  created_at: string
}

function isOverdue(deadline: string | null | undefined) {
  if (!deadline) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(deadline)
  due.setHours(0, 0, 0, 0)
  return due < today
}

export function sortActiveRequests<T extends SortableRequestItem>(requests: T[]) {
  const rank = (request: T) => {
    const status = request.status ?? '未確認'
    if (status === '未確認' && isOverdue(request.deadline)) return 0
    if (status === '未確認') return 1
    if (status === '対応中') return 2
    return 3
  }

  return [...requests].sort((a, b) => {
    const rankDiff = rank(a) - rank(b)
    if (rankDiff !== 0) return rankDiff

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

export function sortActiveTodos<T extends SortableTodoItem>(todos: T[]) {
  const rank = (todo: T) => {
    const status = todo.status ?? '未着手'
    if (status === '未着手' && isOverdue(todo.deadline)) return 0
    if (status === '未着手') return 1
    if (status === '進行中') return 2
    return 3
  }

  return [...todos].sort((a, b) => {
    const rankDiff = rank(a) - rank(b)
    if (rankDiff !== 0) return rankDiff

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
