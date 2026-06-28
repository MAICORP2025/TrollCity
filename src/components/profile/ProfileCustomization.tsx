/**
 * ProfileCustomization.tsx
 * Main profile customization component for Account Settings
 */

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';
import { 
    Save, Palette, Image, User, MapPin, Link2, 
    Eye, EyeOff, GripVertical, Trash2, Plus, Check, X
} from 'lucide-react';
import CoverPhotoUpload from './CoverPhotoUpload';
import AvatarUpload from './AvatarUpload';
import SocialLinksManager from './SocialLinksManager';
import ProfilePreview from './ProfilePreview';
import FeaturedContentManager from './FeaturedContentManager';

interface ProfileCustomizationData {
    display_name: string;
    username: string;
    bio: string;
    avatar_url: string | null;
    cover_url: string | null;
    city: string | null;
    country: string | null;
    pronouns: string | null;
    website: string | null;
    theme_color: string;
    accent_color: string;
    background_style: string;
    card_style: string;
}

interface ValidationErrors {
    display_name?: string;
    username?: string;
    bio?: string;
    website?: string;
}

const PRONOUNS_OPTIONS = [
    { value: '', label: 'Prefer not to say' },
    { value: 'he/him', label: 'He/Him' },
    { value: 'she/her', label: 'She/Her' },
    { value: 'they/them', label: 'They/Them' },
    { value: 'he/they', label: 'He/They' },
    { value: 'she/they', label: 'She/They' },
    { value: 'xe/xem', label: 'Xe/Xem' },
    { value: 'ze/zir', label: 'Ze/Zir' },
    { value: 'other', label: 'Other' },
];

const BACKGROUND_STYLES = [
    { value: 'gradient', label: 'Gradient' },
    { value: 'solid', label: 'Solid Color' },
    { value: 'pattern', label: 'Pattern' },
    { value: 'image', label: 'Custom Image' },
];

const CARD_STYLES = [
    { value: 'glass', label: 'Glass' },
    { value: 'solid', label: 'Solid' },
    { value: 'bordered', label: 'Bordered' },
    { value: 'minimal', label: 'Minimal' },
];

const THEME_COLORS = [
    '#9333ea', '#a855f7', '#d946ef', '#ec4899', '#f43f5e',
    '#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e',
    '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
];

export default function ProfileCustomization() {
    const { user, profile, refreshProfile } = useAuthStore();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    
    const [formData, setFormData] = useState<ProfileCustomizationData>({
        display_name: '',
        username: '',
        bio: '',
        avatar_url: null,
        cover_url: null,
        city: null,
        country: null,
        pronouns: null,
        website: null,
        theme_color: '#9333ea',
        accent_color: '#22d3ee',
        background_style: 'gradient',
        card_style: 'glass',
    });
    
    const [errors, setErrors] = useState<ValidationErrors>({});
    const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
    const [checkingUsername, setCheckingUsername] = useState(false);

    useEffect(() => {
        if (profile) {
            setFormData({
                display_name: (profile as any).display_name || '',
                username: (profile as any).username || '',
                bio: (profile as any).bio || '',
                avatar_url: (profile as any).avatar_url || null,
                cover_url: (profile as any).cover_url || (profile as any).banner_url || null,
                city: (profile as any).city || null,
                country: (profile as any).country || null,
                pronouns: (profile as any).pronouns || null,
                website: (profile as any).website || null,
                theme_color: (profile as any).theme_color || '#9333ea',
                accent_color: (profile as any).accent_color || '#22d3ee',
                background_style: (profile as any).background_style || 'gradient',
                card_style: (profile as any).card_style || 'glass',
            });
            setLoading(false);
        }
    }, [profile]);

    const checkUsernameAvailability = useCallback(async (username: string) => {
        if (!username || username.length < 2) {
            setUsernameAvailable(null);
            return;
        }
        
        if (!/^[a-zA-Z0-9_]{2,20}$/.test(username)) {
            setUsernameAvailable(false);
            return;
        }
        
        if (username === profile?.username) {
            setUsernameAvailable(true);
            return;
        }
        
        setCheckingUsername(true);
        try {
            const { data } = await supabase
                .from('user_profiles')
                .select('id')
                .eq('username', username)
                .neq('id', user?.id)
                .maybeSingle();
            
            setUsernameAvailable(!data);
        } catch {
            setUsernameAvailable(null);
        } finally {
            setCheckingUsername(false);
        }
    }, [user?.id, profile?.username]);

    const validateForm = (): boolean => {
        const newErrors: ValidationErrors = {};
        
        if (!formData.display_name.trim()) {
            newErrors.display_name = 'Display name is required';
        } else if (formData.display_name.length > 50) {
            newErrors.display_name = 'Display name must be 50 characters or less';
        }
        
        if (!formData.username.trim()) {
            newErrors.username = 'Username is required';
        } else if (!/^[a-zA-Z0-9_]{2,20}$/.test(formData.username)) {
            newErrors.username = 'Username must be 2-20 characters (letters, numbers, underscores)';
        } else if (usernameAvailable === false) {
            newErrors.username = 'Username is already taken';
        }
        
        if (formData.bio.length > 500) {
            newErrors.bio = 'Bio must be 500 characters or less';
        }
        
        if (formData.website && !isValidUrl(formData.website)) {
            newErrors.website = 'Please enter a valid URL (https://...)';
        }
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const isValidUrl = (url: string): boolean => {
        try {
            new URL(url);
            return url.startsWith('http://') || url.startsWith('https://');
        } catch {
            return false;
        }
    };

    const handleInputChange = (field: keyof ProfileCustomizationData, value: string | null) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        
        if (field === 'username') {
            checkUsernameAvailability(value as string);
        }
        
        if (errors[field as keyof ValidationErrors]) {
            setErrors(prev => ({ ...prev, [field]: undefined }));
        }
    };

    const handleAvatarChange = async (url: string | null) => {
        if (!user) return;
        
        try {
            const { error } = await supabase
                .from('user_profiles')
                .update({ avatar_url: url, updated_at: new Date().toISOString() })
                .eq('id', user.id);
            
            if (error) throw error;
            setFormData(prev => ({ ...prev, avatar_url: url }));
            await refreshProfile(true);
            toast.success('Profile picture updated');
        } catch {
            toast.error('Failed to update profile picture');
        }
    };

    const handleCoverChange = async (url: string | null) => {
        if (!user) return;
        
        try {
            const { error } = await supabase
                .from('user_profiles')
                .update({ cover_url: url, updated_at: new Date().toISOString() })
                .eq('id', user.id);
            
            if (error) throw error;
            setFormData(prev => ({ ...prev, cover_url: url }));
            await refreshProfile(true);
            toast.success('Cover photo updated');
        } catch {
            toast.error('Failed to update cover photo');
        }
    };

    const handleSave = async () => {
        if (!user || !validateForm()) return;
        
        setSaving(true);
        try {
            // Update user_profiles
            const { error: profileError } = await supabase
                .from('user_profiles')
                .update({
                    display_name: formData.display_name.trim(),
                    username: formData.username.trim().toLowerCase(),
                    bio: formData.bio.trim(),
                    city: formData.city?.trim() || null,
                    country: formData.country?.trim() || null,
                    pronouns: formData.pronouns || null,
                    website: formData.website?.trim() || null,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', user.id);
            
            if (profileError) throw profileError;
            
            // Update profile_customization
            const { error: customError } = await supabase.rpc('upsert_profile_customization', {
                p_user_id: user.id,
                p_theme_color: formData.theme_color,
                p_accent_color: formData.accent_color,
                p_background_style: formData.background_style,
                p_card_style: formData.card_style,
            });
            
            if (customError) throw customError;
            
            await refreshProfile(true);
            toast.success('Profile customization saved!');
        } catch (err: any) {
            console.error('Error saving profile:', err);
            toast.error(err.message || 'Failed to save profile');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-500 border-t-transparent" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                        <Palette className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white">Profile Customization</h2>
                        <p className="text-sm text-white/50">Personalize your public profile</p>
                    </div>
                </div>
                <button
                    onClick={() => setShowPreview(!showPreview)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 transition-colors"
                >
                    <Eye className="w-4 h-4" />
                    {showPreview ? 'Hide Preview' : 'Show Preview'}
                </button>
            </div>

            {/* Live Preview */}
            {showPreview && (
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                    <h3 className="text-sm font-semibold text-white/70 mb-3">Live Preview</h3>
                    <ProfilePreview 
                        profile={{
                            ...profile,
                            ...formData,
                        }}
                        customization={formData}
                    />
                </div>
            )}

            {/* Profile Pictures */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Image className="w-5 h-5 text-purple-400" />
                    Profile Pictures
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm text-white/60 mb-2">Profile Picture</label>
                        <AvatarUpload
                            currentUrl={formData.avatar_url}
                            onUploadComplete={handleAvatarChange}
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-white/60 mb-2">Cover Banner</label>
                        <CoverPhotoUpload
                            currentCoverUrl={formData.cover_url}
                            onUploadComplete={handleCoverChange}
                        />
                    </div>
                </div>
            </div>

            {/* Basic Information */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <User className="w-5 h-5 text-purple-400" />
                    Basic Information
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm text-white/60 mb-2">
                            Display Name <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.display_name}
                            onChange={(e) => handleInputChange('display_name', e.target.value)}
                            className={`w-full px-4 py-3 rounded-xl bg-white/5 border ${
                                errors.display_name ? 'border-red-500' : 'border-white/10'
                            } text-white placeholder-white/30 focus:outline-none focus:border-purple-500 transition-colors`}
                            placeholder="Your display name"
                            maxLength={50}
                        />
                        {errors.display_name && (
                            <p className="mt-1 text-xs text-red-400">{errors.display_name}</p>
                        )}
                    </div>
                    
                    <div>
                        <label className="block text-sm text-white/60 mb-2">
                            Username <span className="text-red-400">*</span>
                        </label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30">@</span>
                            <input
                                type="text"
                                value={formData.username}
                                onChange={(e) => handleInputChange('username', e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                                className={`w-full pl-8 pr-10 py-3 rounded-xl bg-white/5 border ${
                                    errors.username ? 'border-red-500' : 
                                    usernameAvailable === false ? 'border-red-500' :
                                    usernameAvailable === true ? 'border-green-500' : 'border-white/10'
                                } text-white placeholder-white/30 focus:outline-none focus:border-purple-500 transition-colors`}
                                placeholder="username"
                                maxLength={20}
                            />
                            {checkingUsername && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-purple-500 border-t-transparent" />
                                </div>
                            )}
                            {!checkingUsername && usernameAvailable !== null && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                    {usernameAvailable ? (
                                        <Check className="w-4 h-4 text-green-400" />
                                    ) : (
                                        <X className="w-4 h-4 text-red-400" />
                                    )}
                                </div>
                            )}
                        </div>
                        {errors.username && (
                            <p className="mt-1 text-xs text-red-400">{errors.username}</p>
                        )}
                        {usernameAvailable === true && formData.username !== profile?.username && (
                            <p className="mt-1 text-xs text-green-400">Username available!</p>
                        )}
                    </div>
                    
                    <div className="md:col-span-2">
                        <label className="block text-sm text-white/60 mb-2">
                            Bio ({formData.bio.length}/500)
                        </label>
                        <textarea
                            value={formData.bio}
                            onChange={(e) => handleInputChange('bio', e.target.value)}
                            rows={4}
                            className={`w-full px-4 py-3 rounded-xl bg-white/5 border ${
                                errors.bio ? 'border-red-500' : 'border-white/10'
                            } text-white placeholder-white/30 focus:outline-none focus:border-purple-500 transition-colors resize-none`}
                            placeholder="Tell us about yourself..."
                            maxLength={500}
                        />
                        {errors.bio && (
                            <p className="mt-1 text-xs text-red-400">{errors.bio}</p>
                        )}
                    </div>
                    
                    <div>
                        <label className="block text-sm text-white/60 mb-2">Pronouns</label>
                        <select
                            value={formData.pronouns || ''}
                            onChange={(e) => handleInputChange('pronouns', e.target.value || null)}
                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-purple-500 transition-colors"
                        >
                            {PRONOUNS_OPTIONS.map(option => (
                                <option key={option.value} value={option.value} className="bg-slate-900">
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    
                    <div>
                        <label className="block text-sm text-white/60 mb-2">Website</label>
                        <input
                            type="url"
                            value={formData.website || ''}
                            onChange={(e) => handleInputChange('website', e.target.value)}
                            className={`w-full px-4 py-3 rounded-xl bg-white/5 border ${
                                errors.website ? 'border-red-500' : 'border-white/10'
                            } text-white placeholder-white/30 focus:outline-none focus:border-purple-500 transition-colors`}
                            placeholder="https://yourwebsite.com"
                        />
                        {errors.website && (
                            <p className="mt-1 text-xs text-red-400">{errors.website}</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Location */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-purple-400" />
                    Location
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm text-white/60 mb-2">City</label>
                        <input
                            type="text"
                            value={formData.city || ''}
                            onChange={(e) => handleInputChange('city', e.target.value)}
                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-purple-500 transition-colors"
                            placeholder="Your city"
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm text-white/60 mb-2">Country</label>
                        <input
                            type="text"
                            value={formData.country || ''}
                            onChange={(e) => handleInputChange('country', e.target.value)}
                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-purple-500 transition-colors"
                            placeholder="Your country"
                        />
                    </div>
                </div>
            </div>

            {/* Theme Colors */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Palette className="w-5 h-5 text-purple-400" />
                    Theme Colors
                </h3>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-white/60 mb-2">Primary Theme Color</label>
                        <div className="flex flex-wrap gap-2">
                            {THEME_COLORS.map(color => (
                                <button
                                    key={color}
                                    onClick={() => handleInputChange('theme_color', color)}
                                    className={`w-8 h-8 rounded-lg transition-transform hover:scale-110 ${
                                        formData.theme_color === color ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900' : ''
                                    }`}
                                    style={{ backgroundColor: color }}
                                />
                            ))}
                            <div className="relative">
                                <input
                                    type="color"
                                    value={formData.theme_color}
                                    onChange={(e) => handleInputChange('theme_color', e.target.value)}
                                    className="absolute inset-0 w-8 h-8 opacity-0 cursor-pointer"
                                />
                                <div className="w-8 h-8 rounded-lg border-2 border-dashed border-white/30 flex items-center justify-center text-white/50 hover:border-white/50 transition-colors">
                                    <Plus className="w-4 h-4" />
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div>
                        <label className="block text-sm text-white/60 mb-2">Accent Color</label>
                        <div className="flex flex-wrap gap-2">
                            {THEME_COLORS.map(color => (
                                <button
                                    key={color}
                                    onClick={() => handleInputChange('accent_color', color)}
                                    className={`w-8 h-8 rounded-lg transition-transform hover:scale-110 ${
                                        formData.accent_color === color ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900' : ''
                                    }`}
                                    style={{ backgroundColor: color }}
                                />
                            ))}
                            <div className="relative">
                                <input
                                    type="color"
                                    value={formData.accent_color}
                                    onChange={(e) => handleInputChange('accent_color', e.target.value)}
                                    className="absolute inset-0 w-8 h-8 opacity-0 cursor-pointer"
                                />
                                <div className="w-8 h-8 rounded-lg border-2 border-dashed border-white/30 flex items-center justify-center text-white/50 hover:border-white/50 transition-colors">
                                    <Plus className="w-4 h-4" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Profile Style */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Profile Style</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm text-white/60 mb-2">Background Style</label>
                        <div className="grid grid-cols-2 gap-2">
                            {BACKGROUND_STYLES.map(style => (
                                <button
                                    key={style.value}
                                    onClick={() => handleInputChange('background_style', style.value)}
                                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                                        formData.background_style === style.value
                                            ? 'bg-purple-500 text-white'
                                            : 'bg-white/5 text-white/70 hover:bg-white/10'
                                    }`}
                                >
                                    {style.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    <div>
                        <label className="block text-sm text-white/60 mb-2">Card Style</label>
                        <div className="grid grid-cols-2 gap-2">
                            {CARD_STYLES.map(style => (
                                <button
                                    key={style.value}
                                    onClick={() => handleInputChange('card_style', style.value)}
                                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                                        formData.card_style === style.value
                                            ? 'bg-purple-500 text-white'
                                            : 'bg-white/5 text-white/70 hover:bg-white/10'
                                    }`}
                                >
                                    {style.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Social Links */}
            <SocialLinksManager />

            {/* Featured Content */}
            <FeaturedContentManager />

            {/* Save Button */}
            <div className="flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold hover:from-purple-400 hover:to-pink-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Save className="w-5 h-5" />
                    {saving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>
        </div>
    );
}
