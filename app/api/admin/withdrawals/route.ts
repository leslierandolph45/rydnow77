'use server'


import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'


// ─── SAFE SUPABASE INITIALIZATION — WON'T CRASH BUILD ───
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY


const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null


export async function GET() {
  try {
    // 🛡️ Fallback if Supabase not connected
    if (!supabase) {
      console.log('⚠️ Supabase not connected — returning empty withdrawals list')
      return NextResponse.json({
        success: true,
        mode: 'local_fallback',
        withdrawals: []
      })
    }


    // ✅ Fetch from Supabase
    const { data, error } = await supabase
      .from('withdrawals')
      .select('*')
      .order('created_at', { ascending: false })


    if (error) {
      console.error('❌ Supabase error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch withdrawals', withdrawals: [] },
        { status: 500 }
      )
    }


    return NextResponse.json({
      success: true,
      withdrawals: data || []
    })


  } catch (err) {
    console.error('❌ Route error:', err)
    return NextResponse.json(
      { success: true, withdrawals: [] },
      { status: 200 }
    )
  }
}
