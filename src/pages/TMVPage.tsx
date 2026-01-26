import React from 'react';
import { useAuthStore } from '@/lib/store';
import TMVTab from '@/components/tmv/TMVTab';
import { Loader2 } from 'lucide-react';

export default function TMVPage() {
  const { profile, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0A0814]">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#0A0814] text-white flex items-center justify-center">
        <p>Please log in to view TMV Dashboard.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0814] text-white p-6 pb-24">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold mb-2">TMV Dashboard</h1>
          <p className="text-gray-400">Manage your vehicles, license, and insurance.</p>
        </div>
        
        <TMVTab profile={profile} isOwnProfile={true} />
      </div>
    </div>
  );
}
