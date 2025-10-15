import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
// Se usi Prisma o pg, adatta. Con @vercel/postgres va bene così.

export const dynamic = "force-dynamic"; // evita cache nel dev
// export const runtime = "nodejs"; // solo se usi 'pg' o Prisma

export async function GET() {
  try {
    // 1) sanity check ENV
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL non impostata o non letta dal processo");
    }

    // 2) crea tabelle di esempio (idempotenti)
    await sql`
      CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS invoices (
        id SERIAL PRIMARY KEY,
        customer_id INT REFERENCES customers(id),
        amount_cents INT NOT NULL
      );
    `;

    // 3) inserisci dati se vuoto
    const { rows: countRows } = await sql`SELECT COUNT(*)::int AS c FROM customers;`;
    if (countRows[0].c === 0) {
      await sql`INSERT INTO customers (name) VALUES ('Acme SpA'), ('Beta SRL');`;
      await sql`INSERT INTO invoices (customer_id, amount_cents) VALUES (1, 12500), (2, 9900);`;
    }

    return NextResponse.json({ message: "Database seeded successfully" });
  } catch (err: any) {
    console.error("SEED ERROR:", err);
    // Rispondi col dettaglio per debug
    return NextResponse.json(
      { error: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
