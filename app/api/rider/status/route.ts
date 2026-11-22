 import { NextResponse } from 'next/server';

let riderStatus = { isOnline: false, lastSeen: new Date().toISOString() };

export async function GET() {
  try {
    return NextResponse.json(riderStatus);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to get status' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { isOnline } = await request.json();
    riderStatus = { isOnline, lastSeen: new Date().toISOString() };
    return NextResponse.json({ success: true, ...riderStatus });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
  }
}