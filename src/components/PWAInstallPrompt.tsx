/**
 * PWAInstallPrompt Component (Legacy - now using new InstallButton system)
 * This component provides a floating draggable install button for Android/Chrome
 * and auto-shows iOS instructions after a delay
 */

import React, { useEffect, useState } from 'react';
import { X, GripHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useInstallPrompt } from '../pwa/useInstallPrompt';
import { isStandalone, shouldShowIosInstructions } from '../pwa/install';
import IosInstallModal from './IosInstallModal';
import InstallButton from './InstallButton';

export default function PWAInstallPrompt() {
  const { canPromptInstall, promptInstall } = useInstallPrompt();
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const standalone = isStandalone();

  useEffect(() => {
    // Auto-show iOS instructions after delay (only if applicable)
    if (shouldShowIosInstructions() && !isDismissed) {
      const timer = setTimeout(() => {
        setShowIOSPrompt(true);
      }, 3000); // Show after 3 seconds
      
      return () => clearTimeout(timer);
    }
  }, [isDismissed]);

  const handleInstallClick = async () => {
    const outcome = await promptInstall();
    if (outcome === 'accepted') {
      setIsDismissed(true);
    }
  };

  // Don't show if already installed or dismissed
  if (standalone || isDismissed) return null;

  return (
    <>
      {/* Android / Chrome Floating Install Button */}
      <AnimatePresence>
        {canPromptInstall && (
          <motion.div 
            drag
            dragMomentum={false}
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed top-20 right-4 z-[100] cursor-grab active:cursor-grabbing"
            style={{ touchAction: 'none' }}
          >
            <div className="relative group">
              {/* Use new InstallButton component */}
              <div onClick={handleInstallClick}>
                <InstallButton 
                  className="shadow-lg hover:shadow-purple-500/50"
                  text="Install App"
                />
              </div>
              
              {/* Dismiss button */}
              <button 
                onClick={() => setIsDismissed(true)}
                className="absolute -top-2 -right-2 bg-black/60 hover:bg-black rounded-full p-1 border border-white/20 text-white/70 hover:text-white transition-all"
              >
                <X size={12} />
              </button>
              
              {/* Drag handle indicator */}
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 pointer-events-none">
                <GripHorizontal size={16} className="text-white/30" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* iOS Install Instructions Modal (auto-show after delay) */}
      <IosInstallModal
        isOpen={showIOSPrompt}
        onClose={() => setShowIOSPrompt(false)}
        enableDontShowAgain={true}
      />
    </>
  );
}
