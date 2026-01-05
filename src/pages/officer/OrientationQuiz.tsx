import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { CheckCircle } from 'lucide-react'

interface QuizQuestion {
  id: string
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  category: string
  order_index: number
  correct_answer?: string  // For text-based answers
}

interface OrientationStatus {
  status: string
  attempts: number
  max_attempts: number
}

export default function OrientationQuiz() {
  const { profile, user } = useAuthStore()
  const navigate = useNavigate()
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [quizStarted, setQuizStarted] = useState(false)
  const [quizTimeStart, setQuizTimeStart] = useState<number | null>(null)
  const [orientationStatus, setOrientationStatus] = useState<OrientationStatus | null>(null)

  const loadOrientationStatus = useCallback(async () => {
    if (!user?.id) return
    try {
      const { data, error } = await supabase.rpc('get_officer_orientation_status', {
        p_user_id: user.id
      })

      if (error) throw error
      if (data) {
        setOrientationStatus(data as OrientationStatus)
        
        // Check if max attempts reached
        if (data.status === 'failed') {
          toast.error('Maximum attempts reached. Please contact an administrator.')
          navigate('/officer/orientation')
          return
        }

        // Check if already passed
        if (data.status === 'passed') {
          toast.success('You have already passed the orientation!')
          navigate('/officer/lounge')
          return
        }
      }
    } catch (err: unknown) {
      console.error('Error loading orientation status:', err)
    }
  }, [user?.id, navigate])

  const startOrientation = useCallback(async () => {
    if (!user?.id) return
    try {
      const { data, error } = await supabase.rpc('start_officer_orientation', {
        p_user_id: user.id
      })

      if (error) throw error
      if (data?.success) {
        setQuizStarted(true)
        setQuizTimeStart(Date.now())
        await loadOrientationStatus()
      }
    } catch (err: unknown) {
      console.error('Error starting orientation:', err)
    }
  }, [user?.id, loadOrientationStatus])

  useEffect(() => {
    if (orientationStatus?.status === 'assigned') {
      startOrientation()
    }
  }, [orientationStatus?.status, startOrientation])

  const loadQuizQuestions = useCallback(async () => {
    setLoading(true)
    try {
      console.log('Loading quiz questions...')
      const { data, error } = await supabase
        .from("officer_quiz_questions")
        .select("id, question_text, correct_answer")

      if (error) {
        console.error('Query error:', error)
        throw error
      }

      console.log('Quiz questions loaded:', data?.length || 0, 'questions')

      if (data && data.length > 0) {
        console.log('Sample question data:', data[0])
        // Map the data to match QuizQuestion interface
        const questionsData = data.map((q: { id: string; question_text: string; correct_answer: string }) => ({
          id: q.id,
          question_text: q.question_text,
          correct_answer: q.correct_answer,
          category: '', // Not needed for text-based quiz
          option_a: '',
          option_b: '',
          option_c: '',
          option_d: '',
          order_index: 0
        })) as QuizQuestion[]
        
        // Log each question to see what fields are available
        questionsData.forEach((q, i) => {
          console.log(`Question ${i + 1}:`, {
            id: q.id,
            question_text: q.question_text,
            correct_answer: q.correct_answer
          })
        })
        setQuestions(questionsData)
        setQuizStarted(true)
        setQuizTimeStart(Date.now())
        console.log('Quiz started with', data.length, 'questions')
      } else {
        console.warn('No quiz questions returned from query')
        toast.error('No quiz questions available')
      }
    } catch (err: unknown) {
      console.error('Error loading quiz questions:', err)
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      toast.error('Failed to load quiz questions: ' + errorMsg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!profile || !user) {
      navigate('/')
      return
    }

    if (!profile.is_troll_officer) {
      toast.error('You must be an approved officer to take the quiz')
      navigate('/')
      return
    }

    loadOrientationStatus()
    loadQuizQuestions()
  }, [profile, user, navigate, loadOrientationStatus, loadQuizQuestions])


  const handleSubmitQuiz = useCallback(async () => {
    if (!user?.id) return

    // Check if all questions are answered
    const unanswered = questions.filter(q => !answers[q.id])
    if (unanswered.length > 0) {
      toast.error(`Please answer all questions. ${unanswered.length} question(s) remaining.`)
      return
    }

    setSubmitting(true)

    const duration = quizTimeStart ? Math.floor((Date.now() - quizTimeStart) / 1000) : 0
    const totalQuestions = questions.length

    // Normalize function for text comparison
    const normalize = (s: string) => s.trim().toLowerCase()

    // Calculate score
    let score = 0
    for (const q of questions) {
      const userAnswer = answers[q.id] || ""
      const correct = q.correct_answer || ""
      if (normalize(userAnswer) === normalize(correct)) {
        score++
      }
    }

    const hasPassed = score >= Math.ceil(totalQuestions * 0.8)

    try {
      // Save answers to officer_orientation_results table
      const { error: saveError } = await supabase
        .from('officer_orientation_results')
        .upsert({
          user_id: user.id,
          score,
          has_passed: hasPassed,
          submitted_answers: answers,
          completed_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })

      if (saveError) {
        console.error('Error saving orientation results:', saveError)
        toast.error('Failed to save quiz results')
      }

      // Also call the RPC function for backward compatibility
      const { data, error } = await supabase.rpc("submit_officer_quiz", {
        p_answers: answers,
        p_time_taken_seconds: duration,
        p_user_id: user.id,
      })

      if (error) {
        console.error("Quiz submission error:", error)
        toast.error("Failed to submit quiz. Try again.")
        setSubmitting(false)
        return
      }

      const passed = data?.passed ?? hasPassed

      if (passed) {
        toast.success("Quiz passed! Redirecting to Lead Officer review...")
        navigate("/lead-officer/review")
      } else {
        toast.error("Quiz failed! Redirecting to application page...")
        navigate("/admin/applications")
      }
    } catch (err: unknown) {
      console.error('Error in quiz submission:', err)
      const message = err instanceof Error ? err.message : 'Failed to submit quiz'
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }, [user?.id, questions, answers, quizTimeStart, navigate])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0814] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p>Loading quiz...</p>
          <p className="text-sm text-gray-400 mt-2">Questions: {questions.length}</p>
        </div>
      </div>
    )
  }

  if (!quizStarted || questions.length === 0) {
    return (
      <div className="min-h-screen bg-[#0A0814] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p>Preparing quiz...</p>
          <p className="text-sm text-gray-400 mt-2">
            Quiz started: {quizStarted ? 'Yes' : 'No'} | Questions loaded: {questions.length}
          </p>
          {questions.length === 0 && (
            <button
              onClick={loadQuizQuestions}
              className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg"
            >
              Retry Loading Questions
            </button>
          )}
        </div>
      </div>
    )
  }

  const allAnswered = questions.every(q => answers[q.id])
  const progress = (Object.keys(answers).length / questions.length) * 100

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-4xl mx-auto">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-400">
              Progress: {Object.keys(answers).length} / {questions.length} answered
            </span>
            <span className="text-sm text-gray-400">
              {orientationStatus?.attempts || 0} / {orientationStatus?.max_attempts || 3} attempts
            </span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
            <motion.div
              className="bg-gradient-to-r from-purple-600 to-pink-600 h-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        {/* Questions */}
        <div className="space-y-6 mb-8">
          {questions.map((question, index) => {
            return (
              <motion.div
                key={question.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-[#1A1A1A] border-2 border-purple-500/30 rounded-xl p-6 hover:border-purple-500/50 transition-all"
              >
                <div className="mb-4">
                  {question.category && (
                    <span className="text-xs text-purple-400 uppercase tracking-wide">{question.category}</span>
                  )}
                  <h3 className="text-xl font-bold mt-2 text-white">
                    {index + 1}. {question.question_text || 'Question text not available'}
                  </h3>
                  {!question.question_text && (
                    <p className="text-sm text-yellow-400 mt-1">⚠️ Question text missing from database</p>
                  )}
                </div>

                <input
                  type="text"
                  className="w-full rounded-lg border border-purple-600 bg-black/40 p-3 text-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-400"
                  placeholder="Type your answer..."
                  value={answers[question.id] || ""}
                  onChange={(e) =>
                    setAnswers((prev) => ({
                      ...prev,
                      [question.id]: e.target.value
                    }))
                  }
                />
              </motion.div>
            )
          })}
        </div>

        {/* Submit Button */}
        <div className="text-center">
          <button
            onClick={handleSubmitQuiz}
            disabled={!allAnswered || submitting}
            className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-xl font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 shadow-lg shadow-purple-500/50 flex items-center gap-3 mx-auto"
          >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Submitting...
              </>
            ) : (
              <>
                <CheckCircle className="w-6 h-6" />
                Submit Quiz
              </>
            )}
          </button>
          {!allAnswered && (
            <p className="text-sm text-yellow-400 mt-4">
              Please answer all {questions.length} questions before submitting
            </p>
          )}
        </div>
      </div>
    </div>
  )
}


