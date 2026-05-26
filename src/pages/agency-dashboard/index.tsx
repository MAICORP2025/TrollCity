import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import { Loader } from '../../components/ui/loader';
import { Badge } from '../../components/ui/badge';
import AgencyStatsCard from './components/AgencyStatsCard';
import AgencyMembersTable from './components/AgencyMembersTable';
import { AgencyApplicationsTable } from './components/AgencyApplicationsTable';
import { AgencyGoalsTable } from './components/AgencyGoalsTable';
import { AgencyEarningsChart } from './components/AgencyEarningsChart';

export default function AgencyDashboard() {
  const { user } = useAuth();
  const [agency, setAgency] = useState(null);
  const [userRole, setUserRole] = useState<'owner' | 'manager' | 'creator' | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchAgencyData();
  }, []);

  const fetchAgencyData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Fetch user's agency membership
      const { data: membershipData, error: membershipError } = await supabase
        .from('agency_members')
        .select(`
          *,
          agencies (
            id,
            name,
            slug,
            bio,
            logo_url,
            banner_url,
            status,
            default_split_percent
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (membershipError) {
        throw membershipError;
      }

      if (!membershipData || !membershipData.agencies) {
        setAgency(null);
        setUserRole(null);
        setError('You are not a member of any agency yet.');
        return;
      }

      const agencyData = membershipData.agencies;
      // Check if agency is approved
      if (agencyData.status !== 'approved') {
        setError('Your agency is not approved or active');
        return;
      }

      setAgency(agencyData);
      setUserRole(membershipData.role as any);

      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Loader />;
  if (error) return <div className="text-red-400 p-4">{error}</div>;
  if (!agency) return <div className="text-center py-8">Loading agency dashboard...</div>;

  // Check if user is owner or manager
  const isOwnerOrManager = userRole === 'owner' || userRole === 'manager';
  if (!isOwnerOrManager) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-8">
        <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Access Denied</h2>
            <p className="text-slate-400 mb-6">
              You do not have permission to access the agency dashboard. Only owners and managers can view this page.
            </p>
            <Button 
              variant="outline" 
              className="px-4 py-2 bg-transparent border border-cyan-500/30 hover:bg-cyan-500/10"
              onClick={() => window.history.back()}
            >
              Go Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center space-x-4 mb-4">
            {agency.logo_url ? (
              <img 
                src={agency.logo_url} 
                alt={`${agency.name} logo`} 
                className="w-16 h-16 rounded-full border-2 border-cyan-500/30"
              />
            ) : (
              <div className="w-16 h-16 rounded-full border-2 border-cyan-500/30 flex items-center justify-center bg-slate-700">
                <span className="text-cyan-400 font-bold text-2xl">{agency.name.charAt(0)}</span>
              </div>
            )}
            <div>
              <h2 className="text-2xl font-bold text-white">{agency.name}</h2>
              <p className="text-sm text-slate-400">
                Owner: <span className="text-cyan-400">@{agency.owner_id === user.id ? 'You' : 'Loading...'}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 mb-4">
            <Badge variant="outline" className="text-cyan-400 border-cyan-500/30">
              👥 {0} Creators // Placeholder
            </Badge>
            <Badge variant="outline" className="text-blue-400 border-blue-500/30">
              ⏰ {0} hrs/wk // Placeholder
            </Badge>
            <Badge variant="outline" className="text-purple-400 border-purple-500/30">
              🎁 {0} coins/wk // Placeholder
            </Badge>
            <Badge variant="outline" className="text-pink-400 border-pink-500/30">
              ⚔️ {0} battles/wk // Placeholder
            </Badge>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <Tabs defaultValue="overview" onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-4 flex h-auto flex-wrap justify-start gap-2 border-b border-slate-700/50 bg-transparent p-0">
              <TabsTrigger
                value="overview"
                className="rounded-lg border border-cyan-500/20 bg-slate-900/70 px-4 py-2 text-slate-300 data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300"
              >
                Overview
              </TabsTrigger>

              <TabsTrigger
                value="members"
                className="rounded-lg border border-cyan-500/20 bg-slate-900/70 px-4 py-2 text-slate-300 data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300"
              >
                Members
              </TabsTrigger>

              {userRole === 'owner' && (
                <>
                  <TabsTrigger
                    value="applications"
                    className="rounded-lg border border-cyan-500/20 bg-slate-900/70 px-4 py-2 text-slate-300 data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300"
                  >
                    Applications
                  </TabsTrigger>

                  <TabsTrigger
                    value="invites"
                    className="rounded-lg border border-cyan-500/20 bg-slate-900/70 px-4 py-2 text-slate-300 data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300"
                  >
                    Invites
                  </TabsTrigger>
                </>
              )}

              <TabsTrigger
                value="goals"
                className="rounded-lg border border-cyan-500/20 bg-slate-900/70 px-4 py-2 text-slate-300 data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300"
              >
                Goals
              </TabsTrigger>

              <TabsTrigger
                value="earnings"
                className="rounded-lg border border-cyan-500/20 bg-slate-900/70 px-4 py-2 text-slate-300 data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300"
              >
                Earnings
              </TabsTrigger>

              <TabsTrigger
                value="activity"
                className="rounded-lg border border-cyan-500/20 bg-slate-900/70 px-4 py-2 text-slate-300 data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300"
              >
                Activity
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <div className="space-y-6">
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                  <AgencyStatsCard label="Live Hours This Week" value="0" icon="⏰" color="blue" />
                  <AgencyStatsCard label="Gift Earnings This Week" value="0 coins" icon="🎁" color="purple" />
                  <AgencyStatsCard label="Battles This Week" value="0" icon="⚔️" color="pink" />
                  <AgencyStatsCard label="Active Creators" value="0" icon="👥" color="cyan" />
                </div>

                {userRole === 'owner' && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Button
                      variant="primary"
                      className="w-full px-6 py-3"
                      onClick={() => alert('Edit agency profile')}
                    >
                      Edit Agency Profile
                    </Button>

                    <Button
                      variant="outline"
                      className="w-full border border-cyan-500/30 px-6 py-3 hover:bg-cyan-500/10"
                      onClick={() => alert('Upload new logo/banner')}
                    >
                      Update Agency Media
                    </Button>
                  </div>
                )}

                <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4 backdrop-blur-sm">
                  <h3 className="mb-3 text-lg font-semibold text-cyan-400">Recent Activity</h3>

                  <div className="space-y-3">
                    <div className="flex items-center space-x-3 rounded bg-slate-700/50 p-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded bg-cyan-500/20">
                        <span className="text-cyan-400">👥</span>
                      </div>

                      <div className="flex-1">
                        <p className="text-sm font-medium text-white">New member joined</p>
                        <p className="text-xs text-slate-400">Just now</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 rounded bg-slate-700/50 p-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded bg-purple-500/20">
                        <span className="text-purple-400">🎁</span>
                      </div>

                      <div className="flex-1">
                        <p className="text-sm font-medium text-white">Gift received</p>
                        <p className="text-xs text-slate-400">5 minutes ago</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="members">
              <AgencyMembersTable agencyId={agency.id} userRole={userRole} />
            </TabsContent>

            {userRole === 'owner' && (
              <>
                <TabsContent value="applications">
                  <AgencyApplicationsTable agencyId={agency.id} userRole={userRole} />
                </TabsContent>

                <TabsContent value="invites">
                  <div className="p-6">
                    <h3 className="mb-4 text-lg font-semibold text-cyan-400">Agency Invites</h3>
                    <p className="text-slate-400">Invite management coming soon</p>
                  </div>
                </TabsContent>
              </>
            )}

            <TabsContent value="goals">
              <AgencyGoalsTable agencyId={agency.id} userRole={userRole} />
            </TabsContent>

            <TabsContent value="earnings">
              <AgencyEarningsChart agencyId={agency.id} />
            </TabsContent>

            <TabsContent value="activity">
              <div className="p-6">
                <h3 className="mb-4 text-lg font-semibold text-cyan-400">Agency Activity Log</h3>
                <p className="text-slate-400">Activity logging coming soon</p>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}