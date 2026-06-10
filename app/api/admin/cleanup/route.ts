import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !anonKey) {
      return NextResponse.json({ ok: false, error: 'Missing env' }, { status: 500 })
    }

    // リクエストヘッダーからJWTを取得
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }
    const token = authHeader.replace('Bearer ', '')

    // ユーザーのJWTでクライアントを作成
    const supabase = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    })

    // JWTを検証してユーザーIDを取得
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    // adminロールか確認
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
    }

    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

    // requests 削除（完了後7日）
    const { data: rData, error: rError } = await supabase
      .from('requests')
      .delete()
      .eq('status', '完了')
      .or(`completed_at.lte.${sevenDaysAgo},completed_at.is.null`)
      .select('id')

    if (rError) {
      return NextResponse.json({ ok: false, error: rError.message })
    }

    // todos 削除（完了後7日）
    const { data: tData, error: tError } = await supabase
      .from('todos')
      .delete()
      .eq('is_completed', true)
      .or(`completed_at.lte.${sevenDaysAgo},completed_at.is.null`)
      .select('id')

    if (tError) {
      return NextResponse.json({ ok: false, error: tError.message })
    }

    // activity_logs 削除（30日）
    const { data: lData, error: lError } = await supabase
      .from('activity_logs')
      .delete()
      .lte('created_at', thirtyDaysAgo)
      .select('id')

    if (lError) {
      return NextResponse.json({ ok: false, error: lError.message })
    }

    return NextResponse.json({
      ok: true,
      deleted: {
        requests: rData?.length ?? 0,
        todos: tData?.length ?? 0,
        logs: lData?.length ?? 0,
      },
    })
  } catch {
    return NextResponse.json({ ok: false, error: 'Unexpected error' })
  }
}
