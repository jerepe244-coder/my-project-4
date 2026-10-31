import { NextResponse } from 'next/server';
import { N8nClient } from '@/lib/n8n-client';
import { DataService } from '@/lib/data-service';

export async function GET() {
  try {
    const audits = await N8nClient.getAudits();
    const enrichedAudits = audits.map((a) => ({
      ...a,
      categorizedFindings: DataService.categorizeAuditFindings(a),
    }));

    return NextResponse.json({
      data: enrichedAudits,
      count: enrichedAudits.length,
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
