import { NextResponse } from 'next/server';

// Mock database — replace with real DB later
const mockOrders = [
  { id: 'ORD001', status: 'Delivered', pickup: 'Home', dropoff: 'Market', date: '2026-10-07', fare: 25 },
  { id: 'ORD002', status: 'On the way', pickup: 'Office', dropoff: 'Station', date: '2026-10-08', fare: 18 },
];

export async function GET() {
  try {
    return NextResponse.json({ orders: mockOrders });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}