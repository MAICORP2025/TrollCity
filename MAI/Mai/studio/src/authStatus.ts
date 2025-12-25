import { getCurrentUser } from './services/authService';

export const getAuthStatus = async () => {
  const user = await getCurrentUser();
  return {
    isAuthenticated: !!user,
    user,
  };
};