import React, { useState } from 'react';
import { usePresidentSystem } from '@/hooks/usePresidentSystem';
import { useAuthStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Crown, DollarSign, UserPlus, TrendingUp, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function PresidentDashboard() {
  const { user, profile } = useAuthStore();
  const { 
    treasuryBalance, 
    raisePayouts, 
    appointVP, 
    currentVP, 
    loading 
  } = usePresidentSystem();
  
  const [payoutAmount, setPayoutAmount] = useState<string>('');
  const [vpId, setVpId] = useState<string>('');

  // Access Control
  const isAdmin = profile?.role === 'admin' || profile?.is_admin === true;
  const isPresident = profile?.role === 'president';
  
  if (!user || (!isAdmin && !isPresident)) {
      return (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8 text-slate-400">
              <AlertTriangle className="w-12 h-12 mb-4 text-amber-500" />
              <h2 className="text-xl font-bold text-white mb-2">Unauthorized Access</h2>
              <p>You do not have permission to view the Presidential Dashboard.</p>
          </div>
      );
  }

  const handleRaisePayout = () => {
    const amount = parseInt(payoutAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    raisePayouts(amount);
    setPayoutAmount('');
  };

  const handleAppointVP = () => {
    if (!vpId) {
      toast.error('Please enter a User ID');
      return;
    }
    appointVP(vpId);
    setVpId('');
  };

  return (
    <div className="space-y-6 p-4 md:p-8 animate-fade-in">
      <div className="flex items-center gap-4 mb-6">
        <div className="p-3 bg-yellow-500/20 rounded-full border border-yellow-500/50">
          <Crown className="w-8 h-8 text-yellow-500" />
        </div>
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-yellow-400 to-amber-600 bg-clip-text text-transparent">
            Presidential Office
          </h1>
          <p className="text-slate-400">Manage the Treasury and your Cabinet</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Treasury Card */}
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-400" />
              National Treasury
            </CardTitle>
            <CardDescription>
              Funds available for distribution
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-6 bg-slate-950 rounded-xl border border-slate-800 text-center">
              <span className="text-4xl font-mono font-bold text-green-400">
                ${treasuryBalance.toLocaleString()}
              </span>
              <p className="text-sm text-slate-500 mt-2">Current Balance</p>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-slate-300 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Economic Stimulus
              </h3>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-2.5 text-slate-500">$</span>
                  <Input 
                    placeholder="Amount" 
                    type="number" 
                    className="pl-6 bg-slate-950 border-slate-800"
                    value={payoutAmount}
                    onChange={(e) => setPayoutAmount(e.target.value)}
                  />
                </div>
                <Button 
                  onClick={handleRaisePayout}
                  disabled={loading}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Distribute
                </Button>
              </div>
              <p className="text-xs text-slate-500 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-amber-500" />
                This will increase the global daily payout cap for all citizens.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Cabinet Card */}
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-blue-400" />
              Cabinet Appointments
            </CardTitle>
            <CardDescription>
              Manage your Vice President
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
              <h3 className="text-sm font-medium text-slate-400 mb-3">Current Vice President</h3>
              {currentVP ? (
                <div className="flex items-center gap-3">
                  {currentVP.appointee?.avatar_url ? (
                    <img 
                      src={currentVP.appointee.avatar_url} 
                      className="w-10 h-10 rounded-full border border-blue-500/30"
                      alt="VP" 
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center">
                      <span className="text-lg">VP</span>
                    </div>
                  )}
                  <div>
                    <p className="font-bold text-white">{currentVP.appointee?.username || 'Unknown'}</p>
                    <p className="text-xs text-blue-400">Term ends: {new Date(currentVP.ends_at).toLocaleDateString()}</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-slate-500">
                  No Vice President appointed
                </div>
              )}
            </div>

            <Separator className="bg-slate-800" />

            <div className="space-y-4">
              <h3 className="font-semibold text-slate-300">Appoint New VP</h3>
              <div className="space-y-2">
                <Label htmlFor="vp-id">Citizen User ID</Label>
                <div className="flex gap-2">
                  <Input 
                    id="vp-id"
                    placeholder="UUID..." 
                    className="bg-slate-950 border-slate-800 font-mono text-sm"
                    value={vpId}
                    onChange={(e) => setVpId(e.target.value)}
                  />
                  <Button 
                    onClick={handleAppointVP}
                    disabled={loading}
                    variant="secondary"
                  >
                    Appoint
                  </Button>
                </div>
                <p className="text-xs text-slate-500">
                  Replacing the VP will immediately remove the current VP&apos;s privileges.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
