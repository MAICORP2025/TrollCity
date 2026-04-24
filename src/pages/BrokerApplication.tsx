import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Briefcase, FileText, AlertTriangle, CheckCircle, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'

export default function BrokerApplication() {
  const navigate = useNavigate()
  const { profile } = useAuthStore()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const experience = formData.get('experience') as string

    if (!experience.trim()) {
      toast.error('Please describe your experience')
      return
    }

    try {
      const { error } = await supabase
        .from('insurance_broker_applications')
        .insert({
          user_id: profile?.id,
          experience,
          status: 'pending',
          created_at: new Date().toISOString()
        })

      if (error) throw error

      toast.success('Broker application submitted!')
      navigate('/home')
    } catch (err: any) {
      toast.error(err?.message || 'Application failed')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-8 h-8 text-blue-400" />
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-yellow-400" />
            Insurance Broker Application
          </h1>
        </div>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <FileText className="w-5 h-5 text-blue-400" />
              Application Form
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Describe your relevant experience in insurance, customer service, or related fields
                </label>
                <textarea
                  name="experience"
                  placeholder="Tell us about your background..."
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none" 
                  rows={6}
                  required
                />
              </div>

              <div className="flex items-center gap-2 text-sm text-blue-400">
                <AlertTriangle className="w-5 h-5" />
                <span>Applications are reviewed by our team. You&apos;ll be notified of the status.</span>
              </div>

              <div className="pt-4 border-t border-slate-700">
                <Button type="submit" className="w-full">
                  Submit Application
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-green-400" />
                <span className="text-sm text-gray-300">Review process: 3-5 business days</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Clock className="w-6 h-6 text-amber-400" />
                <span className="text-sm text-gray-300">Commission-based earnings available</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}