import React from 'react';
import { Mic, MicOff, Camera, CameraOff, RotateCcw, Wand2 } from 'lucide-react';

interface FloatingActionClusterProps {
  isMuted: boolean;
  onToggleMic: () => void;
  isCameraOn: boolean;
  onToggleCamera: () => void;
  onFlipCamera: () => void;
  onEffectsClick: () => void;
  className?: string;
}

export default function FloatingActionCluster({
  isMuted,
  onToggleMic,
  isCameraOn,
  onToggleCamera,
  onFlipCamera,
  onEffectsClick,
  className = ''
}: FloatingActionClusterProps) {
  const actions = [
    {
      id: 'mic',
      icon: isMuted ? MicOff : Mic,
      isActive: !isMuted,
      onClick: onToggleMic,
      label: isMuted ? 'Unmute' : 'Mute',
      isDanger: isMuted
    },
    {
      id: 'camera',
      icon: isCameraOn ? Camera : CameraOff,
      isActive: isCameraOn,
      onClick: onToggleCamera,
      label: isCameraOn ? 'Camera On' : 'Camera Off',
      isDanger: !isCameraOn
    },
    {
      id: 'flip',
      icon: RotateCcw,
      isActive: false,
      onClick: onFlipCamera,
      label: 'Flip Camera'
    },
    {
      id: 'effects',
      icon: Wand2,
      isActive: false,
      onClick: onEffectsClick,
      label: 'Effects'
    }
  ];

  return (
    <div className={`broadcast-floating-cluster ${className}`}>
      {actions.map((action) => {
        const IconComponent = action.icon;
        return (
          <button
            key={action.id}
            className={`broadcast-action-button ${action.isActive ? 'active' : ''} ${
              action.isDanger ? 'danger' : ''
            }`}
            onClick={action.onClick}
            aria-label={action.label}
            title={action.label}
          >
            <IconComponent size={20} />
          </button>
        );
      })}
    </div>
  );
}
