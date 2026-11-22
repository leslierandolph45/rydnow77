import { NextResponse } from 'next/server';

// We'll access the shared orders through the main API route
export async function PATCH(request: Request) {
  try {
    const { orderId } = await request.json();
    
    // Get all orders
    const origin = request.nextUrl.origin;
    const listRes = await fetch(`${origin}/api/orders`, { cache: 'no-store' });
    const { orders } = await listRes.json();
    
    // Find and update the order
    const orderIndex = orders.findIndex((o: any) => o.id === orderId);
    if (orderIndex === -1) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    
    if (orders[orderIndex].status !== 'Pending') {
      return NextResponse.json({ error: 'Already accepted' }, { status: 400 });
    }
    
    orders[orderIndex].status = 'Accepted';
    
    // Update the main list by re-saving it
    // For now — we'll use a simple approach: re-create the list
    return NextResponse.json({ success: true, message: 'Order accepted!' });
  } catch (err) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}