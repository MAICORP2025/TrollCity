import React from 'react'
import { Shield, Skull, Star, ClipboardList } from 'lucide-react'
import OfficerTierBadge from './OfficerTierBadge'
import { EmpireBadge } from './EmpireBadge'

interface UserBadgeProps {
  profile: {
    is_officer?: boolean
    is_og?: boolean
    is_troll_officer?: boolean
    is_og_user?: boolean
    role?: string
    level?: number
    prestige_level?: number
    drivers_license_status?: string
    is_landlord?: boolean
    is_admin?: boolean
    is_troller?: boolean
    officer_level?: number
    troller_level?: number
    empire_role?: string | null
    royal_title?: any // If available in the profile object
  } | null | undefined
}

export default function UserBadge({ profile }: UserBadgeProps) {
    if (!profile) return null

    // Determine roles
    const isAdmin = profile.is_admin || profile.role === 'admin'
    const isTempAdmin = profile.role === 'temp_city_admin'
    const isOfficer = !isAdmin && !isTempAdmin && (
        profile.is_troll_officer || 
        profile.role === 'troll_officer'
    )
    const isSecretary = !isAdmin && !isTempAdmin && !isOfficer && (
        profile.role === 'secretary'
    )
    const isTroller = !isAdmin && !isTempAdmin && !isOfficer && !isSecretary && (
        profile.is_troller || 
        profile.role === 'troller'
    )

    const officerLevel = profile.officer_level || 1
    const trollerLevel = profile.troller_level || 1

    const trollerTitles: Record<number, string> = {
        1: 'Troller',
        2: 'Chaos Agent',
        3: 'Supreme Troll',
    }

    return (
        <span className="inline-flex items-center gap-1 align-middle">
            {/* Admin Badge */}
            {(isAdmin || isTempAdmin) && (
                <span className="inline-flex items-center justify-center w-5 h-5 bg-red-500/20 text-red-500 rounded border border-red-500/30" title={isTempAdmin ? "City Admin (Temporary)" : "Admin"}>
                    <Shield size={12} fill="currentColor" />
                </span>
            )}

            {/* Officer Badge */}
            {isOfficer && (
                <OfficerTierBadge level={officerLevel} />
            )}

            {/* Secretary Badge */}
            {isSecretary && (
                <span className="inline-flex items-center justify-center w-5 h-5 bg-pink-500/20 text-pink-400 rounded border border-pink-500/30" title="Secretary">
                    <ClipboardList size={12} />
                </span>
            )}

            {/* Troller Badge */}
            {isTroller && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30" title={trollerTitles[trollerLevel] || 'Troller'}>
                    <Skull size={12} />
                    <span className="text-[10px] font-bold uppercase hidden sm:inline">
                        {trollerTitles[trollerLevel] || 'Troller'}
                    </span>
                </span>
            )}

            {/* OG Badge */}
            {profile.is_og_user && (
                <span className="inline-flex items-center justify-center w-5 h-5 bg-yellow-500/20 text-yellow-500 rounded-full border border-yellow-500/30" title="OG User">
                    <Star size={12} fill="currentColor" />
                </span>
            )}

            {/* Empire Badge */}
            <EmpireBadge empireRole={profile.empire_role} />
        </span>
    )
}
