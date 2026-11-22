import { NextResponse } from 'next/server';

let orders: any[] = [
  { id: 'ORD001', pickup: 'Office', dropoff: 'Station', fare: 18, status: 'Pending', riderId: 'R001' },
];

// GET orders — filtered by riderId or customerId
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const riderId = searchParams.get('riderId');
  const customerId = searchParams.get('customerId');
  
  let result = [...orders];
  if (riderId) result = result.filter(o => o.riderId === riderId);
  if (customerId) result = result.filter(o => o.customerId === customerId);
  
  return NextResponse.json({ orders: result });
}

// CREATE new order
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const newOrder = {
      id: `ORD${String(orders.length + 1).padStart(3, '0')}`,
      status: 'Pending',
      riderId: 'R001',
      createdAt: new Date().toISOString(),
      fare: body.fare || 10,
      ...body,
    };
    
    orders.unshift(newOrder);
    return NextResponse.json({ success: true, order: newOrder }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

// UPDATE order status — ✅ FIXED: no invalid URL syntax
export async function PATCH(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('id');
    const { status } = await request.json();
    
    // ✅ Correct comparison — NO http://o.id/
    const order = orders.find(o => o.id === orderId);
    
    if (order) {
      order.status = status;
      return NextResponse.json({ success: true, order });
    }
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (err) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}