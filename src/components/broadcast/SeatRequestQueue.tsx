import React, { useState, useEffect } from 'react';
import { StreamSeatRequest } from '../../types/seatRequest';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { User } from 'lucide-react';
import { useAuthStore } from '../../lib/store';

interface SeatRequestQueueProps {
  requests: StreamSeatRequest[];
  onApprove: (requestId: string) => Promise<{ success: boolean; error?: string }>;
  onDeny: (requestId: string, reason?: string) => Promise<{ success: boolean; error?: string }>;
  isLoading?: boolean;
}

export function SeatRequestQueue({ requests, onApprove, onDeny, isLoading }: SeatRequestQueueProps) {
  const { user } = useAuthStore();
  const [denialReason, setDenialReason] = useState<string>('');
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [approving, setApproving] = useState<Set<string>>(new Set());
  const [denying, setDenying] = useState<Set<string>>(new Set());

  // Filter to only pending requests
  const pendingRequests = requests.filter(r => r.status === 'pending');

  const handleApprove = async (requestId: string) => {
    setApproving(prev => new Set([...prev, requestId]));
    try {
      const result = await onApprove(requestId);
      if (!result.success) {
        toast.error(result.error || 'Failed to approve request');
      } else {
        toast.success('Request approved! Waiting for user to connect...');
      }
    } finally {
      setApproving(prev => {
        const next = new Set(prev);
        next.delete(requestId);
        return next;
      });
    }
  };

  const handleDeny = async (requestId: string) => {
    setDenying(prev => new Set([...prev, requestId]));
    try {
      const result = await onDeny(requestId, denialReason);
      if (!result.success) {
        toast.error(result.error || 'Failed to deny request');
      } else {
        toast.success('Request denied. Refund processed.');
        setDenialReason('');
        setSelectedRequestId(null);
      }
    } finally {
      setDenying(prev => {
        const next = new Set(prev);
        next.delete(requestId);
        return next;
      });
    }
  };

  if (pendingRequests.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">No pending seat requests</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 overflow-hidden">
      <div className="bg-gray-100 dark:bg-gray-900 px-4 py-3 border-b border-gray-200 dark:border-gray-800">
        <h3 className="font-semibold text-sm">
          Seat Requests ({pendingRequests.length})
        </h3>
      </div>

      <div className="divide-y divide-gray-200 dark:divide-gray-800">
        {pendingRequests.map((request) => (
          <div
            key={request.id}
            className="p-4 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-800 overflow-hidden flex-shrink-0 flex items-center justify-center">
                {request.user_profile?.avatar_url ? (
                  <img
                    src={request.user_profile.avatar_url}
                    alt={request.user_profile.username || 'User'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-5 h-5 text-gray-400" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm">
                    {request.user_profile?.username || 'Unknown User'}
                  </p>
                  {request.seat_price > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-100 px-2 py-1 rounded">
                      💰 {request.seat_price} coins
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Requesting Seat {request.seat_index}
                </p>
              </div>

              {/* Expiration timer */}
              {request.expires_at && (
                <ExpirationTimer expiresAt={request.expires_at} />
              )}
            </div>

            {/* Denial form if selected */}
            {selectedRequestId === request.id && (
              <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded mb-3 space-y-2">
                <label className="block text-xs font-medium">Reason for denial (optional):</label>
                <textarea
                  value={denialReason}
                  onChange={(e) => setDenialReason(e.target.value)}
                  placeholder="E.g., No more seat slots available"
                  className="w-full text-xs p-2 border border-gray-200 dark:border-gray-800 rounded bg-white dark:bg-gray-950"
                  rows={2}
                />
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2">
              <Button
                variant="success"
                size="sm"
                onClick={() => handleApprove(request.id)}
                disabled={approving.has(request.id) || denying.has(request.id) || isLoading}
              >
                {approving.has(request.id) ? 'Approving...' : 'Accept'}
              </Button>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (selectedRequestId === request.id) {
                    handleDeny(request.id);
                  } else {
                    setSelectedRequestId(request.id);
                  }
                }}
                disabled={approving.has(request.id) || denying.has(request.id) || isLoading}
              >
                {denying.has(request.id) ? 'Denying...' : selectedRequestId === request.id ? 'Confirm Deny' : 'Deny'}
              </Button>

              {selectedRequestId === request.id && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedRequestId(null);
                    setDenialReason('');
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Helper component to show countdown timer
function ExpirationTimer({ expiresAt }: { expiresAt: string }) {
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const expires = new Date(expiresAt);
      const diff = expires.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft('Expired');
      } else {
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${minutes}:${seconds.toString().padStart(2, '0')}`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  return (
    <span className="text-xs text-gray-500 dark:text-gray-400 font-mono whitespace-nowrap">
      {timeLeft}
    </span>
  );
}
