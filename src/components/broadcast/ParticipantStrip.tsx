import React from 'react';
import { UserPlus, Users } from 'lucide-react';

interface Participant {
  id: string;
  username: string;
  avatarUrl?: string | null;
  isActive?: boolean;
}

interface ParticipantStripProps {
  participants: Participant[];
  onInviteClick: () => void;
  onParticipantClick?: (participant: Participant) => void;
  className?: string;
}

export default function ParticipantStrip({
  participants,
  onInviteClick,
  onParticipantClick,
  className = ''
}: ParticipantStripProps) {
  // Only show active participants (filter out any empty slots)
  const activeParticipants = participants.filter(p => p.id && p.username);

  return (
    <div className={`broadcast-participant-strip ${className}`}>
      {activeParticipants.length > 0 ? (
        <>
          {/* Participant Tiles */}
          {activeParticipants.map((participant) => (
            <div
              key={participant.id}
              className="broadcast-participant-tile"
              onClick={() => onParticipantClick?.(participant)}
              title={participant.username}
            >
              {participant.avatarUrl ? (
                <img src={participant.avatarUrl} alt={participant.username} />
              ) : (
                <Users className="broadcast-participant-tile-icon" />
              )}
            </div>
          ))}

          {/* Invite Button if space available */}
          {activeParticipants.length < 6 && (
            <button
              className="broadcast-invite-button"
              onClick={onInviteClick}
              title="Invite Guest"
            >
              <UserPlus size={14} />
              <span>Invite</span>
            </button>
          )}
        </>
      ) : (
        // Show invite button when no participants
        <button
          className="broadcast-invite-button"
          onClick={onInviteClick}
          title="Invite Guest"
        >
          <UserPlus size={14} />
          <span>Invite Guest</span>
        </button>
      )}
    </div>
  );
}
