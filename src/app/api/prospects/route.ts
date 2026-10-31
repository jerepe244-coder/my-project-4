import { NextResponse } from 'next/server';
import { DataService } from '@/lib/data-service';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      const prospect = await DataService.getProspectById(id);
      if (!prospect) {
        return NextResponse.json({ error: 'Prospect not found' }, { status: 404 });
      }
      return NextResponse.json({ data: prospect });
    }

    const prospects = await DataService.getEnrichedProspects();
    return NextResponse.json({
      data: prospects,
      count: prospects.length,
      mode: process.env.RUN_SYNTHETIC_TEST !== 'false' ? 'SYNTHETIC' : 'PRODUCTION',
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST() {
  return NextResponse.json(
    {
      error: 'Method Not Allowed',
      message: 'Write operations are strictly prohibited in audit mode for ZYRVAE Dashboard v1.0',
    },
    { status: 405 }
  );
}
