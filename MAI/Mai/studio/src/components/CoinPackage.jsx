import React from 'react';
import { Coins, Sparkles, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function CoinPackage({ 
  coins, 
  price, 
  popular = false, 
  bestValue = false,
  onPurchase,
  isLoading 
}) {
  const formatCoins = (num) => {
    return num.toLocaleString();
  };

  return (
    <div className={cn(
      "relative rounded-2xl p-6 transition-all duration-500 overflow-hidden",
      "bg-gradient-to-br from-gray-900/90 to-black",
      "border hover:scale-105",
      popular ? "border-[#FF1744] shadow-[0_0_30px_rgba(255,23,68,0.3)]" : "border-[#FFD700]/30 hover:border-[#FFD700]",
      bestValue && "ring-2 ring-[#FFD700] ring-offset-2 ring-offset-black"
    )}>
      {/* Popular Badge */}
      {popular && (
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#FF1744] rounded-b-lg">
          <span className="text-xs font-bold text-white flex items-center gap-1">
            <Star className="w-3 h-3 fill-white" /> POPULAR
          </span>
        </div>
      )}
      
      {/* Best Value Badge */}
      {bestValue && (
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#FFD700] rounded-b-lg">
          <span className="text-xs font-bold text-black flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> BEST VALUE
          </span>
        </div>
      )}
      
      {/* Coin Icon */}
      <div className={cn(
        "w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center",
        popular ? "bg-[#FF1744]/20" : "bg-[#FFD700]/20"
      )}>
        <Coins className={cn(
          "w-8 h-8",
          popular ? "text-[#FF1744]" : "text-[#FFD700]"
        )} />
      </div>
      
      {/* Coins Amount */}
      <div className="text-center mb-4">
        <span className={cn(
          "text-3xl font-bold",
          popular ? "text-[#FF1744]" : "text-[#FFD700]"
        )}>
          {formatCoins(coins)}
        </span>
        <p className="text-gray-400 text-sm mt-1">MAI Coins</p>
      </div>
      
      {/* Price */}
      <div className="text-center mb-6">
        <span className="text-2xl font-bold text-white">${price}</span>
        <p className="text-xs text-gray-500 mt-1">
          ${(price / coins * 1000).toFixed(2)} per 1K coins
        </p>
      </div>
      
      {/* Purchase Button */}
      <Button
        onClick={() => onPurchase(coins, price)}
        disabled={isLoading}
        className={cn(
          "w-full font-semibold py-6",
          popular 
            ? "neon-btn-red text-white" 
            : "neon-btn-gold text-black"
        )}
      >
        {isLoading ? 'Processing...' : 'Purchase'}
      </Button>
    </div>
  );
}