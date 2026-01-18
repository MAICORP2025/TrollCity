import React, { memo, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useEquippedVehicle } from '../hooks/useEquippedVehicle'
import { useAuthStore } from '../lib/store'

const DrivingScene = memo(() => {
  const location = useLocation()
  const { user } = useAuthStore()
  const { vehicle } = useEquippedVehicle()
  const containerRef = useRef<HTMLDivElement>(null)

  const cityVideoUrl = '/assets/driving_scene.mp4'
  const cityPosterUrl = '/assets/driving_scene.jpg'

  const isAuthPage = location.pathname.startsWith('/auth')
  const isLandingPage = location.pathname === '/'

  const hasVehicle = useMemo(() => Boolean(vehicle), [vehicle])

  const showOnRoutes = useMemo(() => {
    return !isAuthPage && !!user && hasVehicle
  }, [isAuthPage, user, hasVehicle])

  const destinationLabel = useMemo(() => {
    const path = location.pathname
    if (path.startsWith('/trollcourt')) return 'Troll Court'
    if (path.startsWith('/broadcast')) return 'Live Broadcast'
    if (path.startsWith('/market')) return 'Marketplace'
    if (path.startsWith('/garage')) return 'Garage'
    if (path.startsWith('/trollstown')) return 'Trolls Town'
    return 'Downtown'
  }, [location.pathname])

  const [speed, setSpeed] = useState(0)

  useEffect(() => {
    if (!showOnRoutes) return

    setSpeed(0)
    const t1 = window.setTimeout(() => setSpeed(0.75), 120)
    const t2 = window.setTimeout(() => setSpeed(1), 650)

    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [location.pathname, showOnRoutes])

  if (!showOnRoutes || isAuthPage) return null

  const laneOpacity = 0.22 + speed * 0.18
  const blurOpacity = 0.1 + speed * 0.18

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none transition-opacity duration-1000"
      style={{ opacity: isLandingPage ? 0.3 : 1 }}
      aria-hidden="true"
    >
      <video
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 w-full h-full object-cover scale-[1.06]"
        poster={cityPosterUrl}
      >
        <source src={cityVideoUrl} type="video/mp4" />
      </video>

      <div className="absolute inset-0 z-[1] bg-black/35" />
      <div
        className="absolute inset-0 z-[2]"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(0,0,0,0.0) 0%, rgba(0,0,0,0.35) 60%, rgba(0,0,0,0.65) 100%)',
        }}
      />

      <div className="absolute inset-0 z-[3]">
        <div
          className="absolute bottom-[-20%] left-1/2 -translate-x-1/2 w-[140%] h-[70%]"
          style={{
            background:
              'linear-gradient(to top, rgba(255,255,255,0.06), rgba(255,255,255,0.00) 70%)',
            transform: 'translateX(-50%) perspective(900px) rotateX(55deg)',
            borderRadius: '40%',
            filter: `blur(${2 + speed * 2}px)`,
          }}
        />

        <div
          className="absolute bottom-[-10%] left-1/2 -translate-x-1/2 w-[10px] h-[85%] opacity-80"
          style={{
            transform: 'translateX(-50%) perspective(900px) rotateX(55deg)',
          }}
        >
          <div
            className="w-full h-full"
            style={{
              background:
                'repeating-linear-gradient(to bottom, rgba(255,255,255,0.85) 0 26px, rgba(255,255,255,0) 26px 56px)',
              animation: `laneMove ${1.1 - speed * 0.55}s linear infinite`,
              opacity: laneOpacity,
              filter: `blur(${0.6 + speed * 0.8}px)`,
            }}
          />
        </div>

        {['-140px', '140px'].map((x) => (
          <div
            key={x}
            className="absolute bottom-[-10%] left-1/2 -translate-x-1/2 w-[6px] h-[75%]"
            style={{
              transform: `translateX(calc(-50% + ${x})) perspective(900px) rotateX(55deg)`,
              opacity: laneOpacity * 0.75,
              background:
                'linear-gradient(to bottom, rgba(255,255,255,0.0), rgba(255,255,255,0.25), rgba(255,255,255,0.0))',
              filter: `blur(${1.2 + speed * 1.6}px)`,
              animation: `lanePulse ${2.8 - speed * 1.2}s ease-in-out infinite`,
            }}
          />
        ))}
      </div>

      <div className="absolute inset-0 z-[4]">
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(90deg, rgba(255,255,255,0.0), rgba(255,255,255,0.16), rgba(255,255,255,0.0))',
            opacity: blurOpacity,
          }}
        />
      </div>

      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[5] text-[10px] tracking-[0.3em] uppercase text-white/50">
        <span>Driving to {destinationLabel}</span>
      </div>
    </div>
  )
})

DrivingScene.displayName = 'DrivingScene'

export default DrivingScene
