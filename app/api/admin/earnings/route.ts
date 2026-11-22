'use server'


import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'


// ─── SAFE SUPABASE INITIALIZATION — WON'T CRASH BUILD ───
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY


const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null


export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'all'


    // 🛡️ Fallback if Supabase not connected
    if (!supabase) {
      console.log('⚠️ Supabase not connected — returning default earnings data')
      return NextResponse.json({
        success: true,
        mode: 'local_fallback',
        message: 'Using local data — Supabase not configured',
        totalEarnings: 0,
        totalBookings: 0,
        completedBookings: 0,
        pendingPayouts: 0,
        period,
        recentTransactions: []
      })
    }


    // ✅ Fetch earnings stats from Supabase
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('fare, status, created_at')
      .gte('created_at', getDateFilter(period))
      .order('created_at', { ascending: false })


    if (error) {
      console.error('❌ Supabase error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch earnings', details: error.message },
        { status: 500 }
      )
    }


    const completed = bookings?.filter(b => b.status === 'completed') || []
    const totalEarnings = completed.reduce((sum, b) => sum + (b.fare || 0), 0)


    return NextResponse.json({
      success: true,
      totalEarnings,
      totalBookings: bookings?.length || 0,
      completedBookings: completed.length,
      pendingPayouts: 0,
      period,
      recentTransactions: completed.slice(0, 10).map(b => ({
        id: b.id,
        amount: b.fare,
        date: b.created_at,
        status: 'completed'
      }))
    })


  } catch (err) {
    console.error('❌ Route error:', err)
    return NextResponse.json(
      { 
        success: true,
        totalEarnings: 0,
        totalBookings: 0,
        completedBookings: 0,
        pendingPayouts: 0,
        recentTransactions: []
      },
      { status: 200 }
    )
  }
}


// Helper function for date filtering
function getDateFilter(period: string): string {
  const now = new Date()
  switch (period) {
    case 'today':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    case 'week':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    case 'month':
      return new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    default:
      return '1970-01-01T00:00:00.000Z'
  }
}
