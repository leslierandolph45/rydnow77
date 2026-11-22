import { NextResponse } from 'next/server';

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { bookingId, status, riderId } = body;
    
    if (!bookingId || !status) {
      return NextResponse.json({ error: 'Booking ID and status required' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `✅ Booking ${bookingId} → updated to: ${status}`,
      bookingId,
      newStatus: status,
      assignedRider: riderId || null
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: '✅ API is working! Use PUT to update booking status',
    example: { bookingId: 'ORD001', status: 'Accepted', riderId: 'R001' }
  });
}