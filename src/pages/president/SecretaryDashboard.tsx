import React, { useMemo, useEffect } from 'react';
import { usePresidentSystem } from '@/hooks/usePresidentSystem';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Check, X, Calendar, Play, Gavel, History } from 'lucide-react';
import { useAuthStore } from '@/lib/store';

export default function SecretaryDashboard() {
  const { user, profile } = useAuthStore();
  const { 
    currentElection, 
    createElection, 
    finalizeElection,
    endElection,
    allElections,
    fetchAllElections, 
    approveCandidate, 
    rejectCandidate,
    loading,
    refresh
  } = usePresidentSystem();

  useEffect(() => {
    fetchAllElections();
  }, [fetchAllElections]);

  // Access Control
  const isAdmin = profile?.role === 'admin' || profile?.is_admin === true;
  const isSecretary = profile?.role === 'secretary';

  const pendingCandidates = useMemo(() => {
    return currentElection?.candidates?.filter(c => !c.is_approved) || [];
  }, [currentElection]);
  
  if (!user || (!isAdmin && !isSecretary)) {
      return (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8 text-slate-400">
              <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mb-4">
                  <Gavel className="w-6 h-6 text-slate-500" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Restricted Access</h2>
              <p>Only the Election Secretary can view this dashboard.</p>
          </div>
      );
  }

  const statusColors: Record<string, string> = {
    draft: 'bg-slate-500',
    open: 'bg-green-500',
    closed: 'bg-red-500',
    finalized: 'bg-blue-500',
    void: 'bg-gray-500'
  };

  const handleCreateElection = () => {
    if (confirm('Are you sure you want to start a new 3-week election cycle?')) {
      createElection();
    }
  };

  const handleFinalize = () => {
    if (!currentElection) return;
    if (confirm('Are you sure you want to finalize the results and appoint the winner?')) {
      finalizeElection(currentElection.id);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-8 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Election Commission</h1>
          <p className="text-slate-400">Manage elections and candidate approvals</p>
        </div>
        <Button 
          variant="outline" 
          onClick={refresh} 
          className="border-slate-700 hover:bg-slate-800"
        >
          Refresh Data
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Election Control */}
        <Card className="bg-slate-900/50 border-slate-800 lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-purple-400" />
              Current Cycle
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {currentElection ? (
              <div className="space-y-4">
                <div className="p-4 bg-slate-950 rounded-lg border border-slate-800">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-slate-400 text-sm">Status</span>
                    <Badge className={statusColors[currentElection.status] || 'bg-slate-500'}>
                      {currentElection.status.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Started</span>
                      <span className="text-slate-300">{new Date(currentElection.starts_at).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Ends</span>
                      <span className="text-slate-300">{new Date(currentElection.ends_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <Button 
                  onClick={handleFinalize}
                  disabled={loading || currentElection.status === 'finalized'}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  <Gavel className="w-4 h-4 mr-2" />
                  Finalize Results
                </Button>
              </div>
            ) : (
              <div className="text-center py-8 space-y-4">
                <p className="text-slate-400">No active election found.</p>
                <Button 
                  onClick={handleCreateElection}
                  disabled={loading}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Start New Election
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Candidate Approvals */}
        <Card className="bg-slate-900/50 border-slate-800 lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Check className="w-5 h-5 text-blue-400" />
                Pending Approvals
              </div>
              <Badge variant="secondary">{pendingCandidates.length}</Badge>
            </CardTitle>
            <CardDescription>
              Review and approve candidate applications
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pendingCandidates.length === 0 ? (
              <div className="text-center py-12 text-slate-500 border border-dashed border-slate-800 rounded-lg">
                No pending candidates
              </div>
            ) : (
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-4">
                  {pendingCandidates.map((candidate) => (
                    <div 
                      key={candidate.id}
                      className="p-4 bg-slate-950 rounded-lg border border-slate-800 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center"
                    >
                      <div className="flex items-center gap-3">
                        {candidate.avatar_url ? (
                          <img 
                            src={candidate.avatar_url} 
                            className="w-12 h-12 rounded-full border border-slate-700"
                            alt="Candidate"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-lg font-bold">
                            {candidate.username?.[0]?.toUpperCase()}
                          </div>
                        )}
                        <div>
                          <h4 className="font-bold text-white">{candidate.username}</h4>
                          <p className="text-xs text-slate-400 italic">&quot;{candidate.slogan || 'No slogan'}&quot;</p>
                        </div>
                      </div>

                      <div className="flex gap-2 w-full sm:w-auto">
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={() => rejectCandidate(candidate.id)}
                          disabled={loading}
                          className="flex-1 sm:flex-none"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          className="bg-green-600 hover:bg-green-700 flex-1 sm:flex-none"
                          onClick={() => approveCandidate(candidate.id)}
                          disabled={loading}
                        >
                          <Check className="w-4 h-4 mr-2" />
                          Approve
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Election History */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-slate-400" />
            Election History
          </CardTitle>
          <CardDescription>
            History of all past and present elections
          </CardDescription>
        </CardHeader>
        <CardContent>
          {allElections.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              No elections found
            </div>
          ) : (
            <div className="rounded-md border border-slate-800">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-950 text-slate-400 font-medium">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Title</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Winner</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {allElections.map((election) => (
                    <tr key={election.id} className="hover:bg-slate-800/50">
                      <td className="p-3 text-slate-300">
                        {new Date(election.created_at).toLocaleDateString()}
                      </td>
                      <td className="p-3 font-medium text-white">
                        {election.title || 'Untitled Election'}
                      </td>
                      <td className="p-3">
                        <Badge className={statusColors[election.status] || 'bg-slate-500'}>
                          {election.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-slate-300">
                        {election.winner_candidate_id ? 'Decided' : '-'}
                      </td>
                      <td className="p-3 text-right">
                        {election.status === 'open' && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                            onClick={() => {
                              if (confirm('End this election?')) endElection(election.id);
                            }}
                          >
                            End Now
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
