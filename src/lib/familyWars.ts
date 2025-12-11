// src/lib/familyWars.ts
// Family war scoring and completion utilities

import { supabase } from './supabase'

/**
 * Update war score for a family
 */
export async function updateWarScore(warId: string, familyId: string, scoreIncrement: number) {
  try {
    // Get current score
    const { data: currentScore } = await supabase
      .from('family_war_scores')
      .select('score')
      .eq('war_id', warId)
      .eq('family_id', familyId)
      .single()

    const newScore = (currentScore?.score || 0) + scoreIncrement

    // Update or insert score
    const { error } = await supabase
      .from('family_war_scores')
      .upsert({
        war_id: warId,
        family_id: familyId,
        score: newScore,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'war_id,family_id'
      })

    if (error) {
      console.error('Failed to update war score:', error)
      return { success: false, error }
    }

    // Check if war should be completed
    await checkWarCompletion(warId)

    return { success: true, newScore }
  } catch (error) {
    console.error('updateWarScore error:', error)
    return { success: false, error }
  }
}

/**
 * Check if a war should be completed and handle completion
 */
export async function checkWarCompletion(warId: string) {
  try {
    // Get war details
    const { data: war } = await supabase
      .from('family_wars')
      .select('*')
      .eq('id', warId)
      .eq('status', 'active')
      .single()

    if (!war) return // War not active or doesn't exist

    // Check if war has ended
    const now = new Date()
    const endsAt = new Date(war.ends_at)

    if (now >= endsAt) {
      await completeWar(warId)
    }
  } catch (error) {
    console.error('checkWarCompletion error:', error)
  }
}

/**
 * Complete a war and determine winner
 */
export async function completeWar(warId: string) {
  try {
    // Get war details and scores
    const { data: war } = await supabase
      .from('family_wars')
      .select('*')
      .eq('id', warId)
      .single()

    if (!war || war.status !== 'active') return

    // Get scores for both families
    const { data: scores } = await supabase
      .from('family_war_scores')
      .select('family_id, score')
      .eq('war_id', warId)

    if (!scores || scores.length === 0) {
      // No scores, mark as cancelled
      await supabase
        .from('family_wars')
        .update({
          status: 'cancelled',
          ends_at: new Date().toISOString()
        })
        .eq('id', warId)
      return
    }

    // Find winner
    let winnerId = null
    let maxScore = 0

    for (const score of scores) {
      if (score.score > maxScore) {
        maxScore = score.score
        winnerId = score.family_id
      } else if (score.score === maxScore) {
        // Tie - no winner
        winnerId = null
      }
    }

    // Update war with winner
    await supabase
      .from('family_wars')
      .update({
        status: 'completed',
        winner_family_id: winnerId,
        ends_at: new Date().toISOString()
      })
      .eq('id', warId)

    // Log war completion
    const winnerMessage = winnerId
      ? `Family war completed! Winner: Family ${winnerId}`
      : 'Family war completed! It was a tie!'

    await supabase
      .from('family_activity_log')
      .insert([
        {
          family_id: war.family_a_id,
          event_type: 'war_completed',
          event_message: winnerMessage
        },
        {
          family_id: war.family_b_id,
          event_type: 'war_completed',
          event_message: winnerMessage
        }
      ])

    // Award bonus coins to winner
    if (winnerId) {
      const bonusCoins = 1000 // Configurable war win bonus

      await supabase.rpc('increment_family_stats', {
        p_family_id: winnerId,
        p_coin_bonus: bonusCoins,
        p_xp_bonus: 0
      })

      // Track war win for tasks
      try {
        const { data: members } = await supabase
          .from('family_members')
          .select('user_id')
          .eq('family_id', winnerId)

        if (members) {
          const { trackWarWon } = await import('./familyTasks')
          for (const member of members) {
            await trackWarWon(winnerId, member.user_id)
          }
        }
      } catch (taskErr) {
        console.warn('Failed to track war win for tasks:', taskErr)
      }
    }

    return { success: true, winnerId }
  } catch (error) {
    console.error('completeWar error:', error)
    return { success: false, error }
  }
}

/**
 * Track member activity for war scoring
 */
export async function trackWarActivity(userId: string, activityType: 'coin_earned' | 'xp_earned' | 'gift_sent', amount: number) {
  try {
    // Get user's family
    const { data: familyMember } = await supabase
      .from('family_members')
      .select('family_id')
      .eq('user_id', userId)
      .single()

    if (!familyMember?.family_id) return

    // Get active wars for this family
    const { data: wars } = await supabase
      .from('family_wars')
      .select('id')
      .or(`family_a_id.eq.${familyMember.family_id},family_b_id.eq.${familyMember.family_id}`)
      .eq('status', 'active')

    if (!wars || wars.length === 0) return

    // Calculate score contribution based on activity type
    let scoreContribution = 0
    switch (activityType) {
      case 'coin_earned':
        scoreContribution = Math.floor(amount * 0.1) // 10% of coins earned
        break
      case 'xp_earned':
        scoreContribution = Math.floor(amount * 0.05) // 5% of XP earned
        break
      case 'gift_sent':
        scoreContribution = amount * 10 // 10 points per gift
        break
    }

    if (scoreContribution > 0) {
      // Update score for each active war
      for (const war of wars) {
        await updateWarScore(war.id, familyMember.family_id, scoreContribution)
      }
    }
  } catch (error) {
    console.error('trackWarActivity error:', error)
  }
}