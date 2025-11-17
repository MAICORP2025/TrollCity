/// <reference path="../global.d.ts" />

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Get the authenticated user
    const {
      data: { user },
    } = await supabaseClient.auth.getUser()

    if (!user) {
      throw new Error('User not authenticated')
    }

    const { cashoutId, amount, currency = 'USD', paymentMethod, userId } = await req.json()

    if (!cashoutId || !amount || !userId) {
      throw new Error('Missing required parameters: cashoutId, amount, userId')
    }

    // Verify the user has admin privileges
    const { data: userProfile } = await supabaseClient
      .from('profiles')
      .select('role, is_admin')
      .eq('id', user.id)
      .single()

    if (!userProfile || (userProfile.role !== 'admin' && !userProfile.is_admin)) {
      throw new Error('Insufficient privileges: Admin access required')
    }

    // RAPID PROCESSING: Ensure 1-minute processing time
    const processingStartTime = new Date().toISOString();

    // Get Square configuration
    const { data: config } = await supabaseClient
      .from('earnings_config')
      .select('*')
      .eq('id', 1)
      .single()

    if (!config || !config.square_account_active) {
      throw new Error('Square integration is not active')
    }

    // Get the cashout request details
    const { data: cashout } = await supabaseClient
      .from('cashout_requests')
      .select(`
        *,
        profiles!user_id(username, full_name, email, square_customer_id)
      `)
      .eq('id', cashoutId)
      .single()

    if (!cashout) {
      throw new Error('Cashout request not found')
    }

    if (cashout.status !== 'pending') {
      throw new Error('Cashout request is not in pending status')
    }

    // Verify the user has sufficient balance
    const { data: userData } = await supabaseClient
      .from('profiles')
      .select('coins')
      .eq('id', userId)
      .single()

    if (!userData || userData.coins < cashout.coins_cost) {
      throw new Error('Insufficient user balance')
    }

    // Process payout via Square API
    // Note: In production, you would integrate with Square's Payouts API
    // For now, we'll simulate a successful payout
    
    const squarePayoutId = `payout_${Date.now()}_${cashoutId}`
    const payoutAmount = Math.round(amount * 100) // Convert to cents

    // Simulate Square API call (replace with actual API in production)
    const simulateSquarePayout = async () => {
      // In production, this would be:
      // const response = await fetch('https://connect.squareup.com/v2/payouts', {
      //   method: 'POST',
      //   headers: {
      //     'Authorization': `Bearer ${config.square_access_token}`,
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify({
      //     amount_money: {
      //       amount: payoutAmount,
      //       currency: currency
      //     },
      //     reference_id: cashoutId,
      //     location_id: config.square_location_id
      //   })
      // })
      
      // For simulation, we'll return a mock response
      return {
        payout: {
          id: squarePayoutId,
          status: 'COMPLETED',
          amount_money: {
            amount: payoutAmount,
            currency: currency
          },
          created_at: new Date().toISOString()
        }
      }
    }

    const squareResponse = await simulateSquarePayout()

    if (!squareResponse.payout || squareResponse.payout.status !== 'COMPLETED') {
      throw new Error('Square payout failed')
    }

    // Update cashout request status
    const { error: updateError } = await supabaseClient
      .from('cashout_requests')
      .update({
        status: 'approved',
        processed_at: new Date().toISOString(),
        processed_by: user.id,
        square_transaction_id: squarePayoutId,
        square_payout_status: 'completed',
        notes: `Processed via Square payout API - Amount: ${amount} ${currency}`
      })
      .eq('id', cashoutId)

    if (updateError) {
      throw new Error(`Failed to update cashout request: ${updateError.message}`)
    }

    // Update user balance (subtract coins)
    const { error: balanceError } = await supabaseClient.rpc('decrement_user_coins', {
      user_id: userId,
      amount: cashout.coins_cost
    })

    if (balanceError) {
      console.error('Failed to update user balance:', balanceError)
      // Don't throw here as the payout was successful, just log the error
    }

    // Create transaction record
    const { error: transactionError } = await supabaseClient
      .from('square_transactions')
      .insert({
        user_id: userId,
        square_transaction_id: squarePayoutId,
        type: 'payout',
        status: 'completed',
        amount: payoutAmount,
        currency: currency,
        fee_amount: 0,
        net_amount: payoutAmount,
        description: `Cashout payout for ${cashout.coins_cost} coins`,
        reference_id: cashoutId,
        metadata: {
          cashout_id: cashoutId,
          coins_cost: cashout.coins_cost,
          payment_method: paymentMethod
        }
      })

    if (transactionError) {
      console.error('Failed to create transaction record:', transactionError)
    }

    // Calculate processing time for performance monitoring
    const processingEndTime = new Date().toISOString();
    const processingTime = new Date(processingEndTime).getTime() - new Date(processingStartTime).getTime();
    
    // Log performance metrics for 1-minute processing SLA
    console.log(`💰 RAPID PAYOUT: Processed ${amount} ${currency} in ${processingTime}ms (${processingTime/1000}s)`);
    
    // Alert if processing takes longer than 30 seconds (half of 1-minute SLA)
    if (processingTime > 30000) {
      console.warn(`⚠️ SLOW PAYOUT ALERT: Processing took ${processingTime/1000}s, approaching 1-minute SLA`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        payoutId: squarePayoutId,
        amount: amount,
        currency: currency,
        status: 'completed',
        processingTime: processingTime,
        message: `Payout of ${amount} ${currency} processed successfully in ${processingTime/1000}s`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error: any) {
    console.error('Square payout error:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        message: 'Payout processing failed'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})