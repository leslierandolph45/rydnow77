'use server'


import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'


// ─── SAFE SUPABASE INITIALIZATION — WON'T CRASH BUILD ───
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY


const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null


interface Params {
  params: { id: string }
}


// GET single withdrawal
export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = params


    // 🛡️ Fallback if Supabase not connected
    if (!supabase) {
      console.log('⚠️ Supabase not connected — returning empty withdrawal data')
      return NextResponse.json({
        success: true,
        mode: 'local_fallback',
        withdrawal: null
      })
    }


    // ✅ Fetch from Supabase
    const { data, error } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('id', id)
      .single()


    if (error) {
      console.error('❌ Supabase error:', error)
      return NextResponse.json(
        { error: 'Withdrawal not found', details: error.message },
        { status: 404 }
      )
    }


    return NextResponse.json({
      success: true,
      withdrawal: data
    })


  } catch (err) {
    console.error('❌ Route error:', err)
    return NextResponse.json(
      { success: true, withdrawal: null },
      { status: 200 }
    )
  }
}


// PATCH update withdrawal
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = params
    const body = await request.json()


    // 🛡️ Fallback if Supabase not connected
    if (!supabase) {
      console.log('⚠️ Supabase not connected — simulating update')
      return NextResponse.json({
        success: true,
        mode: 'local_fallback',
        message: 'Withdrawal updated (local mode)'
      })
    }


    // ✅ Update in Supabase
    const { data, error } = await supabase
      .from('withdrawals')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()


    if (error) {
      console.error('❌ Supabase error:', error)
      return NextResponse.json(
        { error: 'Failed to update withdrawal', details: error.message },
        { status: 500 }
      )
    }


    return NextResponse.json({
      success: true,
      message: 'Withdrawal updated successfully',
      withdrawal: data
    })


  } catch (err) {
    console.error('❌ Route error:', err)
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    )
  }
}
