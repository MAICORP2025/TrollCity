import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Check, AlertTriangle, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

export default function TrollsNightApplication() {
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [agreedToRules, setAgreedToRules] = useState(false)
  const [isMature, setIsMature] = useState(false)

  // Redirect if already approved (simple check, could be more robust)
  if (profile?.trolls_night_approved) {
    return (
      <div className="min-h-screen bg-[#050012] flex items-center justify-center text-white p-6">
        <div className="bg-[#0F0F1A] p-8 rounded-2xl border border-green-500/30 text-center max-w-md space-y-6">
          <div className="w-20 h-20 bg-green-900/20 rounded-full flex items-center justify-center mx-auto border border-green-500/50">
            <Check className="w-10 h-10 text-green-400" />
          </div>
          <h1 className="text-3xl font-bold text-white">You're Approved!</h1>
          <p className="text-gray-300">
            You already have access to Trolls@Night. Enjoy the show!
          </p>
          <button
            onClick={() => navigate('/trolls-night')}
            className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition shadow-lg shadow-green-900/20"
          >
            Enter Trolls@Night
          </button>
        </div>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user) {
      toast.error('You must be logged in to apply.')
      return
    }

    if (!agreedToRules || !isMature) {
      toast.error('You must agree to all terms to proceed.')
      return
    }

    setIsSubmitting(true)

    try {
      // 1. Save application to database
      const { error: appError } = await supabase
        .from('applications')
        .insert({
          user_id: user.id,
          type: 'trolls_night_access', // specific type for this access
          status: 'pending',
          metadata: {
            agreed_to_rules: true,
            is_mature_confirmed: true,
            applied_at: new Date().toISOString(),
            username: profile?.username,
            role: profile?.role
          }
        })

      if (appError) throw appError

      // 2. Log the agreement in admin dashboard (simulated via strict logging or specific table if needed)
      // For now, the application record itself serves as the proof of agreement.

      toast.success('Application submitted successfully!')
      
      // Navigate to a success/pending state or back home
      navigate('/')
      
    } catch (error: any) {
      console.error('Application error:', error)
      toast.error(`Failed to submit application: ${error.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#050012] text-white p-6 flex flex-col items-center justify-center">
      <div className="max-w-2xl w-full space-y-8">
        
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center p-4 bg-purple-900/20 rounded-full border border-purple-500/30 animate-pulse">
            <Shield className="w-12 h-12 text-purple-400" />
          </div>
          <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-red-500">
            APPLY FOR TROLLS@NIGHT
          </h1>
          <p className="text-lg text-gray-400">
            Access to Trolls@Night is restricted. Only approved users can view or broadcast.
          </p>
        </div>

        <div className="bg-[#0F0F1A] p-8 rounded-3xl border border-white/10 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-8">
            
            {/* Warning Box */}
            <div className="bg-red-900/10 border border-red-500/20 p-4 rounded-xl flex gap-4 items-start">
              <AlertTriangle className="w-6 h-6 text-red-500 shrink-0 mt-1" />
              <div className="space-y-2">
                <h3 className="font-bold text-red-400">Mature Content Warning</h3>
                <p className="text-sm text-red-200/80">
                  Trolls@Night is intended for mature audiences only. While explicit content is banned, the themes are nightlife-oriented. By applying, you confirm you are of legal age in your jurisdiction to view such content.
                </p>
              </div>
            </div>

            {/* Rules Link */}
            <div className="p-4 bg-white/5 rounded-xl border border-white/10 flex justify-between items-center">
              <span className="text-gray-300 font-medium">Read the Official Rules</span>
              <button
                type="button"
                onClick={() => navigate('/legal/trolls-night-rules')}
                className="text-blue-400 hover:text-blue-300 font-bold text-sm underline"
              >
                View Rules
              </button>
            </div>

            {/* Checkboxes */}
            <div className="space-y-4">
              <label className="flex items-start gap-4 cursor-pointer group">
                <div className={`mt-1 w-6 h-6 rounded border flex items-center justify-center transition ${isMature ? 'bg-purple-600 border-purple-500' : 'bg-transparent border-gray-600 group-hover:border-purple-400'}`}>
                  {isMature && <Check className="w-4 h-4 text-white" />}
                </div>
                <input 
                  type="checkbox" 
                  className="hidden"
                  checked={isMature}
                  onChange={(e) => setIsMature(e.target.checked)}
                />
                <span className="text-gray-300 text-sm">
                  I confirm I am a mature user and understand the nature of the content.
                </span>
              </label>

              <label className="flex items-start gap-4 cursor-pointer group">
                <div className={`mt-1 w-6 h-6 rounded border flex items-center justify-center transition ${agreedToRules ? 'bg-purple-600 border-purple-500' : 'bg-transparent border-gray-600 group-hover:border-purple-400'}`}>
                  {agreedToRules && <Check className="w-4 h-4 text-white" />}
                </div>
                <input 
                  type="checkbox" 
                  className="hidden"
                  checked={agreedToRules}
                  onChange={(e) => setAgreedToRules(e.target.checked)}
                />
                <span className="text-gray-300 text-sm">
                  I have read and agree to the <span className="text-white font-bold">Official Trolls@Night Rules</span>. I understand that violations result in immediate bans without refund.
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || !agreedToRules || !isMature}
              className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition ${
                isSubmitting || !agreedToRules || !isMature
                  ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:brightness-110 shadow-lg shadow-purple-900/30'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Application'
              )}
            </button>

          </form>
        </div>
      </div>
    </div>
  )
}
