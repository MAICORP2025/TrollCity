/**
 * Format number to human readable format
 * e.g., 1000 -> 1K, 1000000 -> 1M
 */
export const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toString();
};

/**
 * Format time in seconds to readable format
 * e.g., 3661 -> 1:01:01
 */
export const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
};

/**
 * Format date to readable format
 * e.g., "2024-01-15" -> "Jan 15, 2024"
 */
export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

/**
 * Format relative time
 * e.g., "2 hours ago"
 */
export const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

  return formatDate(dateString);
};

/**
 * Truncate text to a specific length
 */
export const truncateText = (text: string, length: number): string => {
  if (text.length <= length) return text;
  return text.slice(0, length) + "...";
};

/**
 * Get initials from a name
 * e.g., "John Doe" -> "JD"
 */
export const getInitials = (name: string): string => {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase();
};

/**
 * Validate email format
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Generate random color
 */
export const getRandomColor = (): string => {
  const colors = [
    "#FF1744", // neon-red
    "#FFD700", // neon-gold
    "#FF6B9D", // pink
    "#C44569", // crimson
    "#F1A534", // orange-gold
    "#1AA260", // green
    "#0066FF", // blue
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

/**
 * Get color based on status
 */
export const getStatusColor = (
  status: "pending" | "approved" | "rejected"
): string => {
  switch (status) {
    case "approved":
      return "text-green-400";
    case "rejected":
      return "text-red-400";
    case "pending":
    default:
      return "text-yellow-400";
  }
};

/**
 * Get badge color based on VIP tier
 */
export const getVIPColor = (
  tier: "none" | "bronze" | "silver" | "gold" | "platinum"
): string => {
  switch (tier) {
    case "platinum":
      return "text-purple-400";
    case "gold":
      return "text-yellow-400";
    case "silver":
      return "text-gray-300";
    case "bronze":
      return "text-orange-400";
    case "none":
    default:
      return "text-gray-500";
  }
};

/**
 * Check if user is mobile
 */
export const isMobile = (): boolean => {
  if (typeof window === "undefined") return false;
  return window.innerWidth < 768;
};

/**
 * Debounce function
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

/**
 * Format coin amount
 */
export const formatCoins = (coins: number): string => {
  return `₿${coins.toLocaleString()}`;
};
