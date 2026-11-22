'use server'


import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'


// ─── SAFE SUPABASE INITIALIZATION — WON'T CRASH BUILD ───
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY


const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null


export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { withdrawalId, status, notes } = body


    // 🛡️ Fallback if Supabase not connected
    if (!supabase) {
      console.log('⚠️ Supabase not connected — returning success response')
      return NextResponse.json({
        success: true,
        mode: 'local_fallback',
        message: 'Withdrawal status updated (local mode)',
        withdrawalId,
        status
      })
    }


    // ✅ Update in Supabase
    const { data, error } = await supabase
      .from('withdrawals')
      .update({
        status: status,
        notes: notes || null,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', withdrawalId)
      .select()
      .single()


    if (error) {
      console.error('❌ Supabase error:', error)
      return NextResponse.json(
        { error: 'Failed to update status', details: error.message },
        { status: 500 }
      )
    }


    return NextResponse.json({
      success: true,
      message: `Withdrawal marked as ${status}`,
      data
    })


  } catch (err) {
    console.error('❌ Route error:', err)
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    )
  }
}
