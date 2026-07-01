import React from 'react'
import { useAuthStore } from '../lib/store'
import { supabase } from '@/lib/supabase'
import { useNavigate } from 'react-router-dom'
import { Settings, Boxes, Sparkles, KeyRound, Trash2, Ban, Palette } from 'lucide-react'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import UserInventory from './UserInventory'
import { trollCityTheme } from '../styles/trollCityTheme'
import FamilyMinorSettings from '../components/profile/FamilyMinorSettings'
import BatterySaverToggle from '@/components/BatterySaverToggle'
import ProfileCustomization from '@/components/profile/ProfileCustomization'

async function postToMaiTalentLink(payload: Record<string, any>) {
  const session = await supabase.auth.getSession()
  const token = session?.data?.session?.access_token

  if (!token) {
    throw new Error('Authentication token unavailable. Please sign in again.')
  }

  const response = await fetch('/api/maitalent/link-account', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.error || body?.detail?.error || body?.detail || 'Failed to link MaiTalent account')
  }

  return response.json()
}

export default function ProfileSettings() {
  const { user, profile, refreshProfile } = useAuthStore()
  const navigate = useNavigate()
  // Profile Edit State
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [bio, setBio] = useState('')
  const [bannerNotifications, setBannerNotifications] = useState(true)
  const [isMinor, setIsMinor] = useState(false)
  const [platform, setPlatform] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [activeTab, setActiveTab] = useState<'basic' | 'customization'>('basic')
  const [maitalentUserId, setMaiTalentUserId] = useState('')
  const [maiLinkStatus, setMaiLinkStatus] = useState<string | null>(null)
  const [maiLinkPlatform, setMaiLinkPlatform] = useState('troll-city')
  const [maiLinkExternalUserId, setMaiLinkExternalUserId] = useState<string | null>(null)
  const [maiLinkVerifiedAt, setMaiLinkVerifiedAt] = useState<string | null>(null)
  const [maiLinkMessage, setMaiLinkMessage] = useState<string | null>(null)
  const [maiLinkLoading, setMaiLinkLoading] = useState(false)
  
  // Creator Subscription Settings
  const [creatorSubscriptionEnabled, setCreatorSubscriptionEnabled] = useState(false)
  const [creatorSubscriptionPrice, setCreatorSubscriptionPrice] = useState(100)
  const [savingSubscription, setSavingSubscription] = useState(false)

  useEffect(() => {
    if (profile) {
      setUsername(profile.username || '')
      setFullName((profile as any).full_name || '')
      setBio(profile.bio || '')
      setPlatform((profile as any).platform || '')
      if ((profile as any).banner_notifications_enabled !== undefined) {
        setBannerNotifications((profile as any).banner_notifications_enabled)
      }
      if ((profile as any).is_minor !== undefined) {
        setIsMinor((profile as any).is_minor)
      }
      if ((profile as any).creator_subscription_enabled !== undefined) {
        setCreatorSubscriptionEnabled((profile as any).creator_subscription_enabled)
      }
      if ((profile as any).creator_subscription_price_coins !== undefined) {
        setCreatorSubscriptionPrice((profile as any).creator_subscription_price_coins)
      }

      const persistedLinkStatus = (profile as any).maitalent_link_status || null
      if (persistedLinkStatus) {
        setMaiLinkStatus(persistedLinkStatus)
        setMaiLinkPlatform((profile as any).maitalent_link_platform || 'troll-city')
        setMaiLinkExternalUserId((profile as any).maitalent_external_user_id || null)
        setMaiLinkVerifiedAt((profile as any).maitalent_link_verified_at || null)
      } else {
        setMaiLinkStatus(null)
        setMaiLinkExternalUserId(null)
        setMaiLinkVerifiedAt(null)
      }
    }
  }, [profile])

  const handleSaveProfile = async () => {
    if (!user) return
    
    const newUsername = username.trim()
    if (!newUsername) {
      toast.error('Username cannot be empty')
      return
    }
    
    if (!/^[a-zA-Z0-9_]{2,20}$/.test(newUsername)) {
      toast.error('Username must be 2-20 characters (letters, numbers, underscores)')
      return
    }

    setSavingProfile(true)
    try {
      // Check availability if changed
      if (profile?.username !== newUsername) {
        const { data: existing } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('username', newUsername)
          .neq('id', user.id)
          .maybeSingle()
          
        if (existing) {
          toast.error('Username is already taken')
          setSavingProfile(false)
          return
        }
      }

      const { error } = await supabase
        .from('user_profiles')
        .update({
          username: newUsername,
          full_name: fullName.trim(),
          bio: bio.trim(),
          banner_notifications_enabled: bannerNotifications,
          is_minor: isMinor,
          platform: platform || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (error) throw error

      await refreshProfile(true)
      toast.success('Profile updated successfully')
    } catch (err) {
      console.error('Error updating profile:', err)
      toast.error('Failed to update profile')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleLinkMaiTalent = async () => {
    if (!user) return

    setMaiLinkLoading(true)
    setMaiLinkMessage(null)

    try {
      const payload: Record<string, any> = {
        maitalent_user_id: maitalentUserId || undefined,
        metadata: { requested_from: 'profile_page' },
      }

      const result = await postToMaiTalentLink(payload)
      const status = result?.payload?.status || result?.status || 'linked'
      const message = result?.payload?.message || result?.message || ''

      if (status === 'linked') {
        setMaiLinkStatus('linked')
        setMaiLinkPlatform('troll-city')
        setMaiLinkExternalUserId(result?.payload?.external_user_id || user.id)
        setMaiLinkVerifiedAt(result?.payload?.verified_at || new Date().toISOString())
        setMaiLinkMessage('MaiTalent account connected successfully.')
        await refreshProfile(true)
        toast.success('MaiTalent account linked')
      } else if (result?.payload?.status === 'linked') {
        setMaiLinkStatus('linked')
        setMaiLinkPlatform('troll-city')
        setMaiLinkExternalUserId(result?.payload?.external_user_id || user.id)
        setMaiLinkVerifiedAt(result?.payload?.verified_at || new Date().toISOString())
        setMaiLinkMessage('MaiTalent account connected successfully.')
        await refreshProfile(true)
        toast.success('MaiTalent account linked')
      } else if (status === 'review') {
        setMaiLinkStatus('review')
        setMaiLinkMessage('Multiple Troll City accounts match this email; admin review is required.')
      } else if (status === 'flagged') {
        setMaiLinkStatus('flagged')
        setMaiLinkMessage('MaiTalent flagged this account link due to a conflict.')
      } else {
        setMaiLinkStatus(status)
        setMaiLinkMessage(message || 'MaiTalent returned an unexpected response.')
      }
    } catch (error) {
      console.error('Error linking MaiTalent account:', error)
      setMaiLinkStatus('error')
      setMaiLinkMessage(error instanceof Error ? error.message : 'Failed to link MaiTalent account')
      toast.error('Unable to connect MaiTalent account')
    } finally {
      setMaiLinkLoading(false)
    }
  }

  if (!user) {
    navigate('/auth')
    return null
  }

  return (
    <div className={`min-h-screen ${trollCityTheme.backgrounds.primary} text-white p-6`}>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl ${trollCityTheme.gradients.button} flex items-center justify-center`}>
            <Settings className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold">Profile Settings</h1>
              <span className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_0_4px_rgba(239,68,68,0.25)]" aria-label="Multiple settings pages available" />
            </div>
            <p className={`text-sm ${trollCityTheme.text.muted}`}>Manage your items and account preferences.</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 border-b border-white/10 pb-2">
          <button
            onClick={() => setActiveTab('basic')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors ${
              activeTab === 'basic'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <Settings className="w-4 h-4" />
            Basic Settings
          </button>
          <button
            onClick={() => setActiveTab('customization')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors ${
              activeTab === 'customization'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <Palette className="w-4 h-4" />
            <span className="flex items-center gap-2">
              Profile Customization
              <span className="h-2 w-2 rounded-full bg-red-500" aria-label="Additional settings page" />
            </span>
          </button>
        </div>

        {/* Basic Settings Tab */}
        {activeTab === 'basic' && (
          <div className="space-y-6">
            {/* Preferences */}
            <div className={`${trollCityTheme.components.card} space-y-4`}>
              <h2 className="text-xl font-semibold">Preferences</h2>
              <div className={`flex items-center justify-between p-4 ${trollCityTheme.backgrounds.glass} rounded-xl border ${trollCityTheme.borders.glass}`}>
                <div>
                  <p className="font-medium text-white">Global Pod Notifications</p>
                  <p className={`text-xs ${trollCityTheme.text.muted}`}>Receive a banner when a Pod goes live.</p>
                </div>
                <button
                  onClick={() => setBannerNotifications(!bannerNotifications)}
                  className={`w-12 h-6 rounded-full transition-colors relative ${bannerNotifications ? 'bg-purple-600' : 'bg-gray-700'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${bannerNotifications ? 'left-7' : 'left-1'}`} />
                </button>
              </div>
              <div className={`p-4 ${trollCityTheme.backgrounds.glass} rounded-xl border ${trollCityTheme.borders.glass}`}>
                <BatterySaverToggle />
              </div>
            </div>

            {/* Profile Details Edit */}
            <div className={`${trollCityTheme.components.card} space-y-4`}>
              <h2 className="text-xl font-semibold">Profile Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className={`text-sm ${trollCityTheme.text.muted}`}>Full Name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className={`w-full px-4 py-2 ${trollCityTheme.components.input} rounded-xl text-white focus:outline-none transition-colors`}
                    placeholder="Your Name"
                  />
                  <p className={`text-xs ${trollCityTheme.text.muted}`}>Used for password recovery.</p>
                </div>
                <div className="space-y-2">
                  <label className={`text-sm ${trollCityTheme.text.muted}`}>Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                    className={`w-full px-4 py-2 ${trollCityTheme.components.input} rounded-xl text-white focus:outline-none transition-colors`}
                    placeholder="Username"
                  />
                  <p className={`text-xs ${trollCityTheme.text.muted}`}>Letters, numbers, and underscores only.</p>
                </div>
                <div className="space-y-2">
                  <label className={`text-sm ${trollCityTheme.text.muted}`}>Bio</label>
                  <input
                    type="text"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className={`w-full px-4 py-2 ${trollCityTheme.components.input} rounded-xl text-white focus:outline-none transition-colors`}
                    placeholder="Tell us about yourself"
                    maxLength={500}
                  />
                </div>
                <div className="space-y-2">
                  <label className={`text-sm ${trollCityTheme.text.muted}`}>Platform You Rep</label>
                  <select
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                    className={`w-full px-4 py-2 ${trollCityTheme.components.input} rounded-xl text-white focus:outline-none transition-colors`}
                  >
                    <option value="">Select platform</option>
                    <option value="trollcity">Troll City</option>
                    <option value="tiktok">TikTok</option>
                    <option value="liveme">LiveMe</option>
                    <option value="bigo">Bigo Live</option>
                    <option value="favortied">Favortied</option>
                  </select>
                  <p className={`text-xs ${trollCityTheme.text.muted}`}>Shown on profile and during battles</p>
                </div>
                <div className={`flex items-center justify-between p-4 ${trollCityTheme.backgrounds.glass} rounded-xl border ${trollCityTheme.borders.glass} md:col-span-2`}>
                  <div>
                    <p className="font-medium text-white flex items-center gap-2">
                      <span className="text-lg">18+</span> Minor Account
                    </p>
                    <p className={`text-xs ${trollCityTheme.text.muted}`}>Enable if this account belongs to a minor under 18. A badge will be shown on your profile.</p>
                  </div>
                  <button
                    onClick={() => setIsMinor(!isMinor)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${isMinor ? 'bg-purple-600' : 'bg-gray-700'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${isMinor ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleSaveProfile}
                  disabled={savingProfile}
                  className={`px-6 py-2 ${trollCityTheme.gradients.button} rounded-xl font-semibold disabled:opacity-50 transition-colors text-white`}
                >
                  {savingProfile ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>

            {/* MaiTalent Connection */}
            <div className={`${trollCityTheme.components.card} space-y-4`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">MaiTalent Connection</h2>
                  <p className={`text-sm ${trollCityTheme.text.muted}`}>
                    This uses the Troll City backend to send your verified email and user id to MaiTalent. Once it succeeds, your profile shows a linked state here.
                  </p>
                </div>
              </div>

              {maiLinkStatus === 'linked' ? (
                <div className="space-y-3 p-4 rounded-xl bg-white/5 border border-white/10">
                  <p className="text-sm font-semibold text-emerald-300">✅ MaiTalent account linked</p>
                  <div className="grid grid-cols-1 gap-2 text-sm text-white/80">
                    <div>
                      <span className="font-medium text-white">Status:</span> linked
                    </div>
                    <div>
                      <span className="font-medium text-white">Platform:</span> {maiLinkPlatform}
                    </div>
                    <div>
                      <span className="font-medium text-white">External user id:</span> {maiLinkExternalUserId || user?.id}
                    </div>
                    {maiLinkVerifiedAt && (
                      <div>
                        <span className="font-medium text-white">Verified at:</span> {new Date(maiLinkVerifiedAt).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className={`text-sm ${trollCityTheme.text.muted}`}>MaiTalent Profile ID (optional)</label>
                    <input
                      type="text"
                      value={maitalentUserId}
                      onChange={(e) => setMaiTalentUserId(e.target.value)}
                      className={`w-full px-4 py-2 ${trollCityTheme.components.input} rounded-xl text-white focus:outline-none transition-colors`}
                      placeholder="Enter your MaiTalent profile ID"
                    />
                    <p className={`text-xs ${trollCityTheme.text.muted}`}>Providing your MaiTalent profile ID helps match your account precisely.</p>
                  </div>
                  <button
                    onClick={handleLinkMaiTalent}
                    disabled={maiLinkLoading}
                    className={`px-6 py-2 ${trollCityTheme.gradients.button} rounded-xl font-semibold disabled:opacity-50 transition-colors text-white`}
                  >
                    {maiLinkLoading ? 'Linking...' : 'Link MaiTalent account'}
                  </button>
                  <p className={`text-xs ${trollCityTheme.text.muted}`}>
                    If the link succeeds, this panel will switch to a green “linked” state automatically.
                  </p>
                  {maiLinkMessage && (
                    <p className={`text-sm ${maiLinkStatus === 'review' ? 'text-amber-300' : maiLinkStatus === 'flagged' ? 'text-red-300' : 'text-white/80'}`}>
                      {maiLinkMessage}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Creator Subscription Settings */}
            <div className={`${trollCityTheme.components.card} space-y-4`}>
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <span>PC</span> Creator Subscription
              </h2>
              <p className={`text-xs ${trollCityTheme.text.muted}`}>
                Allow fans to subscribe to your content. You keep 90% of coins, 10% goes to CEO.
              </p>
              <div className="space-y-3">
                <div className={`flex items-center justify-between p-4 ${trollCityTheme.backgrounds.glass} rounded-xl border ${trollCityTheme.borders.glass}`}>
                  <div>
                    <p className="font-medium text-white">Enable Subscriptions</p>
                    <p className={`text-xs ${trollCityTheme.text.muted}`}>Fans can subscribe to support you</p>
                  </div>
                  <button
                    onClick={() => setCreatorSubscriptionEnabled(!creatorSubscriptionEnabled)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${creatorSubscriptionEnabled ? 'bg-cyan-600' : 'bg-gray-700'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${creatorSubscriptionEnabled ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>
                <div className="space-y-2">
                  <label className={`text-sm ${trollCityTheme.text.muted}`}>Subscription Price (Troll Coins)</label>
                  <input
                    type="number"
                    min="10"
                    max="10000"
                    value={creatorSubscriptionPrice}
                    onChange={(e) => setCreatorSubscriptionPrice(Math.max(10, Math.min(10000, parseInt(e.target.value) || 100)))}
                    disabled={!creatorSubscriptionEnabled}
                    className={`w-full px-4 py-2 ${trollCityTheme.components.input} rounded-xl text-white focus:outline-none transition-colors disabled:opacity-50`}
                  />
                  <p className={`text-xs ${trollCityTheme.text.muted}`}>
                    Subscribers get badge, seat discounts, and instant seat approval.
                  </p>
                </div>
              </div>
            </div>

            {/* Family & Minor Settings */}
            {profile && (
              <div className={`${trollCityTheme.components.card}`}>
                <FamilyMinorSettings 
                  profile={profile as any} 
                  onUpdate={() => refreshProfile()}
                />
              </div>
            )}

            <div className={`${trollCityTheme.components.card}`}>
              <div className="flex items-center gap-2 mb-4">
                <Boxes className="w-5 h-5 text-purple-300" />
                <h2 className="text-xl font-semibold">My Items</h2>
              </div>
              <UserInventory embedded />
            </div>

            {/* Password Reset */}
            <div className={`${trollCityTheme.components.card}`}>
              <div className="flex items-center gap-3">
                <KeyRound className="w-5 h-5 text-emerald-400" />
                <div>
                  <h2 className="text-lg font-semibold">Password Reset</h2>
                  <p className={`text-xs ${trollCityTheme.text.muted}`}>Use the &quot;Forgot Password&quot; link on the sign-in page to reset your password via email.</p>
                </div>
              </div>
            </div>

            <div className={`${trollCityTheme.components.card} flex items-center justify-between`}>
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-pink-400" />
                <div>
                  <h2 className="text-lg font-semibold">Profile Picture Customizer</h2>
                  <p className={`text-xs ${trollCityTheme.text.muted}`}>Equip clothing and update your look.</p>
                </div>
              </div>
              <button
                onClick={() => navigate('/avatar-customizer')}
                className={`px-4 py-2 rounded-lg ${trollCityTheme.gradients.button} text-white text-sm font-semibold`}
              >
                Open
              </button>
            </div>

            <div className={`${trollCityTheme.components.card} flex items-center justify-between`}>
              <div className="flex items-center gap-3">
                <Ban className="w-5 h-5 text-amber-400" />
                <div>
                  <h2 className="text-lg font-semibold">Blocked Users</h2>
                  <p className={`text-xs ${trollCityTheme.text.muted}`}>View and manage users you've blocked.</p>
                </div>
              </div>
              <button
                onClick={() => navigate('/blocked-users')}
                className={`px-4 py-2 rounded-lg ${trollCityTheme.gradients.button} text-white text-sm font-semibold`}
              >
                Manage
              </button>
            </div>

            <div className={`${trollCityTheme.components.card} border border-red-500/30 flex items-center justify-between`}>
              <div className="flex items-center gap-3">
                <Trash2 className="w-5 h-5 text-red-400" />
                <div>
                  <h2 className="text-lg font-semibold text-red-400">Delete Account</h2>
                  <p className={`text-xs ${trollCityTheme.text.muted}`}>Permanently delete your account and all data.</p>
                </div>
              </div>
              <button
                onClick={() => navigate('/profile/delete')}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-white text-sm font-semibold"
              >
                Delete
              </button>
            </div>
          </div>
        )}

        {/* Profile Customization Tab */}
        {activeTab === 'customization' && (
          <ProfileCustomization />
        )}
      </div>
    </div>
  )
}
