import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const idPhoto = formData.get('idPhoto');
    const selfie = formData.get('selfie');
    
    if (!idPhoto || !selfie) {
      return NextResponse.json({ error: 'ID photo and selfie required' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Documents submitted successfully. Pending review.',
      status: 'pending'
    });
  } catch (error) {
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ message: 'Use POST to submit verification documents' });
}