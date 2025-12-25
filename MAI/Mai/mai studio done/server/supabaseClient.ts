import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase credentials. Check .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const initializeTables = async () => {
  try {
    console.log('Database tables should be created manually via SUPABASE_SETUP.sql');
  } catch (error) {
    console.error('Error initializing tables:', error);
  }
};

export const createUserRecord = async (
  email: string,
  username: string,
  passwordHash: string
) => {
  const { data, error } = await supabase
    .from('users')
    .insert([
      {
        email,
        username,
        password: passwordHash,
        display_name: username,
        coin_balance: 0,
        profile_complete: false,
        role: email.toLowerCase() === 'trollcity2025@gmail.com' ? 'admin' : 'user',
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const getUserByEmail = async (email: string) => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
};

export const getUserById = async (id: string) => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
};

export const updateUserProfile = async (
  userId: string,
  updates: {
    display_name?: string;
    bio?: string;
    profile_complete?: boolean;
    avatar_url?: string;
  }
) => {
  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const getAllUsers = async () => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const grantCoins = async (userId: string, amount: number, grantedBy: string) => {
  const user = await getUserById(userId);
  if (!user) throw new Error('User not found');

  const newBalance = user.coin_balance + amount;

  const { data: updatedUser, error: updateError } = await supabase
    .from('users')
    .update({ coin_balance: newBalance })
    .eq('id', userId)
    .select()
    .single();

  if (updateError) throw updateError;

  await supabase.from('transactions').insert([
    {
      user_id: userId,
      amount,
      type: 'grant',
      description: `Granted by admin ${grantedBy}`,
    },
  ]);

  return updatedUser;
};

export const getAllTransactions = async () => {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const getUserTransactions = async (userId: string) => {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const setPayoutGoal = async (userId: string, coinGoal: number, payoutAmount: number) => {
  const { data: existing, error: checkError } = await supabase
    .from('payout_goals')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (checkError && checkError.code !== 'PGRST116') throw checkError;

  if (existing) {
    const { data, error } = await supabase
      .from('payout_goals')
      .update({ coin_goal: coinGoal, payout_amount: payoutAmount, updated_at: new Date() })
      .eq('user_id', userId)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase
      .from('payout_goals')
      .insert([{ user_id: userId, coin_goal: coinGoal, payout_amount: payoutAmount }])
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};

export const getPayoutGoal = async (userId: string) => {
  const { data, error } = await supabase
    .from('payout_goals')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
};

export const getAllPayoutGoals = async () => {
  const { data, error } = await supabase
    .from('payout_goals')
    .select('*')
    .eq('enabled', true)
    .order('user_id');

  if (error) throw error;
  return data || [];
};

export const togglePayoutGoal = async (userId: string, enabled: boolean) => {
  const { data, error } = await supabase
    .from('payout_goals')
    .update({ enabled })
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deletePayoutGoal = async (userId: string) => {
  const { error } = await supabase
    .from('payout_goals')
    .delete()
    .eq('user_id', userId);

  if (error) throw error;
};

export const processPayouts = async () => {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const isMonday = dayOfWeek === 1;
  const isFriday = dayOfWeek === 5;

  if (!isMonday && !isFriday) {
    return { processed: 0, message: 'Not a payout day (Monday or Friday)' };
  }

  const payoutGoals = await getAllPayoutGoals();
  let processedCount = 0;

  for (const goal of payoutGoals) {
    const user = await getUserById(goal.user_id);
    if (!user) continue;

    const lastPayout = goal.last_payout_date ? new Date(goal.last_payout_date) : null;
    const lastPayoutWasToday = lastPayout && 
      lastPayout.toDateString() === now.toDateString();

    if (lastPayoutWasToday) continue;

    if (user.coin_balance >= goal.coin_goal) {
      const newBalance = user.coin_balance - goal.coin_goal;
      
      await supabase
        .from('users')
        .update({ coin_balance: newBalance })
        .eq('id', goal.user_id);

      await supabase.from('transactions').insert([
        {
          user_id: goal.user_id,
          amount: goal.payout_amount,
          type: 'payout',
          description: `Automated payout for reaching ${goal.coin_goal} coin goal`,
        },
      ]);

      await supabase
        .from('payout_goals')
        .update({ last_payout_date: now })
        .eq('user_id', goal.user_id);

      processedCount++;
    }
  }

  return { processed: processedCount, message: `Processed ${processedCount} payouts` };
};

export const getAllContent = async () => {
  const { data, error } = await supabase
    .from('content')
    .select('*, creator:creator_id(id, username, display_name, role)')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const getContentById = async (id: string) => {
  const { data, error } = await supabase
    .from('content')
    .select('*, creator:creator_id(id, username, display_name, role)')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
};

export const getContentByCreator = async (creatorId: string) => {
  const { data, error } = await supabase
    .from('content')
    .select('*')
    .eq('creator_id', creatorId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const deleteContent = async (contentId: string) => {
  const { error } = await supabase
    .from('content')
    .delete()
    .eq('id', contentId);

  if (error) throw error;
};

export const updateContentStatus = async (contentId: string, status: 'pending' | 'approved' | 'rejected') => {
  const { data, error } = await supabase
    .from('content')
    .update({ status, updated_at: new Date() })
    .eq('id', contentId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const restrictCreator = async (creatorId: string) => {
  const { data, error } = await supabase
    .from('users')
    .update({ role: 'user' })
    .eq('id', creatorId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const unrestrictCreator = async (creatorId: string) => {
  const { data, error } = await supabase
    .from('users')
    .update({ role: 'creator' })
    .eq('id', creatorId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const submitCreatorApplication = async (
  userId: string,
  applicationData: {
    legal_name: string;
    creator_name: string;
    dob: string;
    email: string;
    phone?: string;
    location?: string;
    bio?: string;
    category?: string;
    social_links?: Record<string, string>;
    id_file_url_front?: string;
    id_file_url_back?: string;
  }
) => {
  const { data, error } = await supabase
    .from('creator_applications')
    .insert([{ user_id: userId, ...applicationData }])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const getCreatorApplication = async (userId: string) => {
  const { data, error } = await supabase
    .from('creator_applications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
};

export const getAllCreatorApplications = async () => {
  const { data, error } = await supabase
    .from('creator_applications')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const approveCreatorApplication = async (
  applicationId: string,
  adminId: string,
  creatorName: string,
  bio: string,
  category: string
) => {
  const application = await supabase
    .from('creator_applications')
    .select('user_id')
    .eq('id', applicationId)
    .single();

  if (application.error) throw application.error;

  const { data: _updateData, error: updateError } = await supabase
    .from('creator_applications')
    .update({
      status: 'approved',
      reviewed_by: adminId,
      reviewed_at: new Date(),
    })
    .eq('id', applicationId)
    .select()
    .single();

  if (updateError) throw updateError;

  const { data: creatorData, error: creatorError } = await supabase
    .from('creators')
    .insert([
      {
        user_id: application.data.user_id,
        creator_name: creatorName,
        bio,
        category,
      },
    ])
    .select()
    .single();

  if (creatorError) throw creatorError;

  await supabase
    .from('users')
    .update({ role: 'creator' })
    .eq('id', application.data.user_id);

  return creatorData;
};

export const denyCreatorApplication = async (
  applicationId: string,
  adminId: string,
  notes: string
) => {
  const { data, error } = await supabase
    .from('creator_applications')
    .update({
      status: 'denied',
      reviewed_by: adminId,
      reviewed_at: new Date(),
      admin_notes: notes,
    })
    .eq('id', applicationId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const getCreatorProfile = async (userId: string) => {
  const { data, error } = await supabase
    .from('creators')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
};

export const createCreatorPerk = async (
  creatorId: string,
  perkData: {
    title: string;
    description?: string;
    coin_cost: number;
    perk_type: string;
    perk_limit?: number;
  }
) => {
  const { data, error } = await supabase
    .from('creator_perks')
    .insert([{ creator_id: creatorId, ...perkData }])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const getCreatorPerks = async (creatorId: string) => {
  const { data, error } = await supabase
    .from('creator_perks')
    .select('*')
    .eq('creator_id', creatorId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const updateCreatorPerk = async (
  perkId: string,
  updates: { title?: string; description?: string; coin_cost?: number; active?: boolean }
) => {
  const { data, error } = await supabase
    .from('creator_perks')
    .update(updates)
    .eq('id', perkId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deleteCreatorPerk = async (perkId: string) => {
  const { error } = await supabase.from('creator_perks').delete().eq('id', perkId);

  if (error) throw error;
};

export const purchasePerk = async (
  userId: string,
  perkId: string,
  creatorId: string,
  coinAmount: number,
  expiresAt?: string
) => {
  const { data, error } = await supabase
    .from('perk_purchases')
    .insert([
      {
        user_id: userId,
        perk_id: perkId,
        creator_id: creatorId,
        coin_amount: coinAmount,
        expires_at: expiresAt,
      },
    ])
    .select()
    .single();

  if (error) throw error;

  const user = await getUserById(userId);
  const newBalance = user.coin_balance - coinAmount;
  await supabase.from('users').update({ coin_balance: newBalance }).eq('id', userId);

  await supabase.from('transactions').insert([
    {
      user_id: userId,
      amount: coinAmount,
      type: 'spend',
      description: `Purchased perk from creator`,
    },
  ]);

  return data;
};

export const getUserPerkPurchases = async (userId: string) => {
  const { data, error } = await supabase
    .from('perk_purchases')
    .select('*, perk:perk_id(*, creator:creator_id(creator_name))')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const getOrCreateConversation = async (userId1: string, userId2: string) => {
  const { data: existingConv, error: checkError } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('user_id', userId1);

  if (checkError) throw checkError;

  for (const member of existingConv || []) {
    const { data: otherMember, error: otherError } = await supabase
      .from('conversation_members')
      .select('user_id')
      .eq('conversation_id', member.conversation_id)
      .eq('user_id', userId2);

    if (otherError && otherError.code !== 'PGRST116') throw otherError;
    if (otherMember && otherMember.length > 0) {
      return member.conversation_id;
    }
  }

  const { data: newConv, error: convError } = await supabase
    .from('conversations')
    .insert([{}])
    .select()
    .single();

  if (convError) throw convError;

  await supabase.from('conversation_members').insert([
    { conversation_id: newConv.id, user_id: userId1 },
    { conversation_id: newConv.id, user_id: userId2 },
  ]);

  return newConv.id;
};

export const sendMessage = async (
  conversationId: string,
  senderId: string,
  content: string
) => {
  const { data, error } = await supabase
    .from('messages')
    .insert([
      {
        conversation_id: conversationId,
        sender_id: senderId,
        content,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const getConversationMessages = async (conversationId: string) => {
  const { data, error } = await supabase
    .from('messages')
    .select('*, sender:sender_id(id, username, display_name, avatar_url)')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
};

export const getUserConversations = async (userId: string) => {
  const { data, error } = await supabase
    .from('conversation_members')
    .select(
      'conversation_id, conversations(*, conversation_members(user:user_id(id, username, display_name, avatar_url)))'
    )
    .eq('user_id', userId)
    .order('conversations.updated_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const setCreatorMessagePricing = async (
  creatorId: string,
  pricing: {
    coin_cost_per_message: number;
    free_daily_messages?: number;
    vip_fans_message_free?: boolean;
    fam_members_discount_percent?: number;
  }
) => {
  const { data: existing, error: checkError } = await supabase
    .from('creator_message_pricing')
    .select('id')
    .eq('creator_id', creatorId)
    .single();

  if (checkError && checkError.code !== 'PGRST116') throw checkError;

  if (existing) {
    const { data, error } = await supabase
      .from('creator_message_pricing')
      .update(pricing)
      .eq('creator_id', creatorId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from('creator_message_pricing')
    .insert([{ creator_id: creatorId, ...pricing }])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const getCreatorMessagePricing = async (creatorId: string) => {
  const { data, error } = await supabase
    .from('creator_message_pricing')
    .select('*')
    .eq('creator_id', creatorId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
};

export const createMAIWheelReward = async (rewardData: {
  title: string;
  description?: string;
  rarity: string;
  reward_type: string;
  coin_value?: number;
  duration_hours?: number;
}) => {
  const { data, error } = await supabase
    .from('mai_wheel_rewards')
    .insert([rewardData])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const getAllMAIWheelRewards = async () => {
  const { data, error } = await supabase
    .from('mai_wheel_rewards')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const spinMAIWheel = async (userId: string, spinCost: number) => {
  const rewards = await getAllMAIWheelRewards();
  const randomReward = rewards[Math.floor(Math.random() * rewards.length)];

  const { data: spinData, error: spinError } = await supabase
    .from('mai_wheel_spins')
    .insert([{ user_id: userId, reward_id: randomReward.id, spin_cost: spinCost }])
    .select()
    .single();

  if (spinError) throw spinError;

  if (randomReward.duration_hours) {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + randomReward.duration_hours);

    await supabase.from('user_rewards_active').insert([
      {
        user_id: userId,
        reward_id: randomReward.id,
        expires_at: expiresAt.toISOString(),
      },
    ]);
  }

  if (spinCost > 0) {
    const user = await getUserById(userId);
    const newBalance = user.coin_balance - spinCost;
    await supabase.from('users').update({ coin_balance: newBalance }).eq('id', userId);

    await supabase.from('transactions').insert([
      {
        user_id: userId,
        amount: spinCost,
        type: 'spend',
        description: 'MAI Wheel spin',
      },
    ]);
  }

  return { spin: spinData, reward: randomReward };
};

export const getUserActiveRewards = async (userId: string) => {
  const { data, error } = await supabase
    .from('user_rewards_active')
    .select('*, reward:reward_id(*)')
    .eq('user_id', userId)
    .gt('expires_at', new Date().toISOString());

  if (error) throw error;
  return data || [];
};

export const createCreatorFam = async (
  creatorId: string,
  famData: {
    name: string;
    description?: string;
    coin_cost_monthly: number;
    max_members?: number;
    perks_included?: Record<string, unknown>;
  }
) => {
  const { data, error } = await supabase
    .from('creator_fams')
    .insert([{ creator_id: creatorId, ...famData }])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const getCreatorFams = async (creatorId: string) => {
  const { data, error } = await supabase
    .from('creator_fams')
    .select('*')
    .eq('creator_id', creatorId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const joinFam = async (userId: string, famId: string, coinCost: number) => {
  const user = await getUserById(userId);
  if (user.coin_balance < coinCost) {
    throw new Error('Insufficient coins');
  }

  const { data, error } = await supabase
    .from('fam_members')
    .insert([{ user_id: userId, fam_id: famId, expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() }])
    .select()
    .single();

  if (error) throw error;

  const newBalance = user.coin_balance - coinCost;
  await supabase.from('users').update({ coin_balance: newBalance }).eq('id', userId);

  await supabase.from('transactions').insert([
    {
      user_id: userId,
      amount: coinCost,
      type: 'spend',
      description: `Joined creator fam`,
    },
  ]);

  await supabase
    .from('creator_fams')
    .update({ current_members: (await supabase.from('fam_members').select('id').eq('fam_id', famId)).data?.length || 0 })
    .eq('id', famId);

  return data;
};

export const getUserFams = async (userId: string) => {
  const { data, error } = await supabase
    .from('fam_members')
    .select('*, fam:fam_id(*)')
    .eq('user_id', userId)
    .gt('expires_at', new Date().toISOString());

  if (error) throw error;
  return data || [];
};

export const getFamMembers = async (famId: string) => {
  const { data, error } = await supabase
    .from('fam_members')
    .select('*, user:user_id(id, username, display_name, avatar_url)')
    .eq('fam_id', famId)
    .gt('expires_at', new Date().toISOString());

  if (error) throw error;
  return data || [];
};

export const updateUserPassword = async (userId: string, passwordHash: string) => {
  const { data, error } = await supabase
    .from('users')
    .update({ password: passwordHash })
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updatePayPalSettings = async (
  userId: string,
  settings: {
    paypal_email?: string;
    payment_method: 'paypal' | 'stripe' | 'bank';
  }
) => {
  const { data, error } = await supabase
    .from('users')
    .update(settings)
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deleteAccount = async (userId: string) => {
  const { error } = await supabase
    .from('users')
    .delete()
    .eq('id', userId);

  if (error) throw error;
};
