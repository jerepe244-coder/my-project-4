import { NextResponse } from 'next/server';
import { N8nClient } from '@/lib/n8n-client';

export async function GET() {
  try {
    const status = await N8nClient.getSystemStatus();
    return NextResponse.json({ data: status });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
