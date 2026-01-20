import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../lib/store';
import MoneyRain from '../components/MoneyRain';

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [isEntering, setIsEntering] = useState(false);

  const handleEnterTrollCity = () => {
    setIsEntering(true);
    setTimeout(() => {
      if (user) {
        navigate('/live');
      } else {
        navigate('/auth');
      }
    }, 2500); // Wait for animation
  };

  return (
    <div className="min-h-screen w-screen bg-black overflow-hidden relative flex items-center justify-center font-sans">
      {/* Money Rain Effect - Triggers on Enter */}
      {isEntering && <MoneyRain />}

      {/* Full Screen Hero Image Container */}
      {/* 
        INSTRUCTION FOR USER: 
        Please save your provided landing page image as 'landing-hero.png' 
        in the 'public/assets/' directory.
      */}
      <div className="absolute inset-0 z-0 flex items-center justify-center bg-black">
        <img 
          src="/assets/landing-hero.png" 
          alt="Troll City - Get Paid 2X Weekly"
          className="w-full h-full object-contain"
          onError={(e) => {
            // Fallback visual if image is missing
            e.currentTarget.style.display = 'none';
            const fallback = document.getElementById('hero-fallback');
            if (fallback) fallback.style.display = 'flex';
          }}
        />
        {/* Fallback Content */}
        <div id="hero-fallback" className="hidden flex-col items-center justify-center text-center p-4">
           <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 mb-4">TROLL CITY</h1>
           <p className="text-white text-xl mb-8">Please save your image to public/assets/landing-hero.png</p>
           <button 
             onClick={handleEnterTrollCity}
             className="px-8 py-3 bg-purple-600 rounded-full text-white font-bold hover:bg-purple-500"
           >
             Enter City
           </button>
        </div>
      </div>

      {/* Interactive Layer */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        {/* 
          We place a large transparent clickable area at the bottom to catch clicks 
          on the image's "Enter City" button, regardless of exact position.
          We also add a visible glowing pulse to guide attention if needed, 
          but keeping it invisible to respect the design.
        */}
        <div 
          onClick={handleEnterTrollCity}
          className="absolute bottom-0 left-0 right-0 h-[25%] cursor-pointer pointer-events-auto flex items-center justify-center group"
        >
          {/* Optional: Add a subtle hover effect to indicate interactivity */}
          <div className="w-[300px] h-[80px] rounded-full bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />
        </div>
      </div>
    </div>
  );
}
