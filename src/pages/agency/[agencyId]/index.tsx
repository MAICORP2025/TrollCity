import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Loader } from '../../components/ui/loader';
import { EmptyState } from '../../components/ui/empty-state';
import { Badge } from '../../components/ui/badge';

export default function AgencyProfilePage() {
  const { agencyId } = useParams<{ agencyId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [agency, setAgency] = useState(null);
  const [members, setMembers] = useState([]);
  const [topCreators, setTopCreators] = useState([]);
  const [weeklyStats, setWeeklyStats] = useState(null);
  const [monthlyStats, setMonthlyStats] = useState(null);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isMember, setIsMember] = useState(false);
  const [userRole, setUserRole] = useState<'owner' | 'manager' | 'creator' | null>(null);

  useEffect(() => {
    fetchAgencyData();
  }, [agencyId]);

  const fetchAgencyData = async () => {
    try {
      setLoading(true);
      
      // Fetch agency info
      const { data: agencyData, error: agencyError } = await supabase
        .from('agencies')
        .select('*')
        .eq('id', agencyId)
        .eq('status', 'approved')
        .single();

      if (agencyError) throw agencyError;
      if (!agencyData) {
        setError('Agency not found');
        return;
      }
      setAgency(agencyData);

      // Fetch owner info
      const { data: ownerData } = await supabase
        .from('user_profiles')
        .select('username')
        .eq('id', agencyData.owner_id)
        .single();

      // Fetch members
      const { data: membersData } = await supabase
        .from('agency_members')
        .select(`
          *,
          user_profiles:user_id (username, avatar_url, rgb_username_expires_at)
        `)
        .eq('agency_id', agencyId)
        .eq('status', 'active');

      if (membersData) {
        setMembers(membersData);
        // Check if current user is a member and their role
        if (user) {
          const member = membersData.find(m => m.user_id === user.id);
          if (member) {
            setIsMember(true);
            setUserRole(member.role as any);
          }
        }
      }

      // Fetch top creators (simplified - would need actual stats calculation)
      setTopCreators(membersData
        ?.filter(m => m.role === 'creator')
        .sort(() => Math.random() - 0.5)
        .slice(0, 3) || []);

      // Fetch weekly stats (placeholder)
      setWeeklyStats({
        liveHours: Math.floor(Math.random() * 100),
        giftEarnings: Math.floor(Math.random() * 10000),
        battleCount: Math.floor(Math.random() * 50),
        creatorCount: membersData?.filter(m => m.role === 'creator').length || 0
      });

      // Fetch monthly stats (placeholder)
      setMonthlyStats({
        liveHours: Math.floor(Math.random() * 400),
        giftEarnings: Math.floor(Math.random() * 40000),
        battleCount: Math.floor(Math.random() * 200),
        creatorCount: membersData?.filter(m => m.role === 'creator').length || 0
      });

      // Fetch agency goals
      const { data: goalsData } = await supabase
        .from('agency_goals')
        .select('*')
        .eq('agency_id', agencyId)
        .in('status', ['active', 'completed'])
        .order('created_at', { ascending: false });

      if (goalsData) setGoals(goalsData);

      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }
    
    navigate(`/agency-apply/${agencyId}`);
  };

  const handleManageMembership = () => {
    navigate(`/agency-dashboard`);
  };

  if (loading) return <Loader />;
  if (error) return <div className="text-red-400 p-4">{error}</div>;
  if (!agency) return <div className="text-center py-8">Loading agency...</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 overflow-hidden mb-6">
          {agency.banner_url && (
            <div className="h-48 bg-cover bg-center" style={{ backgroundImage: `url(${agency.banner_url})` }}></div>
          )}
          
          <div className="p-6">
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
                  Owner: <span className="text-cyan-400">@{ownerData?.username || 'Unknown'}</span>
                </p>
              </div>
            </div>

            {agency.bio && (
              <p className="text-slate-300 mb-4">
                {agency.bio}
              </p>
            )}

            <div className="flex flex-wrap gap-4 mb-4">
              <Badge variant="outline" className="text-cyan-400 border-cyan-500/30">
                👥 {members.filter(m => m.role === 'creator').length} Creators
              </Badge>
              <Badge variant="outline" className="text-blue-400 border-blue-500/30">
                ⏰ {weeklyStats?.liveHours} hrs/wk
              </Badge>
              <Badge variant="outline" className="text-purple-400 border-purple-500/30">
                🎁 {weeklyStats?.giftEarnings.toLocaleString()} coins/wk
              </Badge>
              <Badge variant="outline" className="text-pink-400 border-pink-500/30">
                ⚔️ {weeklyStats?.battleCount} battles/wk
              </Badge>
            </div>

            <div className="flex justify-between items-center mt-4">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-slate-500">Agency Rank:</span>
                <span className="text-sm font-medium text-cyan-400">#{Math.floor(Math.random() * 50) + 1}</span>
              </div>
              {!user ? (
                <button 
                  className="px-4 py-2 bg-slate-700/50 border border-slate-600/50 rounded text-sm hover:bg-slate-600/50"
                  onClick={() => alert('Please log in to join')}
                >
                  Apply to Join
                </button>
              ) : isMember ? (
                <Button 
                  variant="outline" 
                  className="px-4 py-2 bg-transparent border border-cyan-500/30 hover:bg-cyan-500/10"
                  onClick={handleManageMembership}
                >
                  Manage Membership
                </Button>
              ) : (
                <Button 
                  variant="primary" 
                  className="px-4 py-2"
                  onClick={handleJoin}
                >
                  Apply to Join
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="flex border-b border-slate-700/50 mb-4">
            <button 
              className="px-4 py-2 text-sm font-medium 
                ${window.location.pathname.includes('/stats') ? 'text-cyan-400 border-b-2 border-cyan-500' : 'text-slate-400 hover:text-white'}"
              onClick={() => navigate(`/agency/${agencyId}/stats`)}
            >
              Overview
            </button>
            <button 
              className="px-4 py-2 text-sm font-medium 
                ${window.location.pathname.includes('/roster') ? 'text-cyan-400 border-b-2 border-cyan-500' : 'text-slate-400 hover:text-white'}"
              onClick={() => navigate(`/agency/${agencyId}/roster`)}
            >
              Roster
            </button>
            <button 
              className="px-4 py-2 text-sm font-medium 
                ${window.location.pathname.includes('/goals') ? 'text-cyan-400 border-b-2 border-cyan-500' : 'text-slate-400 hover:text-white'}"
              onClick={() => navigate(`/agency/${agencyId}/goals`)}
            >
              Goals
            </button>
          </div>
        </div>

        {/* Content based on route - simplified for now */}
        {!window.location.pathname.includes('/stats') && 
        !window.location.pathname.includes('/roster') && 
        !window.location.pathname.includes('/goals') && (
          <>
            {/* Top Creators */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-cyan-400 mb-3">Top Creators</h3>
              {topCreators.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-3">
                  {topCreators.map(creator => (
                    <Link 
                      key={creator.user_id} 
                      to={`/profile/${creator.user_id}`}
                      className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-4 hover:shadow-xl transition-shadow duration-300"
                    >
                      <div className="flex items-center space-x-3">
                        {creator.user_profiles?.avatar_url ? (
                          <img 
                            src={creator.user_profiles.avatar_url} 
                            alt={`${creator.user_profiles?.username || 'Creator'} avatar`} 
                            className="w-10 h-10 rounded-full border-2 border-cyan-500/30"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full border-2 border-cyan-500/30 flex items-center justify-center bg-slate-700">
                            <span className="text-cyan-400 font-bold">{creator.user_profiles?.username?.charAt(0) || '?'}</span>
                          </div>
                        )}
                        <div>
                          <h4 className="text-lg font-semibold text-white">{creator.user_profiles?.username || 'Unknown Creator'}</h4>
                          <p className="text-sm text-slate-400">Top Performer</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400 text-center py-8">No creators yet</p>
              )}
            </div>

            {/* Weekly Stats */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-cyan-400 mb-3">Weekly Stats</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-cyan-400">⏰</span>
                    <span className="text-sm text-slate-400">Live Hours</span>
                  </div>
                  <p className="text-2xl font-bold text-white">{weeklyStats?.liveHours}</p>
                  <p className="text-xs text-slate-500">This week</p>
                </div>
                <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-purple-400">🎁</span>
                    <span className="text-sm text-slate-400">Gift Earnings</span>
                  </div>
                  <p className="text-2xl font-bold text-white">{weeklyStats?.giftEarnings?.toLocaleString()}</p>
                  <p className="text-xs text-slate-500">This week</p>
                </div>
                <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-pink-400">⚔️</span>
                    <span className="text-sm text-slate-400">Battles</span>
                  </div>
                  <p className="text-2xl font-bold text-white">{weeklyStats?.battleCount}</p>
                  <p className="text-xs text-slate-500">This week</p>
                </div>
                <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-blue-400">👥</span>
                    <span className="text-sm text-slate-400">Creators</span>
                  </div>
                  <p className="text-2xl font-bold text-white">{weeklyStats?.creatorCount}</p>
                  <p className="text-xs text-slate-500">Active creators</p>
                </div>
              </div>
            </div>

            {/* Agency Goals */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-cyan-400 mb-3">Current Goals</h3>
              {goals.length > 0 ? (
                <div className="space-y-3">
                  {goals.map(goal => (
                    <div key={goal.id} className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-semibold text-white">{goal.title}</h4>
                        <span className="px-2 py-1 text-xs rounded 
                          ${goal.status === 'active' ? 'bg-cyan-500/20 text-cyan-400' : 
                            goal.status === 'completed' ? 'bg-purple-500/20 text-purple-400' : 
                            'bg-slate-500/20 text-slate-400'}">
                          {goal.status.charAt(0).toUpperCase() + goal.status.slice(1)}
                        </span>
                      </div>
                      {goal.description && (
                        <p className="text-slate-300 mb-2 line-clamp-2">{goal.description}</p>
                      )}
                      <div className="flex items-center space-x-3">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-slate-500">Target:</span>
                            <span className="text-xs font-medium text-cyan-400">{goal.target_value}</span>
                          </div>
                        </div>
                        <div className="w-20 text-right">
                          <span className="text-xs font-medium text-cyan-400">
                            {Math.min((goal.progress_value || 0) / goal.target_value * 100, 100)}%
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-700/50 rounded h-1.5 mt-1">
                        <div 
                          className="bg-cyan-500 h-1.5 rounded" 
                          style={{ width: `${Math.min((goal.progress_value || 0) / goal.target_value * 100, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400 text-center py-8">No active goals</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}