/// <reference path="../global.d.ts" />

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { userId, method, methodId, amount, currency, description, coinAmount, idempotency_key } = await req.json();

    if (!userId || !method || !methodId || !amount || !currency || !description) {
      throw new Error('Missing required payment parameters');
    }

    // Get environment variables
    const SQUARE_ACCESS_TOKEN = Deno.env.get('SQUARE_ACCESS_TOKEN');
    const SQUARE_LOCATION_ID = Deno.env.get('SQUARE_LOCATION_ID');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    // Validate required environment variables
    if (!SQUARE_ACCESS_TOKEN || !SQUARE_LOCATION_ID || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required environment variables. Please ensure SQUARE_ACCESS_TOKEN, SQUARE_LOCATION_ID, SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY are configured.');
    }

    // Create Supabase client with service role key for admin access
    const supabaseClient = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    // Get user's profile to verify payment method ownership
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('apple_pay_id, google_wallet_id, chime_id, cashapp_id')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      throw new Error('User profile not found');
    }

    // Verify the payment method belongs to the user
    const methodMap = {
      'apple_pay': profile.apple_pay_id,
      'google_wallet': profile.google_wallet_id,
      'chime': profile.chime_id,
      'cashapp': profile.cashapp_id,
    };

    if (methodMap[method] !== methodId) {
      throw new Error('Payment method does not belong to user');
    }

    // Process payment based on method type
    let squareSourceId;
    let paymentMethodDescription;

    switch (method) {
      case 'apple_pay':
        squareSourceId = methodId;
        paymentMethodDescription = 'Apple Pay';
        break;
      case 'google_wallet':
        squareSourceId = methodId;
        paymentMethodDescription = 'Google Wallet';
        break;
      case 'chime':
        squareSourceId = methodId;
        paymentMethodDescription = 'Chime';
        break;
      case 'cashapp':
        squareSourceId = methodId;
        paymentMethodDescription = 'Cash App';
        break;
      default:
        throw new Error('Unsupported payment method');
    }

    // Calculate fees (use defaults since we're not using database config)
    const feePercentage = 2.9;
    const fixedFeeCents = 30;
    const percentageFee = Math.round((amount * feePercentage) / 100);
    const totalFee = percentageFee + fixedFeeCents;
    const netAmount = amount - totalFee;

    // Process payment through Square
    let squareResponse;
    let squareData;
    
    try {
      squareResponse = await fetch('https://connect.squareup.com/v2/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
          'Square-Version': '2023-10-18',
        },
        body: JSON.stringify({
          source_id: squareSourceId,
          amount_money: {
            amount: amount,
            currency: currency,
          },
          idempotency_key: idempotency_key || `${userId}-${Date.now()}`,
          note: `${description} - ${paymentMethodDescription}`,
        }),
      });

      squareData = await squareResponse.json();
    } catch (fetchError) {
      console.error('Square API request failed:', fetchError);
      throw new Error(`Payment gateway error: ${fetchError.message}`);
    }

    if (!squareResponse.ok || squareData.errors) {
      const errorMessage = squareData.errors?.[0]?.detail || 'Square payment failed';
      console.error('Square payment error:', squareData.errors);
      throw new Error(`Payment failed: ${errorMessage}`);
    }

    // Record the transaction
    try {
      const { error: transactionError } = await supabaseClient
        .from('square_transactions')
        .insert({
          user_id: userId,
          square_transaction_id: squareData.payment.id,
          amount: amount / 100, // Convert cents to dollars
          currency: currency,
          status: squareData.payment.status,
          payment_method: paymentMethodDescription,
          description: description,
          fee_amount: totalFee / 100,
          net_amount: netAmount / 100,
          created_date: new Date().toISOString(),
        });

      if (transactionError) {
        console.error('Error recording transaction:', transactionError);
        // Don't throw here - payment succeeded but recording failed
      }
    } catch (dbError) {
      console.error('Database transaction recording error:', dbError);
      // Continue execution - payment succeeded even if recording failed
    }

    // Credit coins to user
    try {
      // Get current user balances
      const { data: currentProfile, error: profileError } = await supabaseClient
        .from('profiles')
        .select('coins, purchased_coins')
        .eq('id', userId)
        .single();

      if (profileError || !currentProfile) {
        throw new Error('Could not fetch user profile for coin update');
      }

      // Update user coins
      const { error: coinError } = await supabaseClient
        .from('profiles')
        .update({
          coins: (currentProfile.coins || 0) + coinAmount,
          purchased_coins: (currentProfile.purchased_coins || 0) + coinAmount,
        })
        .eq('id', userId);

      if (coinError) {
        console.error('Error crediting coins:', coinError);
        throw new Error('Failed to credit coins to user account');
      }

      console.log(`Successfully credited ${coinAmount} coins to user ${userId}`);
    } catch (coinUpdateError) {
      console.error('Coin crediting error:', coinUpdateError);
      throw new Error(`Failed to update user coins: ${coinUpdateError.message}`);
    }

    // Record coin purchase
    try {
      const { error: purchaseError } = await supabaseClient
        .from('coin_purchases')
        .insert({
          user_id: userId,
          coin_amount: coinAmount,
          usd_amount: amount / 100,
          status: 'completed',
          square_charge_id: squareData.payment.id,
          created_date: new Date().toISOString(),
        });

      if (purchaseError) {
        console.error('Error recording coin purchase:', purchaseError);
      } else {
        console.log(`Successfully recorded coin purchase for user ${userId}`);
      }
    } catch (purchaseRecordError) {
      console.error('Purchase recording error:', purchaseRecordError);
    }

    console.log(`Payment processed successfully for user ${userId}: ${paymentMethodDescription} payment of $${(amount/100).toFixed(2)} (${coinAmount} coins)`);
    
    return new Response(
      JSON.stringify({
        success: true,
        transactionId: squareData.payment.id,
        amount: amount / 100,
        coinAmount: coinAmount,
        paymentMethod: paymentMethodDescription,
        status: squareData.payment.status,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('Payment processing error:', {
      message: error.message,
      stack: error.stack,
      userId: error.userId || 'unknown',
      method: error.method || 'unknown',
      amount: typeof error.amount === 'object' ? JSON.stringify(error.amount) : (error.amount || 'unknown')
    });
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Payment processing failed',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: error.message.includes('Missing required') ? 400 : 500,
      }
    );
  }
});