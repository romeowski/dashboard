// app/debug/route.ts
import { NextResponse } from "next/server";
import postgres from "postgres";

// ⚠️ Usa la stessa variabile che usi altrove (POSTGRES_URL o DATABASE_URL)
const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
if (!url) console.warn("⚠️ Nessuna POSTGRES_URL/DATABASE_URL trovata");
const sql = postgres(url!, { ssl: "require" });

export async function GET() {
  try {
    // Maschera credenziali nella risposta
    const safeDbUrl = (url || "").replace(/:\/\/.*@/, "://***:***@");

    // Elenco tabelle nello schema public
    const tablesRes = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;
    const tables = tablesRes.map(r => r.table_name as string);

    // Colonne, count e sample per ciascuna tabella
    const columns: Record<string, string[]> = {};
    const counts: Record<string, number> = {};
    const sample: Record<string, any[]> = {};

    for (const t of tables) {
      const cols = await sql`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema='public' AND table_name=${t}
        ORDER BY ordinal_position;
      `;
      columns[t] = cols.map(r => r.column_name as string);

      // count
      const countRows = await sql.unsafe(`SELECT COUNT(*)::int AS c FROM "${t}";`);
      counts[t] = countRows[0].c as number;

      // sample
      if (counts[t] > 0) {
        const s = await sql.unsafe(`SELECT * FROM "${t}" LIMIT 5;`);
        sample[t] = s;
      }
    }

    return NextResponse.json({ db: safeDbUrl, tables, counts, columns, sample });
  } catch (err: any) {
    console.error("DEBUG ERROR:", err);
    return NextResponse.json({ error: err.message ?? "Unknown error" }, { status: 500 });
  }
}
