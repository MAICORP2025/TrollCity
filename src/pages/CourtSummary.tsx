import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Scale,
  Landmark,
  Gavel,
  AlertTriangle,
  Lock,
  FileText,
  Users,
  CheckCircle,
  ArrowRight,
} from 'lucide-react'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'

function cleanCourtUuid(value?: string | null): string | null {
  if (!value) return null
  const cleaned = String(value).replace(/^court-/, '').replace(/^troll-court-/, '')
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleaned)
    ? cleaned
    : null
}

export default function CourtSummary() {
  const { user } = useAuthStore()
  const params = useParams()
  const navigate = useNavigate()

  const rawCourtId = params.courtId || params.id
  const courtId = cleanCourtUuid(rawCourtId)

  const [session, setSession] = useState<any>(null)
  const [allCases, setAllCases] = useState<any[]>([])
  const [myCase, setMyCase] = useState<any>(null)
  const [myJail, setMyJail] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const loadSummary = useCallback(async () => {
    if (!courtId) {
      setNotFound(true)
      setLoading(false)
      return
    }

    setLoading(true)

    try {
      const { data: sessionData } = await supabase
        .from('court_sessions')
        .select('*')
        .eq('id', courtId)
        .maybeSingle()

      if (!sessionData) {
        setNotFound(true)
        setLoading(false)
        return
      }

      setSession(sessionData)

      // Open dockets: every case tied to this court session's docket(s) so each
      // defendant on the docket is visible to every viewer.
      const { data: cases } = await supabase
        .from('court_cases')
        .select(
          '*, defendant:defendant_id(username, avatar_url), plaintiff:plaintiff_id(username)',
        )
        .order('created_at', { ascending: false })
        .limit(100)

      setAllCases(cases || [])

      if (user?.id) {
        const mine = (cases || []).find((c: any) => c.defendant_id === user.id)
        setMyCase(mine || null)

        if (!mine) {
          const { data: myCases } = await supabase
            .from('court_cases')
            .select('*, defendant:defendant_id(username), plaintiff:plaintiff_id(username)')
            .eq('defendant_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)

          if (myCases && myCases.length > 0) {
            setMyCase(myCases[0])
            setAllCases((prev) => [myCases[0], ...prev])
          }
        }

        const { data: jailData } = await supabase
          .from('jail')
          .select('id, reason, severity, sentence_days, arrested_by, release_time, bond_amount, bond_posted, status')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (
          jailData &&
          !jailData.bond_posted &&
          jailData.status !== 'released' &&
          new Date(jailData.release_time) > new Date()
        ) {
          setMyJail(jailData)
        }
      }
    } catch (err) {
      console.error('[CourtSummary] load failed', err)
    } finally {
      setLoading(false)
    }
  }, [courtId, user?.id])

  useEffect(() => {
    loadSummary()

    if (!courtId) return

    const channel = supabase
      .channel(`court_summary_${courtId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'court_cases' },
        () => loadSummary(),
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadSummary, courtId])

  const isArrested = Boolean(myJail)

  return (
    <div className="relative min-h-screen p-4 text-white md:p-6">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.16),transparent_34%),radial-gradient(circle_at_20%_20%,rgba(127,29,29,0.18),transparent_28%),linear-gradient(135deg,#090604,#11070b_42%,#050308)]" />
        <div className="absolute left-1/2 top-10 h-96 w-96 -translate-x-1/2 rounded-full bg-amber-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-4xl space-y-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-amber-300/20 bg-[#120b08]/90 p-6 shadow-[0_0_60px_rgba(245,158,11,0.14)] md:p-8">
          <div className="flex items-center gap-4">
            <div className="hidden h-16 w-16 items-center justify-center rounded-[1.5rem] border border-amber-300/30 bg-amber-400/10 shadow-[0_0_30px_rgba(245,158,11,0.18)] md:flex">
              <Landmark className="h-8 w-8 text-amber-200" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-amber-50 md:text-4xl">Court Summary</h1>
              <p className="mt-1 text-sm text-amber-100/70">
                Case #{courtId?.slice(0, 8) || 'invalid'} •{' '}
                {session?.status ? String(session.status).toUpperCase() : 'ENDED'}
              </p>
            </div>
          </div>
        </section>

        {loading && (
          <div className="rounded-2xl border border-amber-300/15 bg-[#120b08]/80 p-10 text-center text-amber-100/60">
            Loading court summary...
          </div>
        )}

        {notFound && (
          <div className="rounded-2xl border border-amber-300/15 bg-[#120b08]/80 p-10 text-center">
            <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-amber-300" />
            <p className="text-amber-100/70">This court session could not be found.</p>
            <button
              onClick={() => navigate('/troll-court')}
              className="mt-4 rounded-xl bg-gradient-to-r from-amber-500 to-red-700 px-5 py-2 font-bold text-white"
            >
              Return to Troll Court
            </button>
          </div>
        )}

        {!loading && !notFound && (
          <>
            {isArrested && (
              <section className="relative overflow-hidden rounded-[2rem] border border-red-400/40 bg-red-950/30 p-6 shadow-[0_0_40px_rgba(239,68,68,0.25)]">
                <div className="flex items-center gap-3">
                  <Lock className="h-8 w-8 text-red-300" />
                  <div>
                    <h2 className="text-2xl font-black text-red-100">You Have Been Arrested</h2>
                    <p className="text-sm text-red-200/80">
                      {myJail?.sentence_days
                        ? `Sentenced to ${myJail.sentence_days} day(s) in jail.`
                        : 'You are being taken into custody.'}{' '}
                      {myJail?.reason ? `Reason: ${myJail.reason}` : ''}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/jail')}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 py-3 font-black text-white hover:bg-red-500"
                >
                  Proceed to Jail <ArrowRight className="h-5 w-5" />
                </button>
              </section>
            )}

            {!isArrested && myCase && myCase.status === 'resolved' && (
              <section className="relative overflow-hidden rounded-[2rem] border border-emerald-400/30 bg-emerald-950/25 p-6 shadow-[0_0_40px_rgba(16,185,129,0.2)]">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-8 w-8 text-emerald-300" />
                  <div>
                    <h2 className="text-2xl font-black text-emerald-100">Your Case Was Ruled On</h2>
                    <p className="mt-1 text-sm text-emerald-200/80">
                      Defendant: @{myCase.defendant?.username || 'you'}
                    </p>
                    {myCase.judgment && (
                      <p className="mt-2 rounded-xl border border-emerald-300/20 bg-black/25 p-3 text-sm italic text-emerald-100/80">
                        “{myCase.judgment}”
                      </p>
                    )}
                  </div>
                </div>
              </section>
            )}

            {!isArrested && myCase && myCase.status !== 'resolved' && (
              <section className="relative overflow-hidden rounded-[2rem] border border-yellow-400/25 bg-yellow-950/20 p-6">
                <div className="flex items-center gap-3">
                  <Scale className="h-8 w-8 text-yellow-300" />
                  <div>
                    <h2 className="text-xl font-black text-yellow-100">Your Case Is On The Docket</h2>
                    <p className="mt-1 text-sm text-yellow-200/80">
                      Defendant: @{myCase.defendant?.username || 'you'} • Status:{' '}
                      {String(myCase.status || 'pending').toUpperCase()}
                    </p>
                  </div>
                </div>
              </section>
            )}

            {!isArrested && !myCase && (
              <section className="relative overflow-hidden rounded-[2rem] border border-amber-300/20 bg-black/25 p-6">
                <div className="flex items-center gap-3">
                  <Users className="h-8 w-8 text-amber-200" />
                  <div>
                    <h2 className="text-xl font-black text-amber-50">You Were Not Named In Any Case</h2>
                    <p className="mt-1 text-sm text-amber-100/70">
                      This session has concluded. Review the docket below for the full record.
                    </p>
                  </div>
                </div>
              </section>
            )}

            <section className="rounded-[1.7rem] border border-amber-300/15 bg-[#120b08]/88 p-5 shadow-[0_0_35px_rgba(0,0,0,0.35)]">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-amber-50">
                <Gavel className="h-5 w-5 text-amber-300" />
                Court Docket — All Defendants
              </h2>

              {allCases.length === 0 ? (
                <div className="rounded-2xl border border-amber-300/10 bg-black/20 p-6 text-center text-amber-100/50">
                  No cases were filed for this court session.
                </div>
              ) : (
                <div className="space-y-3">
                  {allCases.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-2xl border border-amber-300/12 bg-black/25 p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-black text-amber-50">
                          {c.defendant?.username || 'Unknown Defendant'}
                        </span>
                        <span
                          className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase ${
                            c.status === 'resolved'
                              ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200'
                              : 'border-yellow-400/25 bg-yellow-500/10 text-yellow-200'
                          }`}
                        >
                          {String(c.status || 'pending').toUpperCase()}
                        </span>
                        {c.plaintiff?.username && (
                          <span className="text-xs text-amber-100/50">vs @{c.plaintiff.username}</span>
                        )}
                      </div>

                      {c.reason && (
                        <p className="mt-2 rounded-xl border border-amber-300/10 bg-black/25 p-3 text-sm italic text-amber-100/70">
                          “{c.reason}”
                        </p>
                      )}

                      {c.judgment && (
                        <p className="mt-2 text-xs font-bold text-emerald-200/70">
                          Ruling: {c.judgment}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => navigate('/troll-court')}
                className="flex-1 rounded-xl border border-amber-300/20 bg-amber-400/10 py-3 font-bold text-amber-100 hover:bg-amber-400/20"
              >
                <FileText className="mr-2 inline h-4 w-4" />
                Return to Troll Court
              </button>
              {isArrested && (
                <button
                  onClick={() => navigate('/jail')}
                  className="flex-1 rounded-xl bg-red-600 py-3 font-black text-white hover:bg-red-500"
                >
                  Go To Jail
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
