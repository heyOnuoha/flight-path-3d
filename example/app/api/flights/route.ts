import { NextResponse } from 'next/server';
import { fetchLiveFlights } from '@/lib/api/aviationstack';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const flights = await fetchLiveFlights(5);
    return NextResponse.json(flights);
  } catch (error) {
    console.error('Error in flights API route:', error);
    return NextResponse.json({ error: 'Failed to fetch flights' }, { status: 500 });
  }
}
