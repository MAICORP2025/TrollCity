import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { Crown, CheckCircle2, XCircle, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'

export default function EmpirePartnerApply() {
  const { profile, user, refreshProfile } = useAuthStore()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [hasApplication, setHasApplication] = useState(false)
  const [applicationStatus, setApplicationStatus] = useState<'pending' | 'approved' | 'rejected' | null>(null)

  const checkApplicationStatus = useCallback(async () => {
    if (!user?.id) return

    try {
      const { data: application } = await supabase
        .from('empire_applications')
        .select('status')
        .eq('user_id', user.id)
        .maybeSingle()

      if (application) {
        setHasApplication(true)
        setApplicationStatus(application.status as 'pending' | 'approved' | 'rejected')
      }

      // If already approved, redirect will happen in useEffect
    } catch (error) {
      console.error('Error checking application status:', error)
    }
  }, [user?.id])

  useEffect(() => {
    if (!user) {
      navigate('/auth')
      return
    }

    // Check if user already has an application
    checkApplicationStatus()

    // If already approved, redirect to dashboard
    if (profile?.empire_role === 'partner') {
      navigate('/empire-partner')
      return
    }
  }, [user, profile?.empire_role, navigate, checkApplicationStatus])

  const handleSubmitApplication = useCallback(async () => {
    if (!user?.id) return

    setLoading(true)
    try {
      const { error: appError } = await supabase
        .from('empire_applications')
        .insert({
          user_id: user.id,
          status: 'pending',
          payment_type: 'free',
          amount_paid: 0,
          payment_id: `free_${Date.now()}`
        })

      if (appError) {
        if (appError.message.includes('duplicate')) {
          toast.error('You already have a pending application')
          return
        }
        throw appError
      }

      toast.success('Application submitted! Admin and Lead Troll Officer will review it.')
      setHasApplication(true)
      setApplicationStatus('pending')
    } catch (error: any) {
      console.error('Error submitting application:', error)
      toast.error(error.message || 'Failed to submit application')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  if (!user) {
    return null
  }

  if (hasApplication && applicationStatus === 'approved') {
    return (
      <div className="min-h-screen bg-[#0A0814] text-white p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-green-500/20 border border-green-500 rounded-xl p-8 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h1 className="text-3xl font-bold mb-2">Application Approved!</h1>
            <p className="text-gray-300 mb-6">You are now an Empire Partner. Start recruiting and earning bonuses!</p>
            <button
              onClick={async () => {
                // Refresh profile first to get updated partner status
                await refreshProfile()
                navigate('/empire-partner')
              }}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-lg flex items-center gap-2 mx-auto"
            >
              Go to Partner Dashboard
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (hasApplication && applicationStatus === 'pending') {
    return (
      <div className="min-h-screen bg-[#0A0814] text-white p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-yellow-500/20 border border-yellow-500 rounded-xl p-8 text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-yellow-400 mx-auto mb-4"></div>
            <h1 className="text-3xl font-bold mb-2">Application Pending</h1>
            <p className="text-gray-300 mb-6">Your application is under review. We&apos;ll notify you once it&apos;s processed.</p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-lg"
            >
              Return Home
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (hasApplication && applicationStatus === 'rejected') {
    return (
      <div className="min-h-screen bg-[#0A0814] text-white p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-500/20 border border-red-500 rounded-xl p-8 text-center">
            <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h1 className="text-3xl font-bold mb-2">Application Rejected</h1>
            <p className="text-gray-300 mb-6">Your application was not approved. Please contact support for more information.</p>
            <button
              onClick={() => navigate('/support')}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-lg"
            >
              Contact Support
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0814] text-white p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full mb-6">
            <Crown className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Join the Troll Empire Partner Program
          </h1>
          <p className="text-xl text-gray-400">
            Recruit users and earn 5% bonus when they reach 40,000+ coins per month - Free to apply!
          </p>
        </div>

        {/* Benefits */}
        <div className="bg-[#141414] border border-[#2C2C2C] rounded-xl p-8 mb-8">
          <h2 className="text-2xl font-bold mb-6">Partner Benefits</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold mb-1">5% Referral Bonus</h3>
                <p className="text-sm text-gray-400">Earn 5% of referred users&apos; monthly earnings (troll_coins)</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold mb-1">40,000 Coin Threshold</h3>
                <p className="text-sm text-gray-400">Bonuses activate when referrals earn 40,000+ coins/month</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold mb-1">Monthly Payouts</h3>
                <p className="text-sm text-gray-400">Bonuses paid automatically at month end</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold mb-1">Empire Partner Badge</h3>
                <p className="text-sm text-gray-400">Showcase your partner status on your profile</p>
              </div>
            </div>
          </div>
        </div>

        {/* Application Requirements */}
        <div className="bg-[#141414] border border-[#2C2C2C] rounded-xl p-8 mb-8">
          <h2 className="text-2xl font-bold mb-6">Application Requirements</h2>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold mb-1">Free Application</h3>
                <p className="text-sm text-gray-400">No payment required - just fill out the form and submit</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold mb-1">Admin Review</h3>
                <p className="text-sm text-gray-400">Your application will be reviewed by our admin team</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold mb-1">Lead Troll Officer Approval</h3>
                <p className="text-sm text-gray-400">Must be approved by a Lead Troll Officer before activation</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold mb-1">Dual Approval System</h3>
                <p className="text-sm text-gray-400">Both admin and lead officer must approve your application</p>
              </div>
            </div>
          </div>
        </div>

        {/* Application Button */}
        <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/50 rounded-xl p-8 mb-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Ready to Apply?</h2>
          <p className="text-gray-300 mb-6">
            Submit your application for approval. Our admin team and Lead Troll Officers will review it carefully.
          </p>
          <button
            onClick={handleSubmitApplication}
            disabled={loading}
            className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-lg font-bold text-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Submitting...' : 'Submit Application'}
          </button>
        </div>

        {/* Terms */}
        <div className="bg-[#141414] border border-[#2C2C2C] rounded-xl p-6">
          <p className="text-sm text-gray-400 text-center">
            By applying, you agree to the Empire Partner Program terms. Applications are subject to admin approval.
            Refunds are not available for rejected applications.
          </p>
        </div>
      </div>
    </div>
  )
}
