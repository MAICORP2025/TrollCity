import React, { useState, useEffect } from 'react'
import { Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'

interface CountdownCardProps {
  targetDate: string
  label: string
}

export default function CountdownCard({ targetDate, label }: CountdownCardProps) {
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number } | null>(null)

  useEffect(() => {
    const calculateTimeLeft = () => {
      const difference = +new Date(targetDate) - +new Date()
      
      if (difference > 0) {
        return {
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
        }
      }
      return null
    }

    setTimeLeft(calculateTimeLeft())

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft())
    }, 1000)

    return () => clearInterval(timer)
  }, [targetDate])

  if (!timeLeft) {
    return (
      <Card className="bg-black/60 border-purple-500/50 backdrop-blur-md shadow-[0_0_20px_rgba(147,51,234,0.2)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold text-gray-400 flex items-center gap-2 uppercase tracking-wider">
            <Clock className="w-4 h-4 text-purple-500" />
            {label}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xl font-bold text-white animate-pulse">Event Started</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-black/60 border-purple-500/50 backdrop-blur-md shadow-[0_0_20px_rgba(147,51,234,0.2)] hover:shadow-[0_0_30px_rgba(147,51,234,0.4)] transition-all duration-300">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold text-purple-300 flex items-center gap-2 uppercase tracking-wider">
          <Clock className="w-4 h-4 text-purple-400 drop-shadow-[0_0_5px_rgba(168,85,247,0.8)]" />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="bg-purple-900/20 rounded-lg p-1 border border-purple-500/20">
            <div className="text-2xl font-black text-white font-mono drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]">{timeLeft.days}</div>
            <div className="text-[9px] text-purple-300/70 uppercase tracking-widest">Days</div>
          </div>
          <div className="bg-purple-900/20 rounded-lg p-1 border border-purple-500/20">
            <div className="text-2xl font-black text-white font-mono drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]">{timeLeft.hours}</div>
            <div className="text-[9px] text-purple-300/70 uppercase tracking-widest">Hrs</div>
          </div>
          <div className="bg-purple-900/20 rounded-lg p-1 border border-purple-500/20">
            <div className="text-2xl font-black text-white font-mono drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]">{timeLeft.minutes}</div>
            <div className="text-[9px] text-purple-300/70 uppercase tracking-widest">Min</div>
          </div>
          <div className="bg-purple-900/20 rounded-lg p-1 border border-purple-500/20">
            <div className="text-2xl font-black text-white font-mono drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]">{timeLeft.seconds}</div>
            <div className="text-[9px] text-purple-300/70 uppercase tracking-widest">Sec</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
