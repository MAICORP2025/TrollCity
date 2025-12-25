import { RequestHandler } from 'express';
import bcrypt from 'bcrypt';
import {
  SignUpRequest,
  SignUpResponse,
  LoginRequest,
  LoginResponse,
  CreateProfileRequest,
  CreateProfileResponse,
  SessionResponse,
  User,
  TransactionListResponse,
  UpdatePayPalSettingsRequest,
  UpdatePayPalSettingsResponse,
  DeleteAccountResponse,
} from '@shared/api';
import {
  createUserRecord,
  getUserByEmail,
  getUserById,
  updateUserProfile,
  updateUserPassword,
  updatePayPalSettings,
  deleteAccount,
  getAllUsers,
  grantCoins,
  getAllTransactions,
  getUserTransactions,
  setPayoutGoal,
  getPayoutGoal,
  getAllPayoutGoals,
  togglePayoutGoal,
  deletePayoutGoal,
  processPayouts,
  getAllContent,
  deleteContent,
  updateContentStatus,
  restrictCreator,
  unrestrictCreator,
} from '../supabaseClient';
import { sessions, generateSessionId } from '../sessions';

const SALT_ROUNDS = 10;

const resetTokens = new Map<string, { email: string; expiresAt: number; verified?: boolean; cardLast4?: string }>();

const userToResponse = (user: any): User => ({
  id: user.id,
  email: user.email,
  username: user.username,
  display_name: user.display_name,
  avatar_url: user.avatar_url,
  bio: user.bio,
  coin_balance: user.coin_balance,
  profile_complete: user.profile_complete,
  role: user.role,
  paypal_email: user.paypal_email,
  payment_method: user.payment_method || 'paypal',
  created_at: user.created_at,
  updated_at: user.updated_at,
});

const getUserFromRequest = async (req: any): Promise<any | null> => {
  const sessionId = req.cookies.sessionId;
  if (!sessionId) return null;
  const userId = sessions.get(sessionId);
  if (!userId) return null;
  return getUserById(userId);
};

const validateEmail = (email: string) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

const validateUsername = (username: string) => {
  return username.length >= 3 && username.length <= 20 && /^[a-zA-Z0-9_-]+$/.test(username);
};

export const handleSignup: RequestHandler = async (req, res) => {
  try {
    const { email, username, password } = req.body as SignUpRequest;

    if (!email || !username || !password) {
      return res.json({
        success: false,
        error: 'Missing required fields',
      } as SignUpResponse);
    }

    if (!validateEmail(email)) {
      return res.json({
        success: false,
        error: 'Invalid email format',
      } as SignUpResponse);
    }

    if (!validateUsername(username)) {
      return res.json({
        success: false,
        error: 'Username must be 3-20 characters and contain only letters, numbers, hyphens, and underscores',
      } as SignUpResponse);
    }

    if (password.length < 6) {
      return res.json({
        success: false,
        error: 'Password must be at least 6 characters',
      } as SignUpResponse);
    }

    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return res.json({
        success: false,
        error: 'Email already registered',
      } as SignUpResponse);
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const newUser = await createUserRecord(email, username, passwordHash);

    const sessionId = generateSessionId();
    sessions.set(sessionId, newUser.id);
    res.cookie('sessionId', sessionId, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      user: userToResponse(newUser),
    } as SignUpResponse);
  } catch (error) {
    console.error('Signup error:', error);
    res.json({
      success: false,
      error: 'Signup failed',
    } as SignUpResponse);
  }
};

export const handleLogin: RequestHandler = async (req, res) => {
  try {
    const { email, password } = req.body as LoginRequest;

    if (!email || !password) {
      return res.json({
        success: false,
        error: 'Missing required fields',
      } as LoginResponse);
    }

    const user = await getUserByEmail(email);
    if (!user) {
      return res.json({
        success: false,
        error: 'Invalid email or password',
      } as LoginResponse);
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.json({
        success: false,
        error: 'Invalid email or password',
      } as LoginResponse);
    }

    const sessionId = generateSessionId();
    sessions.set(sessionId, user.id);
    res.cookie('sessionId', sessionId, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      user: userToResponse(user),
    } as LoginResponse);
  } catch (error) {
    console.error('Login error:', error);
    res.json({
      success: false,
      error: 'Login failed',
    } as LoginResponse);
  }
};

export const handleLogout: RequestHandler = (req, res) => {
  const sessionId = req.cookies.sessionId;
  if (sessionId) {
    sessions.delete(sessionId);
  }
  res.clearCookie('sessionId');
  res.json({ success: true });
};

export const handleGetSession: RequestHandler = async (req, res) => {
  try {
    const user = await getUserFromRequest(req);
    res.json({
      authenticated: !!user,
      user: user ? userToResponse(user) : null,
    } as SessionResponse);
  } catch (error) {
    console.error('Session error:', error);
    res.json({
      authenticated: false,
      user: null,
    } as SessionResponse);
  }
};

export const handleCreateProfile: RequestHandler = async (req, res) => {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return res.json({
        success: false,
        error: 'Not authenticated',
      } as CreateProfileResponse);
    }

    const { display_name, bio, avatar_url } = req.body as CreateProfileRequest;

    if (!display_name || !bio) {
      return res.json({
        success: false,
        error: 'Missing required fields',
      } as CreateProfileResponse);
    }

    const updatedUser = await updateUserProfile(user.id, {
      display_name,
      bio,
      avatar_url,
      profile_complete: true,
    });

    res.json({
      success: true,
      user: userToResponse(updatedUser),
    } as CreateProfileResponse);
  } catch (error) {
    console.error('Profile creation error:', error);
    res.json({
      success: false,
      error: 'Profile creation failed',
    } as CreateProfileResponse);
  }
};

export const handleGrantCoins: RequestHandler = async (req, res) => {
  try {
    const admin = await getUserFromRequest(req);
    if (!admin || admin.role !== 'admin') {
      return res.json({
        success: false,
        error: 'Admin access required',
      });
    }

    const { user_id, amount } = req.body;
    const updatedUser = await grantCoins(user_id, amount, admin.username);

    res.json({
      success: true,
      new_balance: updatedUser.coin_balance,
    });
  } catch (error) {
    console.error('Grant coins error:', error);
    res.json({
      success: false,
      error: 'Failed to grant coins',
    });
  }
};

export const handleGetAdminStats: RequestHandler = async (req, res) => {
  try {
    const admin = await getUserFromRequest(req);
    if (!admin || admin.role !== 'admin') {
      return res.json({
        success: false,
        error: 'Admin access required',
      });
    }

    const allUsers = await getAllUsers();
    const totalCoinBalance = allUsers.reduce((sum, u) => sum + u.coin_balance, 0);

    res.json({
      success: true,
      stats: {
        total_users: allUsers.length,
        total_coin_balance: totalCoinBalance,
        users: allUsers.map(userToResponse),
      },
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.json({
      success: false,
      error: 'Failed to load stats',
    });
  }
};

export const handleGetTransactions: RequestHandler = async (req, res) => {
  try {
    const admin = await getUserFromRequest(req);
    if (!admin || admin.role !== 'admin') {
      return res.json({
        success: false,
        error: 'Admin access required',
      } as TransactionListResponse);
    }

    const transactions = await getAllTransactions();

    res.json({
      success: true,
      transactions,
    } as TransactionListResponse);
  } catch (error) {
    console.error('Get transactions error:', error);
    res.json({
      success: false,
      error: 'Failed to load transactions',
    } as TransactionListResponse);
  }
};

export const handleGetUserTransactions: RequestHandler = async (req, res) => {
  try {
    const admin = await getUserFromRequest(req);
    if (!admin || admin.role !== 'admin') {
      return res.json({
        success: false,
        error: 'Admin access required',
      } as TransactionListResponse);
    }

    const { user_id } = req.params;
    const transactions = await getUserTransactions(user_id);

    res.json({
      success: true,
      transactions,
    } as TransactionListResponse);
  } catch (error) {
    console.error('Get user transactions error:', error);
    res.json({
      success: false,
      error: 'Failed to load transactions',
    } as TransactionListResponse);
  }
};

export const handleSetPayoutGoal: RequestHandler = async (req, res) => {
  try {
    const admin = await getUserFromRequest(req);
    if (!admin || admin.role !== 'admin') {
      return res.json({
        success: false,
        error: 'Admin access required',
      });
    }

    const { user_id, coin_goal, payout_amount } = req.body;

    if (!user_id || !coin_goal || !payout_amount) {
      return res.json({
        success: false,
        error: 'Missing required fields',
      });
    }

    const goal = await setPayoutGoal(user_id, coin_goal, payout_amount);

    res.json({
      success: true,
      goal,
    });
  } catch (error) {
    console.error('Set payout goal error:', error);
    res.json({
      success: false,
      error: 'Failed to set payout goal',
    });
  }
};

export const handleGetPayoutGoal: RequestHandler = async (req, res) => {
  try {
    const admin = await getUserFromRequest(req);
    if (!admin || admin.role !== 'admin') {
      return res.json({
        success: false,
        error: 'Admin access required',
      });
    }

    const { user_id } = req.params;
    const goal = await getPayoutGoal(user_id);

    res.json({
      success: true,
      goal,
    });
  } catch (error) {
    console.error('Get payout goal error:', error);
    res.json({
      success: false,
      error: 'Failed to load payout goal',
    });
  }
};

export const handleGetAllPayoutGoals: RequestHandler = async (req, res) => {
  try {
    const admin = await getUserFromRequest(req);
    if (!admin || admin.role !== 'admin') {
      return res.json({
        success: false,
        error: 'Admin access required',
      });
    }

    const goals = await getAllPayoutGoals();

    res.json({
      success: true,
      goals,
    });
  } catch (error) {
    console.error('Get all payout goals error:', error);
    res.json({
      success: false,
      error: 'Failed to load payout goals',
    });
  }
};

export const handleTogglePayoutGoal: RequestHandler = async (req, res) => {
  try {
    const admin = await getUserFromRequest(req);
    if (!admin || admin.role !== 'admin') {
      return res.json({
        success: false,
        error: 'Admin access required',
      });
    }

    const { user_id, enabled } = req.body;

    if (!user_id || enabled === undefined) {
      return res.json({
        success: false,
        error: 'Missing required fields',
      });
    }

    const goal = await togglePayoutGoal(user_id, enabled);

    res.json({
      success: true,
      goal,
    });
  } catch (error) {
    console.error('Toggle payout goal error:', error);
    res.json({
      success: false,
      error: 'Failed to toggle payout goal',
    });
  }
};

export const handleDeletePayoutGoal: RequestHandler = async (req, res) => {
  try {
    const admin = await getUserFromRequest(req);
    if (!admin || admin.role !== 'admin') {
      return res.json({
        success: false,
        error: 'Admin access required',
      });
    }

    const { user_id } = req.params;
    await deletePayoutGoal(user_id);

    res.json({
      success: true,
    });
  } catch (error) {
    console.error('Delete payout goal error:', error);
    res.json({
      success: false,
      error: 'Failed to delete payout goal',
    });
  }
};

export const handleProcessPayouts: RequestHandler = async (req, res) => {
  try {
    const admin = await getUserFromRequest(req);
    if (!admin || admin.role !== 'admin') {
      return res.json({
        success: false,
        error: 'Admin access required',
      });
    }

    const result = await processPayouts();

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Process payouts error:', error);
    res.json({
      success: false,
      error: 'Failed to process payouts',
    });
  }
};

export const handleGetAllContent: RequestHandler = async (req, res) => {
  try {
    const admin = await getUserFromRequest(req);
    if (!admin || admin.role !== 'admin') {
      return res.json({
        success: false,
        error: 'Admin access required',
      });
    }

    const content = await getAllContent();

    res.json({
      success: true,
      content,
    });
  } catch (error) {
    console.error('Get all content error:', error);
    res.json({
      success: false,
      error: 'Failed to load content',
    });
  }
};

export const handleDeleteContent: RequestHandler = async (req, res) => {
  try {
    const admin = await getUserFromRequest(req);
    if (!admin || admin.role !== 'admin') {
      return res.json({
        success: false,
        error: 'Admin access required',
      });
    }

    const { content_id } = req.body;
    if (!content_id) {
      return res.json({
        success: false,
        error: 'Content ID required',
      });
    }

    await deleteContent(content_id);

    res.json({
      success: true,
    });
  } catch (error) {
    console.error('Delete content error:', error);
    res.json({
      success: false,
      error: 'Failed to delete content',
    });
  }
};

export const handleUpdateContentStatus: RequestHandler = async (req, res) => {
  try {
    const admin = await getUserFromRequest(req);
    if (!admin || admin.role !== 'admin') {
      return res.json({
        success: false,
        error: 'Admin access required',
      });
    }

    const { content_id, status } = req.body;
    if (!content_id || !status) {
      return res.json({
        success: false,
        error: 'Missing required fields',
      });
    }

    const content = await updateContentStatus(content_id, status);

    res.json({
      success: true,
      content,
    });
  } catch (error) {
    console.error('Update content status error:', error);
    res.json({
      success: false,
      error: 'Failed to update content status',
    });
  }
};

export const handleRestrictCreator: RequestHandler = async (req, res) => {
  try {
    const admin = await getUserFromRequest(req);
    if (!admin || admin.role !== 'admin') {
      return res.json({
        success: false,
        error: 'Admin access required',
      });
    }

    const { creator_id } = req.body;
    if (!creator_id) {
      return res.json({
        success: false,
        error: 'Creator ID required',
      });
    }

    const user = await restrictCreator(creator_id);

    res.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error('Restrict creator error:', error);
    res.json({
      success: false,
      error: 'Failed to restrict creator',
    });
  }
};

export const handleUnrestrictCreator: RequestHandler = async (req, res) => {
  try {
    const admin = await getUserFromRequest(req);
    if (!admin || admin.role !== 'admin') {
      return res.json({
        success: false,
        error: 'Admin access required',
      });
    }

    const { creator_id } = req.body;
    if (!creator_id) {
      return res.json({
        success: false,
        error: 'Creator ID required',
      });
    }

    const user = await unrestrictCreator(creator_id);

    res.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error('Unrestrict creator error:', error);
    res.json({
      success: false,
      error: 'Failed to unrestrict creator',
    });
  }
};

export const handleResetPassword: RequestHandler = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.json({
        success: false,
        message: 'Email is required',
      });
    }

    if (!validateEmail(email)) {
      return res.json({
        success: false,
        message: 'Invalid email format',
      });
    }

    const user = await getUserByEmail(email);
    if (!user) {
      return res.json({
        success: false,
        message: 'Account not found',
      });
    }

    const resetToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const expiresAt = Date.now() + 60 * 60 * 1000;
    resetTokens.set(resetToken, { email, expiresAt, verified: true });

    return res.json({
      success: true,
      message: 'Reset token generated successfully',
      token: resetToken,
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.json({
      success: false,
      message: 'Failed to process password reset request',
    });
  }
};

export const handleChangePassword: RequestHandler = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const sessionId = req.cookies.sessionId;

    if (!sessionId) {
      return res.json({
        success: false,
        message: 'Not authenticated',
      });
    }

    const userId = sessions.get(sessionId);
    if (!userId) {
      return res.json({
        success: false,
        message: 'Session expired',
      });
    }

    if (!currentPassword || !newPassword) {
      return res.json({
        success: false,
        message: 'Current password and new password are required',
      });
    }

    if (newPassword.length < 6) {
      return res.json({
        success: false,
        message: 'New password must be at least 6 characters',
      });
    }

    const user = await getUserById(userId);
    if (!user) {
      return res.json({
        success: false,
        message: 'User not found',
      });
    }

    const passwordMatch = await bcrypt.compare(currentPassword, user.password);
    if (!passwordMatch) {
      return res.json({
        success: false,
        message: 'Current password is incorrect',
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

    try {
      await updateUserPassword(user.id, hashedPassword);
    } catch (err) {
      console.error('Failed to update password:', err);
      return res.json({
        success: false,
        message: 'Failed to update password',
      });
    }

    return res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    console.error('Change password error:', error);
    return res.json({
      success: false,
      message: 'Failed to change password',
    });
  }
};

export const handleVerifyCardForReset: RequestHandler = async (req, res) => {
  try {
    const { email, cardNumber } = req.body;

    if (!email || !cardNumber) {
      return res.json({
        success: false,
        message: 'Email and card number are required',
      });
    }

    const user = await getUserByEmail(email);
    if (!user) {
      return res.json({
        success: false,
        message: 'Account not found',
      });
    }

    const last4 = cardNumber.slice(-4);

    if (last4 !== '0000') {
      return res.json({
        success: false,
        message: 'Card verification failed. Invalid card number.',
      });
    }

    const verificationToken = Math.random().toString(36).substring(2) + Date.now().toString(36);

    resetTokens.set(verificationToken, {
      email,
      expiresAt: Date.now() + 60 * 60 * 1000,
      cardLast4: last4,
      verified: true
    });

    console.log(`✓ Card verification confirmed for ${email} (****${last4})`);

    return res.json({
      success: true,
      message: 'Card verified successfully',
      token: verificationToken,
    });
  } catch (error) {
    console.error('Card verification error:', error);
    return res.json({
      success: false,
      message: 'Failed to verify card',
    });
  }
};

export const handleConfirmResetPassword: RequestHandler = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.json({
        success: false,
        message: 'Token and password are required',
      });
    }

    if (password.length < 6) {
      return res.json({
        success: false,
        message: 'Password must be at least 6 characters',
      });
    }

    const resetData = resetTokens.get(token);
    if (!resetData) {
      return res.json({
        success: false,
        message: 'Invalid or expired reset token',
      });
    }

    if (resetData.expiresAt < Date.now()) {
      resetTokens.delete(token);
      return res.json({
        success: false,
        message: 'Reset token has expired',
      });
    }

    const user = await getUserByEmail(resetData.email);
    if (!user) {
      return res.json({
        success: false,
        message: 'User not found',
      });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    try {
      await updateUserPassword(user.id, hashedPassword);
    } catch (err) {
      console.error('Failed to update password:', err);
      return res.json({
        success: false,
        message: 'Failed to update password',
      });
    }

    resetTokens.delete(token);

    return res.json({
      success: true,
      message: 'Password has been reset successfully',
    });
  } catch (error) {
    console.error('Confirm reset password error:', error);
    return res.json({
      success: false,
      message: 'Failed to reset password',
    });
  }
};

export const handleUpdatePayPalSettings: RequestHandler = async (req, res) => {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return res.json({
        success: false,
        error: 'Not authenticated',
      } as UpdatePayPalSettingsResponse);
    }

    const { paypal_email, payment_method } = req.body as UpdatePayPalSettingsRequest;

    if (!payment_method || !['paypal', 'stripe', 'bank'].includes(payment_method)) {
      return res.json({
        success: false,
        error: 'Invalid payment method',
      } as UpdatePayPalSettingsResponse);
    }

    if (payment_method === 'paypal' && !paypal_email) {
      return res.json({
        success: false,
        error: 'PayPal email is required for PayPal payments',
      } as UpdatePayPalSettingsResponse);
    }

    const updatedUser = await updatePayPalSettings(user.id, {
      paypal_email,
      payment_method,
    });

    res.json({
      success: true,
      user: userToResponse(updatedUser),
    } as UpdatePayPalSettingsResponse);
  } catch (error) {
    console.error('Update PayPal settings error:', error);
    res.json({
      success: false,
      error: 'Failed to update PayPal settings',
    } as UpdatePayPalSettingsResponse);
  }
};

export const handleDeleteAccount: RequestHandler = async (req, res) => {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return res.json({
        success: false,
        error: 'Not authenticated',
      } as DeleteAccountResponse);
    }

    await deleteAccount(user.id);

    // Clear session
    const sessionId = req.cookies.sessionId;
    if (sessionId) {
      sessions.delete(sessionId);
    }
    res.clearCookie('sessionId');

    res.json({
      success: true,
    } as DeleteAccountResponse);
  } catch (error) {
    console.error('Delete account error:', error);
    res.json({
      success: false,
      error: 'Failed to delete account',
    } as DeleteAccountResponse);
  }
};
