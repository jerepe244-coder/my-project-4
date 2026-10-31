import { NextResponse } from 'next/server';
import { DataService } from '@/lib/data-service';

export async function GET() {
  try {
    const metrics = await DataService.getOverviewMetrics();
    return NextResponse.json({ data: metrics });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
