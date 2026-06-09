import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

function unauthorized() {
  return NextResponse.json(
    { ok: false, error: 'Unauthorized' },
    { status: 401 }
  )
}

export async function GET(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET
    const authHeader = request.headers.get('authorization')

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return unauthorized()
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { ok: false, error: 'Missing env' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    })

    const now = new Date()

    const sevenDaysAgo = new Date(
      now.getTime() - 7 * 24 * 60 * 60 * 1000
    ).toISOString()

    const thirtyDaysAgo = new Date(
      now.getTime() - 30 * 24 * 60 * 60 * 1000
    ).toISOString()

    // requests 削除（完了後7日、またはcompleted_atが未設定の完了済み）
    const { data: rData, error: rError } = await supabase
      .from('requests')
      .delete()
      .eq('status', '完了')
      .or(`completed_at.lte.${sevenDaysAgo},completed_at.is.null`)
      .select('id')

    if (rError) {
      return NextResponse.json({ ok: false, error: rError.message })
    }

    // todos 削除（完了後7日、またはcompleted_atが未設定の完了済み）
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
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'Unexpected error' })
  }
}