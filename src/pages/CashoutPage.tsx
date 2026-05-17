import React from 'react';
import { useAuthStore } from '../lib/store';
import MAIPayCard from '../components/MAIPayCard';

const CashoutPage: React.FC = () => {
  const { user } = useAuthStore() as any;

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0A0814] text-white flex justify-center px-4 py-8">
        <div className="w-full max-w-xl bg-[#0B0B12] rounded-2xl border border-purple-500 p-6 text-center">
          <h1 className="text-2xl font-bold mb-4">Authentication Required</h1>
          <p className="text-gray-300">Please log in to access MAI Pay.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0814] text-white flex justify-center px-4 py-8">
      <div className="w-full max-w-xl space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">Cash Out</h1>
          <p className="text-gray-400">Secure payouts powered by MAI Pay</p>
        </div>

        <MAIPayCard />
      </div>
    </div>
  );
};

export default CashoutPage;