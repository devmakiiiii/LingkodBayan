import { redirect } from 'next/navigation'

/**
 * Legacy route — the complaints list and resident reports were the same page.
 * Complaints List (`/admin/complaints`) is now the canonical route.
 */
export default function AdminResidentReportsRedirect() {
  redirect('/admin/complaints')
}
