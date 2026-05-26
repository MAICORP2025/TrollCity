import React from 'react';

interface AgencyStatsCardProps {
  label: string;
  value: string;
  icon: string;
  color: 'blue' | 'purple' | 'pink' | 'cyan';
}

export default function AgencyStatsCard({ label, value, icon, color }: AgencyStatsCardProps) {
  const colorMap: Record<string, string> = {
    blue: 'text-blue-400 border-blue-500/30 bg-blue-500/10',
    purple: 'text-purple-400 border-purple-500/30 bg-purple-500/10',
    pink: 'text-pink-400 border-pink-500/30 bg-pink-500/10',
    cyan: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10'
  };

  return (
    <div className={`bg-slate-800/50 backdrop-blur-sm rounded-xl border p-4 text-center ${colorMap[color]}`}>
      <div className="flex items-center justify-center mb-2">
        <span className="text-2xl">{icon}</span>
      </div>
      <p className="text-sm font-medium text-white mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}