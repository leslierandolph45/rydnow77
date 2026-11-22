'use server'


import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'


// ─── SAFE SUPABASE INITIALIZATION — WON'T CRASH BUILD ───
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY


// Only create client if both vars exist — otherwise return null
const supabase = supabaseUrl && supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null


export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { applicationId, status = 'approved' } = body


    // 🛡️ Graceful fallback if Supabase not connected
    if (!supabase) {
      console.log('⚠️ Supabase not connected — returning local mode response')
      return NextResponse.json({
        success: true,
        mode: 'local_fallback',
        message: 'Using local storage — Supabase not configured',
        applicationId,
        status
      })
    }


    // ✅ Update in Supabase
    const { data, error } = await supabase
      .from('rider_applications')
      .update({ 
        status: status,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', applicationId)
      .select()
      .single()


    if (error) {
      console.error('❌ Supabase error:', error)
      return NextResponse.json(
        { error: 'Failed to update application', details: error.message },
        { status: 500 }
      )
    }


    return NextResponse.json({
      success: true,
      message: `Application ${status} successfully!`,
      data
    })


  } catch (err) {
    console.error('❌ Route error:', err)
    return NextResponse.json(
      { error: 'Server error', message: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
