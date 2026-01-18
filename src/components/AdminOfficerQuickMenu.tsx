import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../lib/store';
import { UserRole } from '../lib/supabase';

const AdminOfficerQuickMenu: React.FC = () => {
  const { profile, showLegacySidebar, setShowLegacySidebar } = useAuthStore();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  if (!profile) return null;

  const isAdmin = profile.role === UserRole.ADMIN || profile.is_admin;
  const isLeadOfficer = profile.role === UserRole.LEAD_TROLL_OFFICER || profile.is_lead_officer;
  const isOfficer = profile.role === UserRole.TROLL_OFFICER || profile.is_troll_officer;
  const isHR = profile.role === UserRole.HR_ADMIN;

  if (!isAdmin && !isLeadOfficer && !isOfficer && !isHR) return null;

  const getDashboardPath = () => {
    if (isAdmin) return '/admin';
    if (isLeadOfficer) return '/lead-officer';
    if (isOfficer) return '/officer/dashboard';
    if (isHR) return '/admin/hr';
    return '/';
  };

  const getRoleLabel = () => {
    if (isAdmin) return 'Admin';
    if (isLeadOfficer) return 'Lead Officer';
    if (isOfficer) return 'Officer';
    if (isHR) return 'HR Admin';
    return '';
  };

  const quickActions = [
    {
      label: showLegacySidebar ? 'Switch to Game Hub View (Hide Sidebar)' : 'Switch to Legacy Sidebar View',
      action: () => setShowLegacySidebar(!showLegacySidebar),
      icon: '🎮'
    },
    {
      label: 'Go to Dashboard',
      action: () => navigate(getDashboardPath()),
      icon: '📊'
    },
    ...(isAdmin ? [
      // Core
      { label: 'Admin HQ', action: () => navigate('/admin/control-panel'), icon: '🎛️' },
      { label: 'City Control Center', action: () => navigate('/admin/system/health'), icon: '🏥' },
      
      // Management
      { label: 'User Search', action: () => navigate('/admin/user-search'), icon: '🔍' },
      { label: 'Ban Management', action: () => navigate('/admin/ban-management'), icon: '🔨' },
      { label: 'Role Management', action: () => navigate('/admin/role-management'), icon: '👥' },
      { label: 'Officer Operations', action: () => navigate('/admin/officer-operations'), icon: '👮' },
      { label: 'Officer Shifts', action: () => navigate('/admin/officer-shifts'), icon: '📅' },
      
      // Finance
      { label: 'Economy Dashboard', action: () => navigate('/admin/economy'), icon: '💰' },
      { label: 'Finance & Cashouts', action: () => navigate('/admin/finance'), icon: '💸' },
      { label: 'Grant Coins', action: () => navigate('/admin/grant-coins'), icon: '🪙' },
      
      // Content & Apps
      { label: 'Reports Queue', action: () => navigate('/admin/reports-queue'), icon: '📋' },
      { label: 'Applications', action: () => navigate('/admin/applications'), icon: '📝' },
      { label: 'Empire Applications', action: () => navigate('/admin/empire-applications'), icon: '🏰' },
      { label: 'Marketplace', action: () => navigate('/admin/marketplace'), icon: '🛍️' },
      { label: 'Support Tickets', action: () => navigate('/admin/support-tickets'), icon: '🎫' },
      
      // System
      { label: 'System Config', action: () => navigate('/admin/system/config'), icon: '⚙️' },
      { label: 'Database Backup', action: () => navigate('/admin/system/backup'), icon: '💾' },
      { label: 'Test Diagnostics', action: () => navigate('/admin/test-diagnostics'), icon: '🧪' },
    ] : []),
    ...((isOfficer || isLeadOfficer) ? [
      { label: 'Moderation', action: () => navigate('/officer/moderation'), icon: '🛡️' },
      { label: 'Officer Lounge', action: () => navigate('/officer/lounge'), icon: '🏢' },
      { label: 'OWC Dashboard', action: () => navigate('/officer/owc'), icon: '⭐' }
    ] : []),
    ...(isHR ? [
      { label: 'HR Dashboard', action: () => navigate('/admin/hr'), icon: '👥' }
    ] : [])
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 bg-[#1a1a1a] hover:bg-[#2a2a2a] rounded-lg border border-[#333] transition-colors"
      >
        <span className="text-sm text-gray-300">{getRoleLabel()}</span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 right-0 w-64 bg-[#1a1a1a] border border-[#333] rounded-lg shadow-lg z-50 max-h-[80vh] overflow-y-auto custom-scrollbar">
          <div className="py-2">
            {quickActions.map((action, index) => (
              <button
                key={index}
                onClick={() => {
                  action.action();
                  setIsOpen(false);
                }}
                className="w-full px-4 py-3 text-left hover:bg-[#2a2a2a] transition-colors flex items-center space-x-3"
              >
                <span className="text-lg">{action.icon}</span>
                <span className="text-sm text-gray-300">{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Click outside to close */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

export default AdminOfficerQuickMenu;
