import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { DRIVER_TEST_QUESTIONS, DRIVER_TEST_PASSING_SCORE } from '@/lib/licenseUtils'
import { useDriverTest } from '@/lib/hooks/useVehicleSystem'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ShieldCheck, Route, Car, AlertTriangle, Sparkles, CheckCircle } from 'lucide-react'

const TEST_RULES = [
  'Stop fully at every Troll Stop sign and yield to pedestrians, maintenance carts, and patrol bots.',
  'Respect the posted Troll City speed limits: 20 in neighborhoods, 35 downtown, and 55 on expressways.',
  'No street racing or reckless maneuvers in the docks, marketplace, or residential districts.',
  'Valid car insurance is required before you drive. Uninsured driving can suspend your license.',
  'Use headlights in tunnels, at night, and during heavy fog near the industrial quarter.'
]

const CORRECT_ANSWERS = DRIVER_TEST_QUESTIONS.map((item) => item.correct)

export default function DriverTest() {
  const navigate = useNavigate()
  const { license, takeTest, loading } = useDriverTest()
  const [started, setStarted] = useState(false)
  const [answers, setAnswers] = useState<number[]>([])
  const [submitted, setSubmitted] = useState(false)
  const [result, setResult] = useState<{ score: number; passed: boolean; message?: string } | null>(null)
  const [showCelebration, setShowCelebration] = useState(false)
  const [celebrationComplete, setCelebrationComplete] = useState(false)

  const passingScore = Math.ceil(DRIVER_TEST_QUESTIONS.length * DRIVER_TEST_PASSING_SCORE)

  const handleStart = () => {
    setStarted(true)
    setSubmitted(false)
    setResult(null)
    setAnswers([])
  }

  const handleAnswer = (questionIndex: number, optionIndex: number) => {
    setAnswers((current) => {
      const next = [...current]
      next[questionIndex] = optionIndex
      return next
    })
  }

  const handleSubmit = async () => {
    if (answers.length !== DRIVER_TEST_QUESTIONS.length || answers.some((answer) => answer === undefined)) {
      toast.error('Please answer every question before submitting the test.')
      return
    }

    setSubmitted(true)
    const response = await takeTest(answers, CORRECT_ANSWERS)
    if (!response.success) {
      toast.error('Unable to submit the test. Please try again.')
      return
    }

    setResult({ score: response.score, passed: response.passed, message: response.message })

    if (response.passed) {
      // Trigger Troll City celebration animation
      setShowCelebration(true)
      setTimeout(() => {
        setCelebrationComplete(true)
        // Auto-navigate after celebration
        setTimeout(() => {
          navigate('/neighborhood-setup')
        }, 2000)
      }, 3000)
    }
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="rounded-3xl border border-slate-700 bg-slate-950/90 p-8 shadow-lg shadow-slate-900/30">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/10 px-3 py-1 text-sm font-semibold text-blue-300">
              <Car size={16} /> Troll City Driver Test
            </div>
            <h1 className="mt-4 text-3xl font-bold text-white">Know the rules before you drive</h1>
            <p className="mt-2 text-slate-400">This quiz covers Troll City street rules, patrol enforcement, and safe neighborhood driving.</p>
          </div>
          <div className="space-y-2 text-right">
            <div className="text-sm text-slate-400">Passing score: {passingScore}/{DRIVER_TEST_QUESTIONS.length}</div>
            {license ? (
              <Badge variant="outline" className="text-white border-slate-600 bg-slate-900/80">
                {license.status === 'active' ? 'Licensed' : 'License inactive'}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-slate-200 border-slate-600 bg-slate-900/80">
                No license yet
              </Badge>
            )}
          </div>
        </div>

        {!started ? (
          <div className="mt-10 space-y-6">
            <div className="rounded-3xl border border-slate-700 bg-slate-900/80 p-6">
              <h2 className="text-xl font-semibold text-white">Troll City Driving Rules</h2>
              <ul className="mt-4 grid gap-3 text-slate-300 list-disc list-inside">
                {TEST_RULES.map((rule, index) => (
                  <li key={index} className="leading-7">{rule}</li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button onClick={() => navigate('/neighborhood-setup')} variant="secondary" className="w-full sm:w-auto">
                Back to Neighborhood
              </Button>
              <Button onClick={handleStart} className="w-full sm:w-auto">
                Start Troll City Test
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-10 space-y-6">
            <div className="rounded-3xl border border-slate-700 bg-slate-900/80 p-6">
              <div className="mb-4 flex items-center gap-2 text-slate-400">
                <Route size={18} /> Answer all questions below.
              </div>
              <div className="grid gap-6">
                {DRIVER_TEST_QUESTIONS.map((item, index) => (
                  <div key={index} className="rounded-3xl border border-slate-800 bg-slate-950 p-5">
                    <div className="text-sm font-semibold text-white">{index + 1}. {item.question}</div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {item.options.map((option, optionIndex) => (
                        <button
                          key={optionIndex}
                          type="button"
                          onClick={() => handleAnswer(index, optionIndex)}
                          className={`rounded-2xl border px-4 py-3 text-left transition ${answers[index] === optionIndex ? 'border-blue-400 bg-blue-500/10 text-white' : 'border-slate-700 bg-slate-900/80 text-slate-300 hover:border-slate-500'}`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                <Button onClick={handleSubmit} disabled={submitted || loading} className="w-full sm:w-auto">
                  Submit Test
                </Button>
                <Button variant="secondary" onClick={handleStart} className="w-full sm:w-auto">
                  Restart Rules
                </Button>
              </div>
            </div>
          </div>
        )}

        {result && (
          <div className={`mt-6 rounded-3xl border p-5 ${result.passed ? 'border-emerald-500 bg-emerald-950/40' : 'border-red-500 bg-red-950/40'}`}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-white">{result.passed ? 'You passed!' : 'Not passed yet'}</p>
                <p className="mt-2 text-slate-300">Score: {result.score}/{DRIVER_TEST_QUESTIONS.length}</p>
              </div>
              <div className="text-3xl">{result.passed ? <ShieldCheck className="text-emerald-400" /> : <AlertTriangle className="text-red-400" />}</div>
            </div>
            <p className="mt-4 text-slate-300">
              {result.message || (result.passed ? 'Great work! You now understand Troll City driving rules and can proceed to get insured and drive safely.' : 'Review the rules again, then try the Troll City driver test once more.')}
            </p>
          </div>
        )}

        {/* Troll City Celebration Animation */}
        {showCelebration && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="relative text-center">
              {/* Animated sparkles */}
              <div className="absolute -inset-20">
                {[...Array(12)].map((_, i) => (
                  <Sparkles
                    key={i}
                    className={`absolute text-yellow-400 animate-pulse`}
                    style={{
                      left: `${20 + Math.random() * 60}%`,
                      top: `${20 + Math.random() * 60}%`,
                      animationDelay: `${i * 0.2}s`,
                      animationDuration: '2s'
                    }}
                    size={24}
                  />
                ))}
              </div>

              {/* Main celebration content */}
              <div className="relative z-10 rounded-3xl border border-emerald-400 bg-emerald-950/90 p-8 shadow-2xl shadow-emerald-500/30">
                <div className="mb-6 flex justify-center">
                  <div className="relative">
                    <CheckCircle className="text-6xl text-emerald-400" />
                    <div className="absolute -inset-4 animate-ping rounded-full border-2 border-emerald-400 opacity-20"></div>
                  </div>
                </div>

                <h2 className="mb-4 text-3xl font-bold text-white">🎉 LICENSE GRANTED! 🎉</h2>
                <p className="mb-6 text-lg text-emerald-200">
                  Welcome to Troll City drivers! Your license is now active.
                </p>

                {!celebrationComplete ? (
                  <div className="flex items-center justify-center gap-2 text-emerald-300">
                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-emerald-400"></div>
                    Preparing your Troll City access...
                  </div>
                ) : (
                  <div className="animate-bounce text-emerald-300">
                    🚗 Entering Troll City streets...
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
