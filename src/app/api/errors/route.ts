import { NextResponse } from 'next/server';
import { N8nClient } from '@/lib/n8n-client';

export async function GET() {
  try {
    const errorLogs = await N8nClient.getErrorLogs();
    return NextResponse.json({
      data: errorLogs,
      count: errorLogs.length,
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
