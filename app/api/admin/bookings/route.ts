'use server'


import { NextResponse } from 'next/server'


// In-memory temporary store — will be replaced with Supabase later
let bookings: any[] = []


// GET — fetch all bookings
export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      bookings
    })
  } catch (err) {
    console.error('Error fetching bookings:', err)
    return NextResponse.json(
      { success: false, error: 'Failed to load bookings' },
      { status: 500 }
    )
  }
}


// PATCH — update booking status / assign rider
export async function PATCH(request: Request) {
  try {
    const { id, ...updates } = await request.json()


    const index = bookings.findIndex(b => b.id === id)
    if (index === -1) {
      return NextResponse.json(
        { success: false, error: 'Booking not found' },
        { status: 404 }
      )
    }


    bookings[index] = { ...bookings[index], ...updates }


    return NextResponse.json({
      success: true,
      message: 'Booking updated',
      booking: bookings[index]
    })
  } catch (err) {
    console.error('Error updating booking:', err)
    return NextResponse.json(
      { success: false, error: 'Failed to update booking' },
      { status: 500 }
    )
  }
}


// DELETE — remove/cancel booking
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')


    const initialLength = bookings.length
    bookings = bookings.filter(b => b.id !== id)


    if (bookings.length === initialLength) {
      return NextResponse.json(
        { success: false, error: 'Booking not found' },
        { status: 404 }
      )
    }


    return NextResponse.json({
      success: true,
      message: 'Booking cancelled'
    })
  } catch (err) {
    console.error('Error deleting booking:', err)
    return NextResponse.json(
      { success: false, error: 'Failed to cancel booking' },
      { status: 500 }
    )
  }
}
