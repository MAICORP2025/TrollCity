import { RequestHandler } from 'express';
import {
  SignUpRequest,
  SignUpResponse,
  LoginRequest,
  LoginResponse,
  CreateProfileRequest,
  CreateProfileResponse,
  SessionResponse,
  User,
  Transaction,
  TransactionListResponse,
} from '@shared/api';

interface StoredUser {
  id: string;
  email: string;
  username: string;
  password: string;
  display_name: string;
  avatar_url?: string;
  bio?: string;
  coin_balance: number;
  profile_complete: boolean;
  role: 'user' | 'admin' | 'creator';
  paypal_email?: string;
  payment_method: 'paypal' | 'stripe' | 'bank';
  created_at: string;
  updated_at: string;
}

const users: Map<string, StoredUser> = new Map();
const sessions: Map<string, string> = new Map();
const transactions: Map<string, Transaction> = new Map();

const generateId = () => Math.random().toString(36).substring(2) + Date.now().toString(36);

const createTransaction = (userId: string, amount: number, type: 'purchase' | 'grant' | 'spend', description?: string) => {
  const transactionId = generateId();
  const transaction: Transaction = {
    id: transactionId,
    user_id: userId,
    amount,
    type,
    description,
    created_at: new Date().toISOString(),
  };
  transactions.set(transactionId, transaction);
  return transaction;
};

const validateEmail = (email: string) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

const validateUsername = (username: string) => {
  return username.length >= 3 && username.length <= 20 && /^[a-zA-Z0-9_-]+$/.test(username);
};

const findUserByEmail = (email: string) => {
  return Array.from(users.values()).find((u) => u.email === email);
};

const findUserByUsername = (username: string) => {
  return Array.from(users.values()).find((u) => u.username === username);
};

const getUserFromRequest = (req: any): StoredUser | null => {
  const sessionId = req.cookies.sessionId;
  if (!sessionId) return null;
  const userId = sessions.get(sessionId);
  if (!userId) return null;
  return users.get(userId) || null;
};

const userToResponse = (user: StoredUser): User => ({
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
  payment_method: user.payment_method,
  created_at: user.created_at,
  updated_at: user.updated_at,
});

export const handleSignup: RequestHandler = (req, res) => {
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

  if (findUserByEmail(email)) {
    return res.json({
      success: false,
      error: 'Email already registered',
    } as SignUpResponse);
  }

  if (findUserByUsername(username)) {
    return res.json({
      success: false,
      error: 'Username already taken',
    } as SignUpResponse);
  }

  const userId = generateId();
  const now = new Date().toISOString();
  const isAdminEmail = email.toLowerCase() === 'trollcity2025@gmail.com';

  const newUser: StoredUser = {
    id: userId,
    email,
    username,
    password,
    display_name: username,
    coin_balance: 0,
    profile_complete: false,
    role: isAdminEmail ? 'admin' : 'user',
    payment_method: 'paypal',
    created_at: now,
    updated_at: now,
  };

  users.set(userId, newUser);

  const sessionId = generateId();
  sessions.set(sessionId, userId);
  res.cookie('sessionId', sessionId, {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({
    success: true,
    user: userToResponse(newUser),
  } as SignUpResponse);
};

export const handleLogin: RequestHandler = (req, res) => {
  const { email, password } = req.body as LoginRequest;

  if (!email || !password) {
    return res.json({
      success: false,
      error: 'Missing required fields',
    } as LoginResponse);
  }

  const user = findUserByEmail(email);
  if (!user || user.password !== password) {
    return res.json({
      success: false,
      error: 'Invalid email or password',
    } as LoginResponse);
  }

  const sessionId = generateId();
  sessions.set(sessionId, user.id);
  res.cookie('sessionId', sessionId, {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({
    success: true,
    user: userToResponse(user),
  } as LoginResponse);
};

export const handleLogout: RequestHandler = (req, res) => {
  const sessionId = req.cookies.sessionId;
  if (sessionId) {
    sessions.delete(sessionId);
  }
  res.clearCookie('sessionId');
  res.json({ success: true });
};

export const handleGetSession: RequestHandler = (req, res) => {
  const user = getUserFromRequest(req);
  res.json({
    authenticated: !!user,
    user: user ? userToResponse(user) : null,
  } as SessionResponse);
};

export const handleCreateProfile: RequestHandler = (req, res) => {
  const user = getUserFromRequest(req);
  if (!user) {
    return res.json({
      success: false,
      error: 'Not authenticated',
    } as CreateProfileResponse);
  }

  const { display_name, bio, favorite_category: _favorite_category, avatar_url } = req.body as CreateProfileRequest;

  if (!display_name || !bio) {
    return res.json({
      success: false,
      error: 'Missing required fields',
    } as CreateProfileResponse);
  }

  user.display_name = display_name;
  user.bio = bio;
  user.avatar_url = avatar_url;
  user.profile_complete = true;
  user.updated_at = new Date().toISOString();

  users.set(user.id, user);

  res.json({
    success: true,
    user: userToResponse(user),
  } as CreateProfileResponse);
};

export const handleGrantCoins: RequestHandler = (req, res) => {
  const admin = getUserFromRequest(req);
  if (!admin || admin.role !== 'admin') {
    return res.json({
      success: false,
      error: 'Admin access required',
    });
  }

  const { user_id, amount } = req.body;
  const targetUser = users.get(user_id);

  if (!targetUser) {
    return res.json({
      success: false,
      error: 'User not found',
    });
  }

  targetUser.coin_balance += amount;
  targetUser.updated_at = new Date().toISOString();
  users.set(user_id, targetUser);

  createTransaction(user_id, amount, 'grant', `Granted by admin ${admin.username}`);

  res.json({
    success: true,
    new_balance: targetUser.coin_balance,
  });
};

export const handleGetAdminStats: RequestHandler = (req, res) => {
  const admin = getUserFromRequest(req);
  if (!admin || admin.role !== 'admin') {
    return res.json({
      success: false,
      error: 'Admin access required',
    });
  }

  const allUsers = Array.from(users.values());
  const totalCoinBalance = allUsers.reduce((sum, u) => sum + u.coin_balance, 0);

  res.json({
    success: true,
    stats: {
      total_users: allUsers.length,
      total_coin_balance: totalCoinBalance,
      users: allUsers.map(userToResponse),
    },
  });
};

export const handleGetTransactions: RequestHandler = (req, res) => {
  const admin = getUserFromRequest(req);
  if (!admin || admin.role !== 'admin') {
    return res.json({
      success: false,
      error: 'Admin access required',
    } as TransactionListResponse);
  }

  const allTransactions = Array.from(transactions.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  res.json({
    success: true,
    transactions: allTransactions,
  } as TransactionListResponse);
};

export const handleGetUserTransactions: RequestHandler = (req, res) => {
  const admin = getUserFromRequest(req);
  if (!admin || admin.role !== 'admin') {
    return res.json({
      success: false,
      error: 'Admin access required',
    } as TransactionListResponse);
  }

  const { user_id } = req.params;
  const userTransactions = Array.from(transactions.values())
    .filter((t) => t.user_id === user_id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  res.json({
    success: true,
    transactions: userTransactions,
  } as TransactionListResponse);
};
