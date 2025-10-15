import { NextResponse } from "next/server";
import postgres from "postgres";
const sql = postgres(process.env.POSTGRES_URL!, { ssl: "require" });

export async function GET() {
  try {
    await sql`CREATE TABLE IF NOT EXISTS revenue (month TEXT PRIMARY KEY, amount_cents INT NOT NULL)`;
    await sql`
      INSERT INTO revenue (month, amount_cents) VALUES
        ('2025-07', 250000), ('2025-08', 310000),
        ('2025-09', 280000), ('2025-10', 335000)
      ON CONFLICT (month) DO UPDATE SET amount_cents = EXCLUDED.amount_cents
    `;

    await sql`
      ALTER TABLE invoices
        ADD COLUMN IF NOT EXISTS amount INT,
        ADD COLUMN IF NOT EXISTS date TIMESTAMPTZ DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS status TEXT
          CHECK (status IN ('paid','pending','overdue')) DEFAULT 'paid'
    `;
    try {
      await sql`UPDATE invoices SET amount = amount_cents WHERE amount IS NULL`;
      // opzionale: elimina amount_cents se vuoi
      // await sql`ALTER TABLE invoices DROP COLUMN IF EXISTS amount_cents`;
    } catch {}

    await sql`
      ALTER TABLE customers
        ADD COLUMN IF NOT EXISTS email TEXT,
        ADD COLUMN IF NOT EXISTS image_url TEXT
    `;

    return NextResponse.json({ ok: true });
  } catch (e:any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
