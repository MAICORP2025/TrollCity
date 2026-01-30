
import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../lib/store';


import GameTrollzLayout from '../components/GameTrollzLayout';
import { StreamTab, LinksTab, SettingsTab, ClipsTab, OverviewTab, TournamentsTab, RulesTab, PayoutsTab } from './gameTabs';

export default function GameTrollzPage() {
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const profile = useAuthStore((s) => s.profile);
   const [activeTab, setActiveTab] = useState('overview');
 
   // If user is not a gamer/streamer (no application, no streamer role), show StreamsGrid always
   const isGamer = profile?.troll_role === 'gamer' || profile?.is_broadcaster || profile?.is_troller;
   if (!isGamer) {
     return <StreamsGrid />;
   }
  if (!isLoading && !user) return <Navigate to="/login" replace />;

  // Render all content inside the shared layout
  return (
    <GameTrollzLayout activeTab={activeTab} setActiveTab={setActiveTab}>
      {activeTab === 'overview' ? (
        <OverviewTab />
      ) : activeTab === 'stream' ? (
        <StreamTab profile={profile} user={user} />
      ) : activeTab === 'clips' ? (
        <ClipsTab user={user} />
      ) : activeTab === 'links' ? (
        <LinksTab profile={profile} />
      ) : activeTab === 'tournaments' ? (
        <TournamentsTab />
      ) : activeTab === 'rules' ? (
        <RulesTab />
      ) : activeTab === 'payouts' ? (
        <PayoutsTab />
      ) : activeTab === 'settings' ? (
        <SettingsTab profile={profile} user={user} />
      ) : (
        <div>{/* Content for {activeTab} */}</div>
      )}
    </GameTrollzLayout>
  );
}

