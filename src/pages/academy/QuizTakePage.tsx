import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { getCourseBySlug, getCourseQuizzes, getQuizQuestions, submitQuizAttempt, getStudentQuizAttempts } from '@/services/academyService';
import type { AcademyCourse, AcademyQuiz, AcademyQuizQuestion, AcademyQuizAttempt } from '@/types/academy';
import {
  ChevronLeft, HelpCircle, Clock, CheckCircle, XCircle, AlertTriangle,
  Send, Loader2, Award, BookOpen, ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';

const glass = 'border border-white/10 bg-[#070b19]/70 backdrop-blur-2xl shadow-[0_20px_80px_rgba(0,0,0,0.45)]';

export default function QuizTakePage() {
  const navigate = useNavigate();
  const { slug, quizId } = useParams<{ slug: string; quizId: string }>();
  const { user } = useAuthStore();
  const [course, setCourse] = useState<AcademyCourse | null>(null);
  const [quiz, setQuiz] = useState<AcademyQuiz | null>(null);
  const [questions, setQuestions] = useState<AcademyQuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [started, setStarted] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [result, setResult] = useState<AcademyQuizAttempt | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [attempts, setAttempts] = useState<AcademyQuizAttempt[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!slug || !quizId || !user?.id) return;
      try {
        const courseData = await getCourseBySlug(slug);
        if (!courseData) { navigate('/academy/courses'); return; }
        setCourse(courseData);

        const { data: quizData } = await supabase.from('academy_quizzes').select('*').eq('id', quizId).single();
        setQuiz(quizData);

        const questionsData = await getQuizQuestions(quizId);
        setQuestions(questionsData);

        const attemptsData = await getStudentQuizAttempts(user.id, quizId);
        setAttempts(attemptsData);

        if (quizData.time_limit_minutes) {
          setTimeLeft(quizData.time_limit_minutes * 60);
        }
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetchData();
  }, [slug, quizId, user?.id]);

  useEffect(() => {
    if (!started || timeLeft === null || timeLeft <= 0 || completed) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [started, timeLeft, completed]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleSubmit = async () => {
    if (!quiz || !user?.id || submitting) return;
    setSubmitting(true);
    try {
      let score = 0;
      let totalPoints = 0;
      const gradedAnswers: Record<string, any> = {};

      for (const q of questions) {
        totalPoints += q.points;
        const userAnswer = answers[q.id] || '';
        gradedAnswers[q.id] = { answer: userAnswer, correct: q.correct_answer };

        if (q.question_type === 'multiple_choice' || q.question_type === 'true_false' || q.question_type === 'fill_blank') {
          if (userAnswer.toLowerCase().trim() === (q.correct_answer || '').toLowerCase().trim()) {
            score += q.points;
          }
        }
      }

      const percentage = totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 0;
      const passed = percentage >= quiz.passing_score;

      const attempt = await submitQuizAttempt({
        quiz_id: quiz.id,
        student_id: user.id,
        course_id: course!.id,
        answers: gradedAnswers,
        score,
        percentage,
        passed,
        time_taken_seconds: quiz.time_limit_minutes ? (quiz.time_limit_minutes * 60) - (timeLeft || 0) : null,
        attempt_number: attempts.length + 1,
        started_at: new Date(Date.now() - (quiz.time_limit_minutes ? (quiz.time_limit_minutes * 60) - (timeLeft || 0) : 0) * 1000).toISOString(),
        completed_at: new Date().toISOString(),
      });

      setResult(attempt);
      setCompleted(true);
      toast.success(passed ? 'Quiz passed!' : 'Quiz completed');
    } catch (err: any) { toast.error(err.message || 'Failed to submit'); }
    finally { setSubmitting(false); }
  };

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-300 border-t-transparent" /></div>;
  if (!quiz || !course) return null;

  const canRetake = attempts.length < quiz.max_attempts;
  const lastAttempt = attempts[0];

  if (completed && result) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-4">
        <section className={`${glass} rounded-2xl p-6 text-center`}>
          <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl ${result.passed ? 'bg-emerald-500' : 'bg-red-500'}`}>
            {result.passed ? <CheckCircle className="h-8 w-8 text-white" /> : <XCircle className="h-8 w-8 text-white" />}
          </div>
          <h1 className="mt-4 text-2xl font-black text-white">{result.passed ? 'Passed!' : 'Not Passed'}</h1>
          <p className="mt-2 text-sm text-slate-400">You scored {result.score} points ({result.percentage}%)</p>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-white/[0.04] p-3"><p className="text-lg font-black text-white">{result.score}</p><p className="text-[9px] text-slate-400">Score</p></div>
            <div className="rounded-xl bg-white/[0.04] p-3"><p className="text-lg font-black text-white">{quiz.passing_score}%</p><p className="text-[9px] text-slate-400">Passing</p></div>
            <div className="rounded-xl bg-white/[0.04] p-3"><p className="text-lg font-black text-white">{result.attempt_number}/{quiz.max_attempts}</p><p className="text-[9px] text-slate-400">Attempt</p></div>
          </div>
          {quiz.show_results && (
            <div className="mt-4 space-y-2">
              {questions.map((q, idx) => {
                const userAnswer = answers[q.id] || '';
                const isCorrect = q.question_type === 'essay' || q.question_type === 'practical' ? null :
                  userAnswer.toLowerCase().trim() === (q.correct_answer || '').toLowerCase().trim();
                return (
                  <div key={q.id} className={`rounded-xl p-3 text-left ${isCorrect === true ? 'bg-emerald-500/10 border border-emerald-400/20' : isCorrect === false ? 'bg-red-500/10 border border-red-400/20' : 'bg-white/[0.04]'}`}>
                    <p className="text-xs font-bold text-white">{idx + 1}. {q.question_text}</p>
                    <p className="mt-1 text-[10px] text-slate-400">Your answer: {userAnswer || '(no answer)'}</p>
                    {isCorrect === false && <p className="text-[10px] text-emerald-400">Correct: {q.correct_answer}</p>}
                    {q.explanation && <p className="text-[10px] text-blue-300 mt-1">💡 {q.explanation}</p>}
                  </div>
                );
              })}
            </div>
          )}
          <button onClick={() => navigate(`/academy/course/${slug}`)} className="mt-4 rounded-xl bg-white/[0.06] px-6 py-2 text-xs font-bold text-slate-300">Back to Course</button>
        </section>
      </div>
    );
  }

  if (!started) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-4">
        <button onClick={() => navigate(`/academy/course/${slug}`)} className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-white">
          <ChevronLeft className="h-3.5 w-3.5" /> Back to Course
        </button>
        <section className={`${glass} rounded-2xl p-6 text-center`}>
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600">
            <HelpCircle className="h-8 w-8 text-white" />
          </div>
          <h1 className="mt-4 text-2xl font-black text-white">{quiz.title}</h1>
          {quiz.description && <p className="mt-2 text-sm text-slate-400">{quiz.description}</p>}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-white/[0.04] p-3"><HelpCircle className="mx-auto h-5 w-5 text-indigo-400" /><p className="mt-1 text-sm font-bold text-white">{questions.length}</p><p className="text-[9px] text-slate-400">Questions</p></div>
            <div className="rounded-xl bg-white/[0.04] p-3"><Award className="mx-auto h-5 w-5 text-amber-400" /><p className="mt-1 text-sm font-bold text-white">{quiz.total_points}</p><p className="text-[9px] text-slate-400">Points</p></div>
            <div className="rounded-xl bg-white/[0.04] p-3"><Clock className="mx-auto h-5 w-5 text-cyan-400" /><p className="mt-1 text-sm font-bold text-white">{quiz.time_limit_minutes ? `${quiz.time_limit_minutes} min` : 'No limit'}</p><p className="text-[9px] text-slate-400">Time</p></div>
            <div className="rounded-xl bg-white/[0.04] p-3"><AlertTriangle className="mx-auto h-5 w-5 text-red-400" /><p className="mt-1 text-sm font-bold text-white">{quiz.passing_score}%</p><p className="text-[9px] text-slate-400">Passing</p></div>
          </div>
          {lastAttempt && (
            <div className="mt-4 rounded-xl bg-white/[0.04] p-3">
              <p className="text-xs text-slate-400">Last attempt: <span className={`font-bold ${lastAttempt.passed ? 'text-emerald-400' : 'text-red-400'}`}>{lastAttempt.percentage}% ({lastAttempt.passed ? 'Passed' : 'Failed'})</span></p>
            </div>
          )}
          {canRetake ? (
            <button onClick={() => setStarted(true)} className="mt-6 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-8 py-3 text-sm font-black text-white">
              {attempts.length > 0 ? 'Retake Quiz' : 'Start Quiz'}
            </button>
          ) : (
            <p className="mt-4 text-sm text-red-400">Maximum attempts reached ({quiz.max_attempts})</p>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-black text-white">{quiz.title}</h1>
        {timeLeft !== null && (
          <div className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${timeLeft < 60 ? 'bg-red-500/20 text-red-300' : 'bg-white/10 text-slate-300'}`}>
            <Clock className="h-3 w-3" /> {formatTime(timeLeft)}
          </div>
        )}
      </div>

      <div className="space-y-4">
        {questions.map((q, idx) => (
          <div key={q.id} className={`${glass} rounded-2xl p-4`}>
            <div className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-[10px] font-black text-indigo-300">{idx + 1}</span>
              <div className="flex-1">
                <p className="text-sm font-bold text-white">{q.question_text}</p>
                <p className="text-[9px] text-slate-500 mt-0.5">{q.points} point{q.points !== 1 ? 's' : ''}</p>

                {q.question_type === 'multiple_choice' && (
                  <div className="mt-3 space-y-2">
                    {q.options.map((opt, optIdx) => (
                      <button key={optIdx} onClick={() => setAnswers(prev => ({ ...prev, [q.id]: String(optIdx) }))}
                        className={`flex w-full items-center gap-2 rounded-lg p-2.5 text-left text-xs transition ${answers[q.id] === String(optIdx) ? 'bg-indigo-500/20 border border-indigo-400/30 text-white' : 'bg-white/[0.04] border border-white/10 text-slate-300 hover:bg-white/[0.08]'}`}>
                        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[9px] font-bold ${answers[q.id] === String(optIdx) ? 'border-indigo-400 bg-indigo-500 text-white' : 'border-white/20 text-slate-500'}`}>
                          {String.fromCharCode(65 + optIdx)}
                        </span>
                        {opt}
                      </button>
                    ))}
                  </div>
                )}

                {q.question_type === 'true_false' && (
                  <div className="mt-3 flex gap-2">
                    {['True', 'False'].map(val => (
                      <button key={val} onClick={() => setAnswers(prev => ({ ...prev, [q.id]: val }))}
                        className={`rounded-lg px-4 py-2 text-xs font-bold transition ${answers[q.id] === val ? 'bg-indigo-500 text-white' : 'bg-white/[0.06] text-slate-400'}`}>
                        {val}
                      </button>
                    ))}
                  </div>
                )}

                {(q.question_type === 'fill_blank' || q.question_type === 'essay' || q.question_type === 'practical') && (
                  <textarea rows={q.question_type === 'essay' ? 4 : 2} value={answers[q.id] || ''} onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                    placeholder={q.question_type === 'essay' ? 'Write your answer...' : 'Your answer...'}
                    className="mt-3 w-full resize-none rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-xs text-white outline-none focus:border-indigo-400/50" />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <button onClick={handleSubmit} disabled={submitting}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-2.5 text-sm font-black text-white disabled:opacity-50">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Submit Quiz
        </button>
      </div>
    </div>
  );
}
