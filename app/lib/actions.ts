// app/lib/actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import postgres from 'postgres';
import { z } from 'zod';
import { signIn } from '@/auth';
import { AuthError } from 'next-auth';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

export type ActionState = {
  errors?: {
    customerId?: string[];
    amount?: string[];
    status?: string[];
  };
  message?: string | null;
};

const InvoiceFormSchema = z.object({
  customerId: z
    .string({ required_error: 'Please select a customer.' })
    .min(1, 'Please select a customer.'),
  amount: z
    .coerce.number({ invalid_type_error: 'Please enter a valid amount.' })
    .gt(0, 'Amount must be greater than 0.'),
  status: z.enum(['pending', 'paid'], {
    required_error: 'Please select an invoice status.',
  }),
});

/* -------------------- CREATE -------------------- */
export async function createInvoice(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = InvoiceFormSchema.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });

  if (!parsed.success) {
    const { fieldErrors } = parsed.error.flatten();
    return { errors: fieldErrors, message: 'Missing Fields. Failed to Create Invoice.' };
  }

  const { customerId, amount, status } = parsed.data;
  const amountInCents = Math.round(amount * 100);
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  try {
    await sql/* sql */`
      INSERT INTO invoices (customer_id, amount_cents, status, date)
      VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
    `;
  } catch (e) {
    return { message: 'Database Error: Failed to Create Invoice.' };
  }

  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

/* -------------------- UPDATE -------------------- */
export async function updateInvoice(
  id: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = InvoiceFormSchema.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });

  if (!parsed.success) {
    const { fieldErrors } = parsed.error.flatten();
    return { errors: fieldErrors, message: 'Missing Fields. Failed to Update Invoice.' };
  }

  const { customerId, amount, status } = parsed.data;
  const amountInCents = Math.round(amount * 100);

  try {
    await sql/* sql */`
      UPDATE invoices
      SET customer_id = ${customerId},
          amount_cents = ${amountInCents},
          status = ${status}
      WHERE id = ${id}
    `;
  } catch (e) {
    return { message: 'Database Error: Failed to Update Invoice.' };
  }

  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

/* -------------------- DELETE -------------------- */
export async function deleteInvoice(id: string): Promise<ActionState> {
  try {
    await sql/* sql */`DELETE FROM invoices WHERE id = ${id}`;
    revalidatePath('/dashboard/invoices');
    return { message: null };
  } catch (e) {
    return { message: 'Database Error: Failed to Delete Invoice.' };
  }
}


export async function authenticate(
  prevState: string | undefined,
  formData: FormData,
) {
  try {
    await signIn('credentials', formData);
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return 'Invalid credentials.';
        default:
          return 'Something went wrong.';
      }
    }
    throw error;
  }
}