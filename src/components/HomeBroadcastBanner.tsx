import { useEffect, useState } from 'react';
import { X, Radio, Users, Gift } from 'lucide-react';

const STORAGE_KEY = 'homeBroadcastBannerLastShown';

const HomeBroadcastBanner: React.FC = () => {
  const [show, setShow] = useState(false);

  const safeLocalStorageGet = (key: string) => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return null;
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  };

  const safeLocalStorageSet = (key: string, value: string) => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      localStorage.setItem(key, value);
    } catch {
      // ignore storage failures
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const lastShown = safeLocalStorageGet(STORAGE_KEY);
    const today = new Date().toISOString().slice(0, 10);

    if (lastShown !== today) {
      setShow(true);
      safeLocalStorageSet(STORAGE_KEY, today);
    }
  }, []);

  const handleDismiss = () => setShow(false);

  if (!show) return null;

  return (
    <div className="relative z-40 w-full bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600">
      <div className="mx-auto max-w-screen-2xl px-4 py-3 flex items-center gap-3">
        <Radio className="w-6 h-6 shrink-0 text-white/90" />
        <p className="flex-1 text-sm sm:text-base text-white font-medium leading-snug">
          <span className="font-bold">All are welcome to start broadcasting!</span>{' '}
          Tell your friends, help grow the city, and earn money.
        </p>
        <Users className="hidden sm:block w-5 h-5 shrink-0 text-white/80" />
        <Gift className="hidden sm:block w-5 h-5 shrink-0 text-white/80" />
        <button
          onClick={handleDismiss}
          className="shrink-0 text-white/80 hover:text-white transition-colors"
          aria-label="Dismiss banner"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default HomeBroadcastBanner;
