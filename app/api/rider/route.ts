'use server'


import { NextResponse } from 'next/server'


// In-memory store — we'll replace with Supabase later
let riders: any[] = []


// GET — list all riders
export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      riders
    })
  } catch (err) {
    console.error('Error fetching riders:', err)
    return NextResponse.json(
      { success: false, error: 'Failed to load riders' },
      { status: 500 }
    )
  }
}


// POST — register new rider
export async function POST(request: Request) {
  try {
    const data = await request.json()
    const newRider = {
      id: `rider-${Date.now()}`,
      ...data,
      status: 'pending',
      created_at: new Date().toISOString()
    }
    riders.push(newRider)
    
    return NextResponse.json({
      success: true,
      message: 'Rider registered successfully',
      rider: newRider
    })
  } catch (err) {
    console.error('Error registering rider:', err)
    return NextResponse.json(
      { success: false, error: 'Failed to register rider' },
      { status: 500 }
    )
  }
}
