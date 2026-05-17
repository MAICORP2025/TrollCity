import React from 'react';
import { StreamCapacity } from '../hooks/useStreamCapacity';

interface CapacityStatusProps {
  capacity: StreamCapacity;
  isInQueue: boolean;
  onJoinQueue?: () => void;
  onLeaveQueue?: () => void;
  className?: string;
}

export function CapacityStatus({
  capacity,
  isInQueue,
  onJoinQueue,
  onLeaveQueue,
  className = ''
}: CapacityStatusProps) {
  const { maxInteractiveUsers, currentInteractiveUsers, isAtCapacity, queuePosition, estimatedWaitTime } = capacity;

  if (isInQueue) {
    return (
      <div className={`bg-yellow-50 border border-yellow-200 rounded-lg p-3 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium text-yellow-800">
              In Waitlist (Position {queuePosition})
            </span>
          </div>
          {onLeaveQueue && (
            <button
              onClick={onLeaveQueue}
              className="text-xs text-yellow-600 hover:text-yellow-800 underline"
            >
              Leave Queue
            </button>
          )}
        </div>
        {estimatedWaitTime && (
          <p className="text-xs text-yellow-600 mt-1">
            Estimated wait: ~{estimatedWaitTime} minutes
          </p>
        )}
      </div>
    );
  }

  if (isAtCapacity) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-3 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-red-400 rounded-full"></div>
            <span className="text-sm font-medium text-red-800">
              Stream at Capacity ({currentInteractiveUsers}/{maxInteractiveUsers})
            </span>
          </div>
          {onJoinQueue && (
            <button
              onClick={onJoinQueue}
              className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-medium rounded transition-colors"
            >
              Join Waitlist
            </button>
          )}
        </div>
        <p className="text-xs text-red-600 mt-1">
          Interactive participation is full. Join the waitlist to be notified when a spot opens up.
        </p>
      </div>
    );
  }

  // Show capacity indicator when approaching limit
  const isNearCapacity = currentInteractiveUsers >= maxInteractiveUsers * 0.8;

  if (isNearCapacity) {
    return (
      <div className={`bg-orange-50 border border-orange-200 rounded-lg p-3 ${className}`}>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
          <span className="text-sm font-medium text-orange-800">
            Filling Up ({currentInteractiveUsers}/{maxInteractiveUsers})
          </span>
        </div>
        <div className="w-full bg-orange-200 rounded-full h-1.5 mt-2">
          <div
            className="bg-orange-400 h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${(currentInteractiveUsers / maxInteractiveUsers) * 100}%` }}
          ></div>
        </div>
      </div>
    );
  }

  return null; // Don't show anything when capacity is normal
}