import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import { supabase } from "./supabaseClient";
import {
  handleSignup,
  handleLogin,
  handleLogout,
  handleGetSession,
  handleCreateProfile,
  handleGrantCoins,
  handleGetAdminStats,
  handleGetTransactions,
  handleGetUserTransactions,
  handleSetPayoutGoal,
  handleGetPayoutGoal,
  handleGetAllPayoutGoals,
  handleTogglePayoutGoal,
  handleDeletePayoutGoal,
  handleProcessPayouts,
  handleGetAllContent,
  handleDeleteContent,
  handleUpdateContentStatus,
  handleRestrictCreator,
  handleUnrestrictCreator,
  handleResetPassword,
  handleConfirmResetPassword,
  handleChangePassword,
  handleVerifyCardForReset,
  handleUpdatePayPalSettings,
  handleDeleteAccount,
} from "./routes/authSupabase";
import {
  handleCreatorApply,
  handleGetCreatorApplication,
  handleGetAllCreatorApplications,
  handleApproveCreatorApplication,
  handleDenyCreatorApplication,
  handleGetCreatorProfile,
  handleCreateCreatorPerk,
  handleGetCreatorPerks,
  handleUpdateCreatorPerk,
  handleDeleteCreatorPerk,
} from "./routes/creator";
import {
  handleGetConversations,
  handleGetMessages,
  handleSendMessage,
  handleStartConversation,
  handleDeleteConversation,
  handleGetMessagePricing,
  handleSetMessagePricing,
  handlePayForMessage,
  handleCheckMessagePayment,
  handleGetDailyMessageCount,
} from "./routes/messaging";
import {
  handleGetCreatorFams,
  handleCreateCreatorFam,
  handleUpdateCreatorFam,
  handleDeleteCreatorFam,
  handleJoinFam,
  handleLeaveFam,
  handleGetFamMembers,
  handleGetUserFams,
} from "./routes/fams";
import { handleUploadVideo } from "./routes/upload";
import { handleCreateSeries, handleListSeries } from "./routes/series";
import { getStoredEmails } from "./emailService";

export function createServer() {
  const app = express();

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, path.join(process.cwd(), "uploads", "id_verification"));
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
    },
  });

  const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const allowedMimes = ["image/jpeg", "image/png", "image/gif", "application/pdf"];
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error("Invalid file type"));
      }
    },
  });

  // Video upload storage
  const videoStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = file.fieldname === 'video_file' ? 'videos' : 'thumbnails';
      cb(null, path.join(process.cwd(), "uploads", dir));
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
    },
  });

  const videoUpload = multer({
    storage: videoStorage,
    limits: {
      fileSize: 500 * 1024 * 1024, // 500MB for videos
    },
    fileFilter: (req, file, cb) => {
      if (file.fieldname === 'video_file') {
        const allowedVideoMimes = ["video/mp4", "video/webm", "video/ogg", "video/avi", "video/mov"];
        if (allowedVideoMimes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error("Invalid video file type"));
        }
      } else if (file.fieldname === 'thumbnail_file') {
        const allowedImageMimes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
        if (allowedImageMimes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error("Invalid thumbnail file type"));
        }
      } else {
        cb(new Error("Unexpected field"));
      }
    },
  });

  // Middleware
  app.use(cors({ credentials: true }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Serve uploaded files
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
  
  app.use((req, res, next) => {
    const cookieString = req.headers.cookie || '';
    const cookies: Record<string, string> = {};
    cookieString.split(';').forEach((cookie) => {
      const [name, value] = cookie.split('=').map((s) => s.trim());
      if (name && value) {
        cookies[name] = decodeURIComponent(value);
      }
    });
    req.cookies = cookies;
    next();
  });

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });


  app.get("/api/dev/emails", (_req, res) => {
    const emails = getStoredEmails();
    res.json({
      count: emails.length,
      emails: emails,
      note: "This endpoint is for development only. Shows all password reset emails sent.",
    });
  });

  app.post("/api/dev/reset-account", async (req, res) => {
    const { email, newPassword } = req.body || {};
    
    if (!email || !newPassword) {
      return res.json({
        success: false,
        message: 'Email and new password are required',
        received: { email, newPassword },
      });
    }

    try {
      const hashedPassword = await import('bcrypt').then(m => m.default).then(b => b.hash(newPassword, 10));
      const { data, error } = await supabase
        .from('users')
        .update({ password_hash: hashedPassword })
        .eq('email', email)
        .select();

      if (error) {
        console.error('Error:', error);
        return res.json({
          success: false,
          message: `Database error: ${error.message}`,
        });
      }

      if (data && data.length > 0) {
        console.log(`✓ Account reset for ${email}`);
        return res.json({
          success: true,
          message: `Account for ${email} has been reset`,
          userId: data[0].id,
        });
      } else {
        return res.json({
          success: false,
          message: 'Account not found',
        });
      }
    } catch (err) {
      console.error('Error:', err);
      return res.json({
        success: false,
        message: 'Failed to reset account',
      });
    }
  });

  // Auth routes
  app.post("/api/auth/signup", handleSignup);
  app.post("/api/auth/login", handleLogin);
  app.post("/api/auth/logout", handleLogout);
  app.get("/api/auth/session", handleGetSession);
  app.post("/api/auth/create-profile", handleCreateProfile);
  app.post("/api/auth/change-password", handleChangePassword);
  app.post("/api/auth/reset-password", handleResetPassword);
  app.post("/api/auth/verify-card-reset", handleVerifyCardForReset);
  app.post("/api/auth/confirm-reset-password", handleConfirmResetPassword);
  app.post("/api/auth/paypal-settings", handleUpdatePayPalSettings);
  app.delete("/api/auth/delete-account", handleDeleteAccount);
  
  // Admin routes
  app.post("/api/admin/grant-coins", handleGrantCoins);
  app.get("/api/admin/stats", handleGetAdminStats);
  app.get("/api/admin/transactions", handleGetTransactions);
  app.get("/api/admin/transactions/:user_id", handleGetUserTransactions);
  
  // Payout routes
  app.post("/api/admin/payouts/set-goal", handleSetPayoutGoal);
  app.get("/api/admin/payouts/goal/:user_id", handleGetPayoutGoal);
  app.get("/api/admin/payouts/goals", handleGetAllPayoutGoals);
  app.post("/api/admin/payouts/toggle", handleTogglePayoutGoal);
  app.delete("/api/admin/payouts/:user_id", handleDeletePayoutGoal);
  app.post("/api/admin/payouts/process", handleProcessPayouts);

  // Content management routes
  app.get("/api/admin/content", handleGetAllContent);
  app.delete("/api/admin/content", handleDeleteContent);
  app.post("/api/admin/content/status", handleUpdateContentStatus);
  app.post("/api/admin/creators/restrict", handleRestrictCreator);
  app.post("/api/admin/creators/unrestrict", handleUnrestrictCreator);

  // Creator program routes
  app.post("/api/creator/apply", upload.fields([{ name: "id_file_front", maxCount: 1 }, { name: "id_file_back", maxCount: 1 }]), handleCreatorApply);
  app.get("/api/creator/application", handleGetCreatorApplication);
  app.get("/api/admin/creator/applications", handleGetAllCreatorApplications);
  app.post("/api/admin/creator/approve", handleApproveCreatorApplication);
  app.post("/api/admin/creator/deny", handleDenyCreatorApplication);
  app.get("/api/creator/:creatorId", handleGetCreatorProfile);
  app.post("/api/creator/perks", handleCreateCreatorPerk);
  app.get("/api/creator/:creatorId/perks", handleGetCreatorPerks);
  app.put("/api/creator/perks/:perkId", handleUpdateCreatorPerk);
  app.delete("/api/creator/perks/:perkId", handleDeleteCreatorPerk);

  // Messaging routes
  app.get("/api/messages/conversations", handleGetConversations);
  app.get("/api/messages/:conversationId", handleGetMessages);
  app.post("/api/messages", handleSendMessage);
  app.post("/api/messages/start-conversation", handleStartConversation);
  app.delete("/api/messages/:conversationId", handleDeleteConversation);
  app.get("/api/messages/pricing/:creatorId", handleGetMessagePricing);
  app.post("/api/messages/pricing/set", handleSetMessagePricing);
  app.post("/api/messages/pay", handlePayForMessage);
  app.get("/api/messages/check-payment/:creatorId", handleCheckMessagePayment);
  app.get("/api/messages/daily-count/:creatorId", handleGetDailyMessageCount);

  // Fams (Fan Clubs) routes
  app.get("/api/creator/:creatorId/fams", handleGetCreatorFams);
  app.post("/api/fams", handleCreateCreatorFam);
  app.put("/api/fams/:famId", handleUpdateCreatorFam);
  app.delete("/api/fams/:famId", handleDeleteCreatorFam);
  app.post("/api/fams/join", handleJoinFam);
  app.post("/api/fams/leave", handleLeaveFam);
  app.get("/api/fams/:famId/members", handleGetFamMembers);
  app.get("/api/user/fams", handleGetUserFams);

  // Series routes
  app.post("/api/series", handleCreateSeries);
  app.get("/api/series", handleListSeries);

  // Video upload routes
  app.post("/api/upload/video", videoUpload.fields([
    { name: "video_file", maxCount: 1 },
    { name: "thumbnail_file", maxCount: 1 }
  ]), handleUploadVideo);

  return app;
}
