'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { Wallet } from 'lucide-react';

export default function EmployeeExpensesPage() {
  const router = useRouter();
  const { authState, userProfile } = useAuth();

  // Route protection
  useEffect(() => {
    if (authState === 'unauthenticated') {
      router.replace('/');
      return;
    }

    if (
      authState === 'authenticated' &&
      userProfile?.role !== 'employee'
    ) {
      router.replace('/dashboard');
    }
  }, [authState, userProfile, router]);

  if (authState !== 'authenticated') {
    return null;
  }

  return (
    <div className="min-h-screen bg-black p-8 text-white">
      <Card className="bg-gray-900 border-gray-700 shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Wallet className="w-6 h-6 text-orange-500" />
            Expenses Tracker
          </CardTitle>
          <CardDescription className="text-gray-400">
            Track and manage your personal work-related expenses
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="border border-dashed border-gray-700 rounded-lg p-8 text-center">
            <p className="text-gray-400">
              Expenses tracking coming soon
            </p>
            <p className="text-sm text-gray-500 mt-2">
              You’ll be able to submit, edit, and track expense claims here.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
