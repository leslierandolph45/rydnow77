import { NextResponse } from 'next/server';

// SHARED list — ALL bookings go here
let allOrders: any[] = [
  { id: 'ORD002', pickup: 'Office', dropoff: 'Station', fare: 18, status: 'Pending', riderId: 'R001' },
  { id: 'ORD003', pickup: 'Shop', dropoff: 'Home', fare: 12, status: 'Pending', riderId: 'R001' },
];

// GET orders for a specific rider
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const riderId = searchParams.get('riderId');
    
    if (!riderId) {
      return NextResponse.json({ error: 'Rider ID required' }, { status: 400 });
    }
    
    const myOrders = allOrders.filter(o => o.riderId === riderId);
    return NextResponse.json({ orders: myOrders });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load orders' }, { status: 500 });
  }
}

// ADD new order to the shared list
export async function POST(request: Request) {
  try {
    const order = await request.json();
    allOrders.unshift(order); // Add to TOP of list
    console.log('✅ New order added:', order.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save order' }, { status: 500 });
  }
}