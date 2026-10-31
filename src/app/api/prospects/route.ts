import { NextResponse } from 'next/server';
import { DataService } from '@/lib/data-service';
import { N8nClient } from '@/lib/n8n-client';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      const prospect = await DataService.getProspectById(id);
      if (!prospect) {
        return NextResponse.json({ error: 'Prospect not found' }, { status: 404 });
      }
      return NextResponse.json({ data: prospect, mode: N8nClient.getMode() });
    }

    const prospects = await DataService.getEnrichedProspects();
    return NextResponse.json({
      data: prospects,
      count: prospects.length,
      mode: N8nClient.getMode(),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: msg, mode: N8nClient.getMode() }, { status: 500 });
  }
}

const METHOD_NOT_ALLOWED_RESPONSE = {
  error: 'Method Not Allowed',
  message: 'Write operations are strictly prohibited: ZYRVAE Dashboard operates exclusively in LIVE READ-ONLY or DEMO mode.',
};

export async function POST() {
  return NextResponse.json(METHOD_NOT_ALLOWED_RESPONSE, { status: 405 });
}

export async function PUT() {
  return NextResponse.json(METHOD_NOT_ALLOWED_RESPONSE, { status: 405 });
}

export async function PATCH() {
  return NextResponse.json(METHOD_NOT_ALLOWED_RESPONSE, { status: 405 });
}

export async function DELETE() {
  return NextResponse.json(METHOD_NOT_ALLOWED_RESPONSE, { status: 405 });
}
