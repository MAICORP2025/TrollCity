// ============================================================
// USE PAGE VISIBILITY HOOK
// ============================================================
// Hook that checks if the current route is under construction
// and redirects non-admin users to the UC page.
// Admins can always access all pages.
// ============================================================

import { useEffect, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';
import { fetchUnderConstructionPages } from '@/services/pageVisibilityService';

interface UcCheckResult {
  isUnderConstruction: boolean;
  isLoading: boolean;
  ucPages: Set<string>;
  refresh: () => Promise<void>;
}

/**
 * Hook that provides UC state for the current route.
 * Returns whether the current page is under construction.
 */
export function usePageVisibility(): UcCheckResult {
  const location = useLocation();
  const { profile } = useAuthStore();
  const [ucPages, setUcPages] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  const isAdmin = profile?.is_admin === true
    || profile?.role === 'admin'
    || profile?.role === 'superadmin'
    || profile?.role === 'ceo';

  const refresh = useCallback(async () => {
    try {
      const pages = await fetchUnderConstructionPages();
      const paths = new Set(pages.map(p => p.route_path));
      setUcPages(paths);
    } catch (err) {
      console.error('[usePageVisibility] Failed to fetch UC pages:', err);
      setUcPages(new Set());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Check if current path matches any UC page
  const currentPath = location.pathname;
  const isUnderConstruction = !isAdmin && !isLoading && ucPages.has(currentPath);

  return {
    isUnderConstruction,
    isLoading,
    ucPages,
    refresh,
  };
}

/**
 * Hook that redirects non-admin users away from UC pages.
 * Place this in a layout or wrapper component.
 */
export function useUcRedirect(): boolean {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useAuthStore();
  const [shouldRedirect, setShouldRedirect] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  const isAdmin = profile?.is_admin === true
    || profile?.role === 'admin'
    || profile?.role === 'superadmin'
    || profile?.role === 'ceo';

  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (isAdmin) {
        if (!cancelled) setIsChecking(false);
        return;
      }

      try {
        const { isRouteUnderConstruction } = await import('@/services/pageVisibilityService');
        const isUc = await isRouteUnderConstruction(location.pathname);
        if (!cancelled) {
          setShouldRedirect(isUc);
          setIsChecking(false);
        }
      } catch {
        if (!cancelled) setIsChecking(false);
      }
    }

    check();
    return () => { cancelled = true; };
  }, [location.pathname, isAdmin]);

  useEffect(() => {
    if (shouldRedirect) {
      navigate(`/under-construction?path=${encodeURIComponent(location.pathname)}`, { replace: true });
    }
  }, [shouldRedirect, navigate, location.pathname]);

  return isChecking;
}
