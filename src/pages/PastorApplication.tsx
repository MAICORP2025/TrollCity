import React, { useState } from 'react'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
// import { BookOpen, User } from 'lucide-react'

export default function PastorApplication() {
  const { profile } = useAuthStore()
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    denomination: '',
    experience: '',
    motivation: '',
    availability: '',
    sermonSample: '',
    references: ''
  })
  const [loading, setLoading] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!profile) return toast.error('Please sign in')
    
    const requiredFields = ['fullName', 'email', 'denomination', 'experience', 'motivation', 'availability']
    const missingFields = requiredFields.filter(field => !formData[field as keyof typeof formData].trim())
    
    if (missingFields.length > 0) {
      return toast.error('Please complete all required fields')
    }

    try {
      setLoading(true)
      
      const applicationData = {
        user_id: profile.id,
        type: 'pastor',
        reason: formData.motivation,
        goals: formData.availability,
        data: {
          username: profile.username,
          fullName: formData.fullName,
          email: formData.email,
          phone: formData.phone,
          denomination: formData.denomination,
          experience: formData.experience,
          motivation: formData.motivation,
          availability: formData.availability,
          sermonSample: formData.sermonSample,
          references: formData.references
        },
        status: 'pending'
      }
      
      const { error } = await supabase.from('applications').insert([applicationData])
      
      if (error) {
        console.error('[Pastor App] Submission error:', error)
        toast.error(error.message || 'Failed to submit application')
        throw error
      }
      
      toast.success('Application submitted successfully! We will review your application shortly.')
      setFormData({
        fullName: '',
        email: '',
        phone: '',
        denomination: '',
        experience: '',
        motivation: '',
        availability: '',
        sermonSample: '',
        references: ''
      })
    } catch (err) {
      console.error('Submit error:', err)
      toast.error('Failed to submit application')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-8">
        <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 via-indigo-400 to-cyan-400 bg-clip-text text-transparent mb-2">
            Pastor Application
          </h1>
          <p className="text-[#E2E2E2]/60">Position: Troll Church Pastor</p>
        </div>

        <div className="bg-[#1A1A1A] rounded-xl p-6 border border-[#2C2C2C] mb-6">
          <h2 className="text-xl font-semibold text-purple-400 mb-3">Position Overview</h2>
          <p className="text-[#E2E2E2]/80 mb-3">
            As a Pastor of Troll Church, you will lead daily reflections, host Sunday services, and provide spiritual (or troll-ritual) guidance to the community.
          </p>
          <div className="space-y-2 text-sm text-[#E2E2E2]/70">
            <h3 className="font-semibold text-white">Responsibilities:</h3>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Prepare and post daily passages (optional/automated)</li>
              <li>Host live Sunday Services (1 PM - 3 PM)</li>
              <li>Engage with prayer requests and community members</li>
              <li>Maintain a welcoming and respectful environment in the Church</li>
            </ul>
          </div>
        </div>

        <form onSubmit={submit} className="bg-[#1A1A1A] rounded-xl p-6 border border-[#2C2C2C] space-y-6">
          {/* Personal Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-indigo-400 border-b border-[#2C2C2C] pb-2">Personal Information</h3>
            
            <div>
              <label className="block text-sm font-medium text-[#E2E2E2]/90 mb-2">
                Full Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                placeholder="First and Last Name"
                className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-purple-400 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#E2E2E2]/90 mb-2">
                  Email Address <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="your.email@example.com"
                  className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-purple-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#E2E2E2]/90 mb-2">
                  Phone Number <span className="text-[#E2E2E2]/50">(Optional)</span>
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+1 (555) 123-4567"
                  className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-purple-400 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Ministry Details */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-indigo-400 border-b border-[#2C2C2C] pb-2">Ministry Details</h3>
            
            <div>
              <label className="block text-sm font-medium text-[#E2E2E2]/90 mb-2">
                Denomination / Faith Background <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                name="denomination"
                value={formData.denomination}
                onChange={handleChange}
                placeholder="e.g., Non-denominational, Catholic, Troll-Spiritualist"
                className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-purple-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#E2E2E2]/90 mb-2">
                Experience / Background <span className="text-red-400">*</span>
              </label>
              <textarea
                name="experience"
                value={formData.experience}
                onChange={handleChange}
                placeholder="Briefly describe your experience with leading groups, public speaking, or ministry..."
                rows={4}
                className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-purple-400 focus:outline-none resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#E2E2E2]/90 mb-2">
                Motivation <span className="text-red-400">*</span>
              </label>
              <textarea
                name="motivation"
                value={formData.motivation}
                onChange={handleChange}
                placeholder="Why do you want to be a Pastor in Troll City?"
                rows={4}
                className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-purple-400 focus:outline-none resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#E2E2E2]/90 mb-2">
                Sermon Sample (Optional)
              </label>
              <textarea
                name="sermonSample"
                value={formData.sermonSample}
                onChange={handleChange}
                placeholder="Write a short sample sermon or message you might share..."
                rows={4}
                className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-purple-400 focus:outline-none resize-none"
              />
            </div>
          </div>

          {/* Availability */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-indigo-400 border-b border-[#2C2C2C] pb-2">Availability</h3>
            
            <div>
              <label className="block text-sm font-medium text-[#E2E2E2]/90 mb-2">
                Sunday Availability <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                name="availability"
                value={formData.availability}
                onChange={handleChange}
                placeholder="Are you available Sundays 1 PM - 3 PM?"
                className="w-full px-4 py-3 bg-[#0D0D0D] border border-[#2C2C2C] rounded-lg focus:border-purple-400 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-6 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-bold text-lg hover:shadow-lg hover:shadow-purple-600/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? 'Submitting Application...' : 'Submit Application'}
          </button>
        </form>
      </div>
    </div>
  )
}
