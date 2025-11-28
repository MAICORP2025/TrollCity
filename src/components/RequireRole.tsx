import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../lib/store';

interface RequireRoleProps {
  roles: string[];
  children: React.ReactNode;
}

const RequireRole: React.FC<RequireRoleProps> = ({ roles, children }) => {
  const { profile } = useAuthStore();

  if (!roles.includes(profile?.role || '')) {
    return <Navigate to="/access-denied" replace />;
  }
  return <>{children}</>;
};

export default RequireRole;