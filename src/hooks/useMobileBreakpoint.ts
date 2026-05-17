import { useState, useEffect } from 'react';

export function useMobileBreakpoint() {
  const [breakpoint, setBreakpoint] = useState<'xs' | 'sm' | 'md' | 'lg' | 'desktop'>('desktop');

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width <= 360) setBreakpoint('xs');
      else if (width <= 480) setBreakpoint('sm');
      else if (width <= 768) setBreakpoint('md');
      else if (width <= 1024) setBreakpoint('lg');
      else setBreakpoint('desktop');
    };

    handleResize(); // Initial check
    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return {
    isMobile: breakpoint === 'xs' || breakpoint === 'sm' || breakpoint === 'md',
    breakpoint,
    isXs: breakpoint === 'xs',
    isSm: breakpoint === 'sm',
    isMd: breakpoint === 'md',
    isLg: breakpoint === 'lg',
    isDesktop: breakpoint === 'desktop'
  };
}
