import { NextResponse } from 'next/server';
import { N8nClient } from '@/lib/n8n-client';

export async function GET() {
  try {
    const qualifications = await N8nClient.getQualifications();
    return NextResponse.json({
      data: qualifications,
      count: qualifications.length,
      mode: process.env.RUN_SYNTHETIC_TEST !== 'false' ? 'SYNTHETIC' : 'PRODUCTION',
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST() {
  return NextResponse.json(
    { error: 'Method Not Allowed', message: 'Write actions are disabled' },
    { status: 405 }
  );
}
