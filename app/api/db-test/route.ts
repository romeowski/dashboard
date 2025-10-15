import { NextResponse } from 'next/server';
import postgres from 'postgres';

export async function GET() {
  try {
    const url = process.env.POSTGRES_URL;
    if (!url) return NextResponse.json({ error: 'POSTGRES_URL missing' }, { status: 500 });

    const sql = postgres(url, { ssl: 'require', connect_timeout: 10 });
    const r = await sql`SELECT 1 AS ok`;
    await sql.end({ timeout: 1 });
    return NextResponse.json({ ok: r?.[0]?.ok === 1, urlHost: new URL(url).host });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
