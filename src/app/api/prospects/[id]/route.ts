import { NextResponse } from 'next/server';
import { DataService } from '@/lib/data-service';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    const prospect = await DataService.getProspectById(id);

    if (!prospect) {
      return NextResponse.json({ error: 'Prospect not found' }, { status: 404 });
    }

    return NextResponse.json({ data: prospect });
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

export async function PUT() {
  return NextResponse.json(
    { error: 'Method Not Allowed', message: 'Modifications are disabled' },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Method Not Allowed', message: 'Deletions are disabled' },
    { status: 405 }
  );
}
