import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useAuthStore } from '../../lib/store';
import { cars } from '../../data/vehicles';
import DrivingBackgroundScene from './DrivingBackgroundScene';
import { supabase } from '../../lib/supabase';

interface DrivingAnimationProps {
  destination: string;
  onComplete: () => void;
  isRaid?: boolean;
}

export default function DrivingAnimation({ destination, onComplete, isRaid = false }: DrivingAnimationProps) {
  const [raidAlert, setRaidAlert] = useState(false);
  const { user, profile } = useAuthStore();
  const [driveSpeed, setDriveSpeed] = useState(60);
  const [_, setPrefersReducedMotion] = useState(false);
  const [windowTintPercent, setWindowTintPercent] = useState<number | null>(null);
  const [activeUserCar, setActiveUserCar] = useState<any>(null);

  useEffect(() => {
    document.body.classList.add('no-scroll');
    return () => {
      document.body.classList.remove('no-scroll');
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(media.matches);
    const handler = () => setPrefersReducedMotion(media.matches);
    media.addEventListener?.('change', handler);
    return () => media.removeEventListener?.('change', handler);
  }, []);

  // Fetch active car from DB to get latest customizations
  useEffect(() => {
    if (!user?.id) return;
    
    const fetchActiveCar = async () => {
      try {
        const { data } = await supabase
          .from('user_cars')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle();
          
        if (data) {
          setActiveUserCar(data);
          // Set tint from DB if available
          if (data.customization_json?.tint) {
             setWindowTintPercent(data.customization_json.tint);
          }
        }
      } catch (err) {
        console.error('Error fetching active car:', err);
      }
    };
    
    fetchActiveCar();
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
        if (!activeUserCar) setWindowTintPercent(null);
        return;
    }

    // Fallback to local storage if DB fetch hasn't happened or failed/empty, 
    // but DB takes precedence if activeUserCar is set
    if (!activeUserCar) {
        try {
            const raw = localStorage.getItem(`trollcity_car_${user.id}`);
            if (!raw) {
                setWindowTintPercent(null);
                return;
            }
            const stored = JSON.parse(raw);
            if (stored && typeof stored.windowTintPercent === 'number') {
                const clamped = Math.min(40, Math.max(5, stored.windowTintPercent));
                setWindowTintPercent(clamped);
            } else {
                setWindowTintPercent(null);
            }
        } catch {
            setWindowTintPercent(null);
        }
    }
  }, [user?.id, activeUserCar]);

  useEffect(() => {
    // Determine speed based on active car (DB or profile/local)
    const getCarSpeed = () => {
        if (activeUserCar) {
            const carDef = cars.find(c => c.id === activeUserCar.car_id);
            if (carDef) return carDef.speed;
        }
        
        // Fallback
        if (!user?.id) return 60;
        try {
            const raw = localStorage.getItem(`trollcity_car_${user.id}`);
            const stored = raw ? JSON.parse(raw) : null;
            const activeId = profile?.active_vehicle ?? stored?.carId;
            const car = cars.find(entry => entry.id === activeId);
            return car ? car.speed : 60;
        } catch {
            return 60;
        }
    };
    
    setDriveSpeed(getCarSpeed());
  }, [user?.id, profile?.active_vehicle, activeUserCar]);

  useEffect(() => {
    // Simple timer based on speed, max 5s, min 3s
    const duration = Math.max(3000, 5000 - (driveSpeed * 10));
    const timer = setTimeout(() => {
      onComplete();
    }, duration);
    return () => clearTimeout(timer);
  }, [driveSpeed, onComplete]);

  useEffect(() => {
    if (!isRaid) return;

    const baseDuration = 5200 - driveSpeed * 18;
    const duration = Math.max(1800, Math.min(5200, baseDuration));
    const timeout = window.setTimeout(() => {
      setRaidAlert(true);
    }, duration / 2);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [isRaid, driveSpeed]);

  const resolvedCar = useMemo(() => {
    // Priority: DB Active Car -> Profile Active Car -> Local Storage
    if (activeUserCar) {
        const carDef = cars.find(c => c.id === activeUserCar.car_id);
        if (carDef) {
            // Merge customization
            return {
                ...carDef,
                colorFrom: activeUserCar.customization_json?.color || carDef.colorFrom,
                modelUrl: activeUserCar.model_url
                // Add other overrides if needed
            };
        }
    }

    if (!user?.id) return null;
    const raw = localStorage.getItem(`trollcity_car_${user.id}`);
    const stored = raw ? JSON.parse(raw) : null;
    const activeId = profile?.active_vehicle ?? stored?.carId;
    return cars.find(entry => entry.id === activeId);
  }, [user?.id, profile?.active_vehicle, activeUserCar]);

  const vehicleType = useMemo(() => {
    if (!resolvedCar?.style) return 'car';
    const style = resolvedCar.style.toLowerCase();
    if (style.includes('motorcycle') || style.includes('bike')) return 'motorcycle';
    if (style.includes('suv') || style.includes('crossover')) return 'suv';
    if (style.includes('truck') || style.includes('armored') || style.includes('enforcement')) return 'truck';
    if (style.includes('super') || style.includes('hyper') || style.includes('exotic')) return 'supercar';
    return 'car';
  }, [resolvedCar]);

  const activeCarColor = resolvedCar?.colorFrom || '#8b5cf6';
  const activeModelUrl = resolvedCar?.modelUrl;

  return (
    <div className="fixed inset-0 z-[9999] flex min-h-[100dvh] w-full flex-col items-center justify-center overflow-hidden bg-[#050b1e]">
      <DrivingBackgroundScene
        destination={destination.toLowerCase()}
        carColor={activeCarColor}
        carSpeed={driveSpeed}
        vehicleType={vehicleType}
        windowTintPercent={windowTintPercent ?? 20}
        modelUrl={activeModelUrl}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#020617]/20 via-transparent to-[#020617]/60" />

      {raidAlert && (
        <div className="absolute top-8 z-50 rounded-lg bg-red-600/90 text-white px-5 py-3 shadow-lg">
          <div className="flex items-center gap-2">
            <AlertTriangle size={20} className="text-yellow-200" />
            <span className="font-semibold">Road threat detected</span>
          </div>
        </div>
      )}

      <div className="relative z-10 flex flex-col items-center justify-end pb-20 h-full w-full pointer-events-none">
         <div className="flex flex-col items-center bg-black/40 backdrop-blur-sm p-6 rounded-xl border border-white/10">
           <h2 className="text-3xl font-bold text-white mb-3 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] tracking-wider">
              DRIVING TO {destination.toUpperCase()}
           </h2>
           <div className="h-1.5 w-64 bg-gray-800/50 rounded-full overflow-hidden border border-white/5">
              <div 
                className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" 
                style={{
                  width: '100%',
                  animation: 'driving-progress 4s linear forwards'
                }} 
              />
           </div>
           <style>{`
             @keyframes driving-progress {
               from { width: 0%; }
               to { width: 100%; }
             }
           `}</style>
         </div>
      </div>
    </div>
  );
}
