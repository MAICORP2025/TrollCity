# MAI Studios - Complete Setup & Implementation Guide

## Project Overview

MAI Studios is a full-stack streaming platform with authentication, coin system, admin dashboard, and Base44-style UI components. The application is built with React + Vite (frontend) and Express (backend).

## What's Been Implemented

### ✅ Authentication System
- **Sign Up**: User registration with email, username, and password validation
- **Sign In**: Login functionality with session management
- **Log Out**: Secure logout with session clearing
- **Protected Routes**: Routes that require authentication to access
- **Profile Creation**: Required on first login - users complete profile with display name, bio, and favorite category

### ✅ User Coin System
- **Coin Balance Display**: Shows in navbar after login (clickable link to coin store)
- **Coin Store Page**: Purchase coins with different packages and bonus structures
- **Admin Grant Coins**: Admins can grant coins to any user from dashboard

### ✅ Admin Dashboard
- **User Management**: View all users with their details
- **Statistics**: Total users, total coin balance, average balance per user
- **Grant Coins**: Admin-only ability to grant coins to users
- **Access Control**: Only users with `role === 'admin'` can access

### ✅ Restored Base44 Features
- **Watch Shorts**: `/shorts` - Browse short-form content
- **Browse Movies**: `/movies` - Browse full-length content
- **Watch Individual Content**: `/watch/:id` - Play specific videos
- **Leaderboard**: `/leaderboard` - Top creators ranked by earnings
- **Coin Store**: `/coin-store` - Purchase MAI Coins
- **Neon Style Buttons**: All buttons styled with neon glow, rounded corners, gradient highlights
- **Cinematic Dark UI**: Gradient backgrounds, glass-morphism cards, smooth transitions

## Architecture

### Frontend Structure
```
client/
├── pages/
│   ├── Home.tsx              # Featured content + trending
│   ├── Shorts.tsx            # Short-form content
│   ├── Movies.tsx            # Full-length movies
│   ├── Watch.tsx             # Individual video player
│   ├── SignIn.tsx            # Login page
│   ├── SignUp.tsx            # Registration page
│   ├── CreateProfile.tsx      # Profile setup (first login)
│   ├── CoinStore.tsx         # Coin purchase page
│   ├── Leaderboard.tsx       # Top creators
│   ├── AdminDashboard.tsx    # Admin panel
│   └── ...
├── components/
│   ├── Layout.tsx            # Main layout with navbar/footer
│   ├── ProtectedRoute.tsx    # Route wrapper for auth
│   ├── Hero.tsx              # Hero banner
│   └── ui/                   # Radix UI components
├── hooks/
│   └── useAuth.ts            # Auth hook for components
├── lib/
│   ├── authContext.tsx       # Auth context provider
│   ├── supabaseClient.ts     # Database client
│   └── utils.ts              # Utility functions
└── App.tsx                   # Route definitions
```

### Backend Structure
```
server/
├── routes/
│   ├── auth.ts               # Authentication endpoints
│   └── demo.ts               # Example endpoint
└── index.ts                  # Express setup + route registration
```

### Shared Types
```
shared/
└── api.ts                    # TypeScript interfaces for API
```

## Database Schema (Current In-Memory)

The application currently uses an **in-memory database** for development. When you're ready to use a real database (Supabase, PostgreSQL, etc.), use this schema:

### Users Table
```sql
CREATE TABLE users (
  id VARCHAR(50) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,  -- hash in production
  display_name VARCHAR(255),
  avatar_url TEXT,
  bio TEXT,
  coin_balance INTEGER DEFAULT 0,
  profile_complete BOOLEAN DEFAULT false,
  role VARCHAR(20) DEFAULT 'user',  -- 'user', 'admin', 'creator'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Content Table
```sql
CREATE TABLE content (
  id VARCHAR(50) PRIMARY KEY,
  creator_id VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(20) NOT NULL,  -- 'short' or 'movie'
  thumbnail_url TEXT,
  video_url TEXT NOT NULL,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  featured BOOLEAN DEFAULT false,
  status VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'approved', 'rejected'
  is_unlockable BOOLEAN DEFAULT false,
  unlock_price INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (creator_id) REFERENCES users(id)
);
```

### Transactions Table
```sql
CREATE TABLE transactions (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL,
  amount INTEGER NOT NULL,
  type VARCHAR(20) NOT NULL,  -- 'purchase', 'grant', 'spend'
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

## API Endpoints

### Authentication Endpoints

#### POST `/api/auth/signup`
```json
{
  "email": "user@example.com",
  "username": "username",
  "password": "password123"
}
```

#### POST `/api/auth/login`
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

#### POST `/api/auth/logout`
No body required. Clears session.

#### GET `/api/auth/session`
Returns current user if authenticated.

#### POST `/api/auth/create-profile`
```json
{
  "display_name": "John Creator",
  "bio": "I create amazing content",
  "favorite_category": "shorts",
  "avatar_url": "https://..."
}
```

### Admin Endpoints

#### POST `/api/admin/grant-coins`
```json
{
  "user_id": "user_id_here",
  "amount": 1000
}
```

#### GET `/api/admin/stats`
Returns platform statistics (admin only).

## Testing the Application

### Quick Start
```bash
npm run dev
```

Opens app on `http://localhost:8080`

### Test Flow
1. **Sign Up**: Click "Sign In" → "Sign Up" → Fill form
2. **Complete Profile**: After signup, redirects to profile creation
3. **View Coins**: After login, coin balance appears in navbar
4. **Admin Dashboard**: Sign up, set role to 'admin', then access `/admin-dashboard`
5. **Browse Content**: Visit `/shorts`, `/movies`, `/watch/:id`
6. **Coin Store**: Click coin balance in navbar to purchase coins

### Test Credentials (for development)
Since the app uses in-memory storage, create your own during testing:
- Email: `test@example.com`
- Username: `testuser`
- Password: `test123`

## How to Connect to Supabase (or other database)

### Step 1: Get Supabase Credentials
1. Sign up at https://supabase.com
2. Create new project
3. Get your `Project URL` and `Anon Key`

### Step 2: Add Environment Variables
Create `.env.local` file:
```
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### Step 3: Create Database Tables
Run the SQL from the schema section above in Supabase SQL editor.

### Step 4: Update `client/lib/supabaseClient.ts`
Replace the mock client with:
```typescript
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
```

### Step 5: Update Auth Routes
Replace in-memory storage in `server/routes/auth.ts` with actual database calls using Supabase client.

## Environment Variables

### Development (`.env`)
```
VITE_PUBLIC_BUILDER_KEY=__BUILDER_PUBLIC_KEY__
PING_MESSAGE="ping pong"
```

### Optional (`.env.local` for Supabase)
```
VITE_SUPABASE_URL=your_url
VITE_SUPABASE_ANON_KEY=your_key
```

## Deployment

### Build for Production
```bash
npm run build
npm start
```

### Netlify Deployment
The project is configured for Netlify with automatic builds. Push to GitHub and connect to Netlify.

## Key Features Explained

### Authentication Flow
1. User signs up → Account created with `profile_complete = false`
2. Redirects to `/create-profile`
3. User completes profile → `profile_complete = true`
4. Redirected to home page
5. User logged in with coin balance visible

### Admin System
- Users have `role` field: 'user', 'admin', or 'creator'
- Admin dashboard only accessible if `user.role === 'admin'`
- Admins can grant coins to any user
- Admins see platform statistics

### Coin System
- Each user has `coin_balance` field
- Coin Store has predefined packages with bonuses
- Admins can grant coins directly
- Coin balance updates in real-time in navbar

## File Locations Reference

| Feature | File |
|---------|------|
| Auth Context | `client/lib/authContext.tsx` |
| Auth Hook | `client/hooks/useAuth.ts` |
| Protected Routes | `client/components/ProtectedRoute.tsx` |
| Auth Endpoints | `server/routes/auth.ts` |
| Server Setup | `server/index.ts` |
| API Types | `shared/api.ts` |
| Layout (Navbar) | `client/components/Layout.tsx` |

## Next Steps for Production

1. **Connect Real Database**: Follow "Connect to Supabase" section above
2. **Add Password Hashing**: Use bcrypt in auth endpoints
3. **Implement Payment Processing**: For coin purchases (Stripe, PayPal, etc.)
4. **Add Email Verification**: Send confirmation emails on signup
5. **Video Upload**: Implement video upload functionality
6. **Content Moderation**: Add tools for admins to moderate content
7. **Analytics**: Track views, likes, engagement metrics
8. **Notifications**: Real-time updates for interactions

## Support

For issues or questions, refer to:
- React Documentation: https://react.dev
- Vite Documentation: https://vitejs.dev
- Express Documentation: https://expressjs.com
- Supabase Documentation: https://supabase.com/docs
- Radix UI Documentation: https://www.radix-ui.com
