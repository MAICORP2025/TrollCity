import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/lib/authContext";

// Pages
import Home from "./pages/Home";
import Shorts from "./pages/Shorts";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import Placeholder from "./pages/Placeholder";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import ResetPassword from "./pages/ResetPassword";
import ResetPasswordConfirm from "./pages/ResetPasswordConfirm";
import CreateProfile from "./pages/CreateProfile";
import Movies from "./pages/Movies";
import Watch from "./pages/Watch";
import CoinStore from "./pages/CoinStore";
import Leaderboard from "./pages/Leaderboard";
import AdminDashboard from "./pages/AdminDashboard";
import CreatorApply from "./pages/CreatorApply";
import CreatorTools from "./pages/CreatorTools";
import CreatorEarnings from "./pages/CreatorEarnings";
import CreatorPerks from "./pages/CreatorPerks";
import Messages from "./pages/Messages";
import CreatorMessagePricing from "./pages/CreatorMessagePricing";
import MAIWheel from "./pages/MAIWheel";
import CreatorFams from "./pages/CreatorFams";
import FamShop from "./pages/FamShop";
import Upload from "./pages/Upload";
import SeriesManagement from "./pages/SeriesManagement";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Main Pages */}
            <Route path="/" element={<Home />} />
            <Route path="/shorts" element={<Shorts />} />
            <Route path="/settings" element={<Settings />} />

            {/* Auth Routes */}
            <Route path="/signin" element={<SignIn />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/reset-password-confirm" element={<ResetPasswordConfirm />} />
            <Route path="/create-profile" element={<CreateProfile />} />
            <Route path="/creator-apply" element={<CreatorApply />} />
            <Route path="/creator-tools" element={<CreatorTools />} />
            <Route path="/creator-earnings" element={<CreatorEarnings />} />
            <Route path="/creator-perks" element={<CreatorPerks />} />
            <Route path="/creator-message-pricing" element={<CreatorMessagePricing />} />
            <Route path="/creator-fams" element={<CreatorFams />} />
            <Route path="/creator-tools/*" element={<Placeholder />} />

            {/* Content Routes */}
            <Route path="/movies" element={<Movies />} />
            <Route path="/watch/:id" element={<Watch />} />
            <Route path="/coin-store" element={<CoinStore />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/mai-wheel" element={<MAIWheel />} />
            <Route path="/fam-shop" element={<FamShop />} />

            {/* Protected Routes */}
            <Route path="/profile" element={<Placeholder />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="/series" element={<SeriesManagement />} />
            <Route path="/dashboard" element={<Placeholder />} />
            <Route path="/admin-dashboard" element={<AdminDashboard />} />

            {/* Placeholder Routes */}
            <Route path="/terms" element={<Placeholder />} />
            <Route path="/privacy" element={<Placeholder />} />

            {/* Catch-all 404 route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
