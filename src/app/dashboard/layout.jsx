'use client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

export default function DashboardRootLayout({ children }) {
  return (
    <DashboardLayout>
      {children}
    </DashboardLayout>
  );
}
