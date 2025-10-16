import postgres from 'postgres';
import {
  CustomerField,
  CustomersTableType,
  InvoiceForm,
  InvoicesTable,
  LatestInvoiceRaw,
  Revenue,
} from './definitions';
import { formatCurrency } from './utils';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

// export async function fetchRevenue() {
//   try {
//     // Artificially delay a response for demo purposes.
//     // Don't do this in production :)

//     console.log('Fetching revenue data...');
//     await new Promise((resolve) => setTimeout(resolve, 3000));

//    const rows = await sql/* sql */`
//       SELECT month, amount_cents FROM revenue ORDER BY month
//     `;

//         console.log('Data fetch completed after 3 seconds.');


//     // Se il tuo tipo Revenue è { month: string; revenue: number }
//     return rows.map((r: any) => ({
//       month: r.month,
//       revenue: Number(r.amount_cents) / 100, // converte da centesimi
//     }));
//   }catch (error) {
//     console.error('Database Error:', error);
//     throw new Error('Failed to fetch revenue data.');
//   }
// }


//MOCK
export async function fetchRevenue() {
  return [
    { month: '2025-07', revenue: 2500 },
    { month: '2025-08', revenue: 3100 },
    { month: '2025-09', revenue: 2800 },
    { month: '2025-10', revenue: 3350 },
  ];
}

export async function fetchLatestInvoices() {
  try {
    // se le tabelle non ci sono, esci pulito
    const reg = await sql/* sql */`
      SELECT to_regclass('public.invoices') AS has_invoices,
             to_regclass('public.customers') AS has_customers
    `;
    if (!reg?.[0]?.has_invoices || !reg?.[0]?.has_customers) return [];

    const rows = await sql/* sql */`
      SELECT
        i.id,
        COALESCE(i.amount, i.amount_cents) AS amount_cents,
        c.name,
        NULLIF(c.image_url,'') AS image_url,
        NULLIF(c.email,'')     AS email
      FROM public.invoices i
      JOIN public.customers c ON i.customer_id = c.id
      ORDER BY i.id DESC
      LIMIT 5
    `;

    return rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      email: r.email ?? null,
      image_url: r.image_url ?? null,
      amount: formatCurrency(Number(r.amount_cents ?? 0)),
    }));
  } catch (e) {
    console.error('fetchLatestInvoices error:', e);
    // NON rilanciare: evita il crash della dashboard
    return [];
  }
}


export async function fetchCardData() {
  try {
    const inv = await sql/* sql */`SELECT COUNT(*) AS count FROM public.invoices`;
    const numberOfInvoices = Number(inv?.[0]?.count ?? 0);

    const cust = await sql/* sql */`SELECT COUNT(*) AS count FROM public.customers`;
    const numberOfCustomers = Number(cust?.[0]?.count ?? 0);

    const stat = await sql/* sql */`
      SELECT
        COALESCE(SUM(CASE WHEN COALESCE(status,'paid')='paid'
               THEN COALESCE(amount, amount_cents) ELSE 0 END),0) AS paid,
        COALESCE(SUM(CASE WHEN COALESCE(status,'paid')='pending'
               THEN COALESCE(amount, amount_cents) ELSE 0 END),0) AS pending
      FROM public.invoices
    `;
    const totalPaidInvoices = formatCurrency(Number(stat?.[0]?.paid ?? 0));
    const totalPendingInvoices = formatCurrency(Number(stat?.[0]?.pending ?? 0));

    return { numberOfCustomers, numberOfInvoices, totalPaidInvoices, totalPendingInvoices };
  } catch (error) {
    console.error('fetchCardData error:', error);
    return {
      numberOfCustomers: 0,
      numberOfInvoices: 0,
      totalPaidInvoices: formatCurrency(0),
      totalPendingInvoices: formatCurrency(0),
    };
  }
}


const ITEMS_PER_PAGE = 6;

export async function fetchFilteredInvoices(query: string, currentPage: number) {
  const offset = (currentPage - 1) * ITEMS_PER_PAGE;

  // Tipi di riga attesi dalla query
  type Row = {
    id: number;
    customer_id: number;
    amount: number | string | null;
    date: string | Date | null;
    status: 'paid' | 'pending' | string | null;
    name: string;
    email: string | null;
    image_url: string | null;
  };

  try {
    const rows = await sql<Row[]>/* sql */`
      SELECT
        i.id,
        i.customer_id,
        COALESCE(i.amount, i.amount_cents)                AS amount,
        COALESCE(i.date::timestamptz, NOW()::timestamptz) AS date,
        COALESCE(i.status, 'paid')                        AS status,
        c.name,
        NULLIF(c.email, '')                               AS email,
        NULLIF(c.image_url, '')                           AS image_url
      FROM public.invoices i
      JOIN public.customers c ON i.customer_id = c.id
      WHERE
        c.name ILIKE ${`%${query}%`} OR
        c.email ILIKE ${`%${query}%`} OR
        COALESCE(i.amount, i.amount_cents)::text ILIKE ${`%${query}%`} OR
        COALESCE(i.date::timestamptz::text,'') ILIKE ${`%${query}%`} OR
        COALESCE(i.status,'') ILIKE ${`%${query}%`}
      ORDER BY COALESCE(i.date::timestamptz, NOW()::timestamptz) DESC
      LIMIT ${ITEMS_PER_PAGE} OFFSET ${offset}
    `;

    // Mappo in InvoicesTable (evito cast “brutali”)
    const invoices: InvoicesTable[] = rows.map((r) => ({
      id: r.id,
      customer_id: r.customer_id,
      amount: Number(r.amount ?? 0),                               // numero in unità
      date: typeof r.date === 'string' ? r.date : new Date(r.date ?? Date.now()).toISOString(),
      status: (r.status ?? 'paid') as 'paid' | 'pending',
      name: r.name,
      email: r.email ?? '',
      image_url: r.image_url ?? '',
    }));

    return invoices;
  } catch (error) {
    console.error('Database Error (fetchFilteredInvoices):', error);
    throw new Error('Failed to fetch invoices.');
  }
}


export async function fetchInvoicesPages(query: string) {
  try {
   const data = await sql/* sql */`
  SELECT COUNT(*) FROM (
    SELECT 1
    FROM public.invoices i
    JOIN public.customers c ON i.customer_id = c.id
    WHERE
      c.name ILIKE ${`%${query}%`} OR
      c.email ILIKE ${`%${query}%`} OR
      COALESCE(i.amount, i.amount_cents)::text ILIKE ${`%${query}%`} OR
      COALESCE(i.date::timestamptz::text,'') ILIKE ${`%${query}%`} OR
      COALESCE(i.status,'') ILIKE ${`%${query}%`}
  ) s
`;

    return Math.ceil(Number((data as any)[0].count) / ITEMS_PER_PAGE);
  } catch (error) {
    console.error('Database Error (fetchInvoicesPages):', error);
    throw new Error('Failed to fetch total number of invoices.');
  }
}


export async function fetchInvoiceById(id: string) {
  try {
    const rows = await sql/* sql */`
      SELECT
        i.id,
        i.customer_id,
        COALESCE(i.amount, i.amount_cents) AS amount_cents,
        i.status
      FROM public.invoices i
      WHERE i.id = ${id}
    `;

    if (!rows?.length) return null;

    const r: any = rows[0];
    return {
      id: r.id,
      customer_id: r.customer_id,
      amount: Number(r.amount_cents) / 100, // ← il form vede € (non cent)
      status: r.status,
    } as InvoiceForm;
  } catch (error) {
    console.error('Database Error (fetchInvoiceById):', error);
    throw new Error('Failed to fetch invoice.');
  }
}


export async function fetchCustomers() {
  try {
    const customers = await sql<CustomerField[]>`
      SELECT
        id,
        name
      FROM customers
      ORDER BY name ASC
    `;

    return customers;
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch all customers.');
  }
}

export async function fetchFilteredCustomers(query: string) {
  try {
    const data = await sql<CustomersTableType[]>`
      SELECT
        c.id,
        c.name,
        c.email,
        c.image_url,
        COUNT(i.id) AS total_invoices,
        SUM(CASE WHEN i.status = 'pending' THEN COALESCE(i.amount, i.amount_cents) ELSE 0 END) AS total_pending,
        SUM(CASE WHEN i.status = 'paid'    THEN COALESCE(i.amount, i.amount_cents) ELSE 0 END) AS total_paid
      FROM public.customers c
      LEFT JOIN public.invoices i ON c.id = i.customer_id
      WHERE
        c.name  ILIKE ${`%${query}%`} OR
        c.email ILIKE ${`%${query}%`}
      GROUP BY c.id, c.name, c.email, c.image_url
      ORDER BY c.name ASC
    `;

    const customers = data.map((customer) => ({
      ...customer,
      total_pending: formatCurrency(customer.total_pending ?? 0),
      total_paid: formatCurrency(customer.total_paid ?? 0),
    }));

    return customers;
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch customer table.');
  }
}

