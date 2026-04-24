import React from 'react';
import { Crown } from 'lucide-react';

interface PresidentBadgeProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function PresidentBadge({ size = 'md', className = '' }: PresidentBadgeProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-12 h-12'
  };

  const containerClasses = {
    sm: 'p-1',
    md: 'p-2',
    lg: 'p-4'
  };

  return (
    <div 
      className={`
        inline-flex items-center justify-center 
        rounded-full bg-gradient-to-tr from-yellow-600 via-yellow-400 to-yellow-200 
        shadow-[0_0_15px_rgba(234,179,8,0.6)] 
        border border-yellow-200/50
        animate-pulse
        ${containerClasses[size]} 
        ${className}
      `}
      title="Troll President"
    >
      <Crown 
        className={`text-yellow-900 fill-yellow-100 ${sizeClasses[size]}`} 
        strokeWidth={2.5}
      />
    </div>
  );
}
