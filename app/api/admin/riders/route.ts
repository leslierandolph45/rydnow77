'use server'


import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'


// ─── SAFE SUPABASE INITIALIZATION — WON'T CRASH BUILD ───
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY


const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null


export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'all'


    // 🛡️ Fallback if Supabase not connected
    if (!supabase) {
      console.log('⚠️ Supabase not connected — returning empty riders list')
      return NextResponse.json({
        success: true,
        mode: 'local_fallback',
        message: 'Using local data — Supabase not configured',
        riders: []
      })
    }


    // ✅ Fetch riders from Supabase
    let query = supabase.from('riders').select('*')


    if (status !== 'all') {
      query = query.eq('status', status)
    }


    const { data, error } = await query.order('created_at', { ascending: false })


    if (error) {
      console.error('❌ Supabase error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch riders', details: error.message, riders: [] },
        { status: 500 }
      )
    }


    return NextResponse.json({
      success: true,
      riders: data || []
    })


  } catch (err) {
    console.error('❌ Route error:', err)
    return NextResponse.json(
      { success: true, riders: [] },
      { status: 200 }
    )
  }
}
