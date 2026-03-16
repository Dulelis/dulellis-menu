import { redirect } from 'next/navigation';

export default function AdminVendasRelatoriosPage() {
  redirect('/admin?tab=relatorios');
}
