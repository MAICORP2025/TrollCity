// src/hooks/useTrollopoly.ts
// Hook for Trollopoly game management with real-time sync

import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useTrollopolyStore, DEFAULT_TROLLOPOLY_CONFIG } from '../stores/trollopolyStore';
import { useAuthStore } from '../lib/store';
import { deductCoins, addCoins } from '../lib/coinTransactions';
import type { TrollopolyPlayer, TrollopolyPiece } from '../lib/game/gameTypes';
import { toast } from 'sonner';

interface UseTrollopolyOptions {
  streamId: string;
  isHost: boolean;
  enabled?: boolean;
}

export function useTrollopoly({ streamId, isHost, enabled = true }: UseTrollopolyOptions) {
  const { user, profile, refreshProfile } = useAuthStore();
  const store = useTrollopolyStore();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const originalBoxCountRef = useRef<number | null>(null);

  const channelName = `trollopoly-${streamId}`;

  const broadcastState = useCallback(
    async (event: string, payload: any) => {
      if (!channelRef.current) return;
      try {
        await channelRef.current.send({
          type: 'broadcast',
          event,
          payload: { ...payload, _senderId: user?.id, _timestamp: Date.now() },
        });
      } catch (err) {
        console.error('[useTrollopoly] Broadcast error:', err);
      }
    },
    [user?.id]
  );

  const syncMatchState = useCallback(async () => {
    const match = store.match;
    if (!match) return;
    await broadcastState('match-sync', { match });
  }, [store.match, broadcastState]);

  useEffect(() => {
    if (!enabled || !streamId) return;

    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: true, ack: true } },
    });

    channel.on('broadcast', { event: 'match-sync' }, ({ payload }) => {
      if (payload._senderId === user?.id) return;
      if (payload.match) store.setMatch(payload.match);
    });

    channel.on('broadcast', { event: 'game-created' }, ({ payload }) => {
      if (payload._senderId === user?.id) return;
      // Show game available UI even before receiving full match sync
      store.setMatch({
        id: payload.matchId,
        streamId,
        status: 'lobby',
        phase: 'lobby',
        players: [],
        currentTurnIndex: 0,
        countdownRemaining: 20,
        boardRotation: 0,
        lastDiceRoll: null,
        properties: [],
        winnerId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    channel.on('broadcast', { event: 'player-join' }, ({ payload }) => {
      if (payload._senderId === user?.id) return;
      if (payload.player) store.addPlayer(payload.player);
    });

    channel.on('broadcast', { event: 'player-leave' }, ({ payload }) => {
      if (payload._senderId === user?.id) return;
      if (payload.playerId) store.removePlayer(payload.playerId);
    });

    channel.on('broadcast', { event: 'piece-selected' }, ({ payload }) => {
      if (payload._senderId === user?.id) return;
      if (payload.playerId && payload.piece) store.setPlayerPiece(payload.playerId, payload.piece);
    });

    channel.on('broadcast', { event: 'game-start' }, () => store.startGame());
    
    channel.on('broadcast', { event: 'game-created' }, ({ payload }) => {
      if (payload._senderId === user?.id) return;
      // When game actually starts, update to playing phase
      if (store.match) {
        store.setMatch({ ...store.match, status: 'active', phase: 'playing' });
      }
    });

    channel.on('broadcast', { event: 'dice-roll' }, ({ payload }) => {
      if (payload._senderId === user?.id) return;
      if (typeof payload.dice === 'number') {
        const match = store.match;
        if (match) {
          store.setMatch({ ...match, lastDiceRoll: payload.dice });
        }
      }
    });

    channel.on('broadcast', { event: 'player-move' }, ({ payload }) => {
      if (payload._senderId === user?.id) return;
      if (payload.playerId && typeof payload.position === 'number') {
        const match = store.match;
        if (match) {
          const newPlayers = match.players.map(p =>
            p.id === payload.playerId ? { ...p, position: payload.position } : p
          );
          store.setMatch({ ...match, players: newPlayers });
        }
      }
    });

    channel.on('broadcast', { event: 'turn-change' }, ({ payload }) => {
      if (payload._senderId === user?.id) return;
      if (typeof payload.turnIndex === 'number') {
        const match = store.match;
        if (match) {
          store.setMatch({ ...match, currentTurnIndex: payload.turnIndex });
        }
      }
    });

    channel.on('broadcast', { event: 'property-buy' }, ({ payload }) => {
      if (payload._senderId === user?.id) return;
      if (payload.playerId && typeof payload.propertyId === 'number') {
        const match = store.match;
        if (match) {
          const newProperties = match.properties.map(p =>
            p.id === payload.propertyId ? { ...p, ownerId: payload.playerId } : p
          );
          const newPlayers = match.players.map(p =>
            p.id === payload.playerId ? { ...p, balance: p.balance - (match.properties.find(prop => prop.id === payload.propertyId)?.price || 0) } : p
          );
          store.setMatch({ ...match, properties: newProperties, players: newPlayers });
        }
      }
    });

    channel.on('broadcast', { event: 'board-rotation' }, ({ payload }) => {
      if (payload._senderId === user?.id) return;
      if (typeof payload.rotation === 'number') {
        const match = store.match;
        if (match) {
          store.setMatch({ ...match, boardRotation: payload.rotation });
        }
      }
    });

    channel.on('broadcast', { event: 'match-end' }, ({ payload }) => {
      if (payload._senderId === user?.id) return;
      if (payload.winnerId) store.endGame(payload.winnerId);
    });

    channel.on('broadcast', { event: 'match-reset' }, () => {
      store.resetMatch();
    });

    channel.subscribe((status) => console.log('[useTrollopoly] Channel status:', status));
    channelRef.current = channel;

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [streamId, enabled, channelName, user?.id, store]);

  useEffect(() => {
    if (store.match?.phase === 'lobby') {
      timerRef.current = setInterval(() => store.tickCountdown(), 1000);
    } else {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [store.match?.phase]);

  const createGame = useCallback(async () => {
    if (!isHost || !user || !profile) return;
    store.createMatch(streamId, user.id, profile.username || 'Anonymous');
    // First broadcast simple "game created" event so viewers see it immediately
    await broadcastState('game-created', { matchId: store.match?.id });
    // Then broadcast full sync
    await syncMatchState();
    toast.success('Trollopoly lobby created!');
  }, [isHost, user, profile, streamId, store, syncMatchState, broadcastState]);

  const startCountdown = useCallback(async () => {
    if (!isHost) return;
    store.startCountdown();
    await syncMatchState();
    toast.success('Lobby countdown started!');
  }, [isHost, store, syncMatchState]);

  const joinGame = useCallback(async () => {
    if (!user || !profile || !store.match || store.match.status !== 'lobby') return;
    if (store.match.players.some(p => p.id === user.id)) return;
    if (store.match.players.length >= DEFAULT_TROLLOPOLY_CONFIG.maxPlayers) {
      toast.error('Game is full!');
      return;
    }

    const newPlayer: TrollopolyPlayer = {
      id: user.id,
      username: profile.username || 'Anonymous',
      avatar: profile.avatar_url,
      piece: null,
      balance: DEFAULT_TROLLOPOLY_CONFIG.startingBalance,
      position: 0,
      isBankrupt: false,
      isConnected: true,
    };

    store.addPlayer(newPlayer);
    await broadcastState('player-join', { player: newPlayer });
    toast.success('Joined Trollopoly!');
  }, [user, profile, store, broadcastState]);

  const leaveGame = useCallback(async () => {
    if (!user || !store.match || store.match.status !== 'lobby') return;
    store.removePlayer(user.id);
    await broadcastState('player-leave', { playerId: user.id });
    toast.info('Left the game');
  }, [user, store, broadcastState]);

  const selectPiece = useCallback(async (piece: TrollopolyPiece) => {
    if (!user || !store.match) return;
    store.setPlayerPiece(user.id, piece);
    await broadcastState('piece-selected', { playerId: user.id, piece });
    toast.success(`You chose the ${piece.replace('_', ' ')}!`);
  }, [user, store, broadcastState]);

  const startGame = useCallback(async () => {
    if (!isHost || !store.match) return;

    // Deduct 2000 coins from each player and add to game balance
    const ENTRY_FEE = 2000;
    let totalCollected = 0;

    for (const player of store.match.players) {
      try {
        const result = await deductCoins({
          userId: player.id,
          amount: ENTRY_FEE,
          type: 'game',
          description: `Trollopoly entry fee`,
          metadata: { matchId: store.match.id, gameType: 'trollopoly' },
        });

        if (result.success) {
          totalCollected += ENTRY_FEE;
          // Update player balance in store
          store.updatePlayerBalance(player.id, player.balance - ENTRY_FEE);
        } else {
          toast.error(`Failed to collect entry fee from ${player.username}`);
          return; // Don't start game if fee collection fails
        }
      } catch (err) {
        console.error(`Failed to deduct coins from ${player.username}:`, err);
        toast.error(`Failed to collect entry fee from ${player.username}`);
        return;
      }
    }

    // Update game balance
    store.updateGameBalance(totalCollected);

    try {
      const { data: streamData } = await supabase
        .from('streams')
        .select('box_count')
        .eq('id', streamId)
        .single();
      originalBoxCountRef.current = streamData?.box_count || 1;
      await supabase
        .from('streams')
        .update({ box_count: 9 })
        .eq('id', streamId);
    } catch (err) {
      console.error('[useTrollopoly] Failed to set box_count:', err);
    }

    store.startGame();
    await broadcastState('game-start', {});
    toast.success(`Trollopoly started! Entry fees collected: ${totalCollected} coins`);
  }, [isHost, store, broadcastState, streamId]);

  const rollDice = useCallback(async () => {
    if (!store.match || store.match.status !== 'active') return;
    const currentPlayer = store.match.players[store.match.currentTurnIndex];
    if (!currentPlayer || currentPlayer.id !== user?.id) {
      toast.error('Not your turn!');
      return 0;
    }

    const dice = store.rollDice();
    await broadcastState('dice-roll', { dice });

    const newPosition = (currentPlayer.position + dice) % 24;
    const updatedPlayers = store.match.players.map(p =>
      p.id === user.id ? { ...p, position: newPosition } : p
    );
    store.setMatch({ ...store.match, players: updatedPlayers });
    await broadcastState('player-move', { playerId: user.id, position: newPosition });

    const landedProperty = store.match.properties.find(p => p.id === newPosition);
    if (landedProperty && landedProperty.ownerId && landedProperty.ownerId !== user.id) {
      const rent = landedProperty.rent;
      const canAfford = currentPlayer.balance >= rent;
      if (canAfford) {
        const result = await deductCoins({
          userId: user.id,
          amount: rent,
          type: 'game',
          description: `Trollopoly rent payment`,
          metadata: { propertyId: landedProperty.id, propertyName: landedProperty.name },
        });
        if (result.success) {
          await addCoins({
            userId: landedProperty.ownerId,
            amount: rent,
            type: 'reward',
            description: `Trollopoly rent collected`,
            metadata: { fromPlayerId: user.id, propertyId: landedProperty.id },
          });
          
          store.payRent(user.id, landedProperty.ownerId, rent);
          await syncMatchState();
          toast.success(`Paid ${rent} coins rent!`);
        }
      } else {
        store.setMatch({
          ...store.match,
          players: store.match.players.map(p =>
            p.id === user.id ? { ...p, isBankrupt: true } : p
          ),
        });
        toast.error('Bankrupt! Not enough coins to pay rent.');
      }
    } else if (landedProperty && !landedProperty.ownerId && landedProperty.price > 0) {
      toast.info(`You landed on ${landedProperty.name}! Price: ${landedProperty.price}`);
    }

    return dice;
  }, [store, user, broadcastState, syncMatchState]);

  const buyProperty = useCallback(async (propertyId: number) => {
    if (!user || !store.match) return false;
    const currentPlayer = store.match.players[store.match.currentTurnIndex];
    if (!currentPlayer || currentPlayer.id !== user.id) return false;

    const property = store.match.properties.find(p => p.id === propertyId);
    if (!property || property.ownerId !== null) return false;

    const result = await deductCoins({
      userId: user.id,
      amount: property.price,
      type: 'game',
      description: `Trollopoly property purchase: ${property.name}`,
      metadata: { propertyId, propertyName: property.name },
    });

    if (!result.success) {
      toast.error(result.error || 'Failed to purchase property');
      return false;
    }

    const success = store.buyProperty(user.id, propertyId);
    if (success) {
      refreshProfile();
      await broadcastState('property-buy', { playerId: user.id, propertyId });
      toast.success(`Bought ${property.name} for ${property.price} coins!`);
      return true;
    }

    return false;
  }, [user, store, broadcastState, refreshProfile]);

  const endTurn = useCallback(async () => {
    if (!isHost || !store.match) return;
    store.nextTurn();
    
    const match = store.match;
    if (match) {
      const nextIndex = match.currentTurnIndex + 1 >= match.players.length ? 0 : match.currentTurnIndex + 1;
      const nextPlayer = match.players[nextIndex];
      const rotation = (nextIndex * 60) % 360;
      
      store.setMatch({ 
        ...match, 
        currentTurnIndex: nextIndex,
        boardRotation: rotation 
      });
      
      await broadcastState('turn-change', { turnIndex: nextIndex });
      await broadcastState('board-rotation', { rotation });
    }
  }, [isHost, store, broadcastState]);

  const endGame = useCallback(async () => {
    if (!isHost || !store.match) return;

    const alivePlayers = store.match.players.filter(p => !p.isBankrupt);
    if (alivePlayers.length === 1) {
      const winner = alivePlayers[0];
      const rewardAmount = 100;

      await addCoins({
        userId: winner.id,
        amount: rewardAmount,
        type: 'reward',
        description: 'Trollopoly winner prize',
        metadata: { matchId: store.match.id },
      });

      store.endGame(winner.id);
      await broadcastState('match-end', { winnerId: winner.id });

      // Immediately restore box_count when game ends
      if (originalBoxCountRef.current !== null) {
        try {
          await supabase
            .from('streams')
            .update({ box_count: originalBoxCountRef.current })
            .eq('id', streamId);
          console.log('[useTrollopoly] Restored box_count to:', originalBoxCountRef.current);
        } catch (err) {
          console.error('[useTrollopoly] Failed to restore box_count on game end:', err);
        }
      }

      // Reset the match after a delay to allow for proper cleanup
      setTimeout(() => {
        store.resetMatch();
        // Note: activeGame will be cleared by the UI when user clicks close
      }, 3000);
      refreshProfile();
      toast.success(`${winner.username} wins ${rewardAmount} coins!`);
    } else if (alivePlayers.length === 0) {
      store.endGame('');
      await broadcastState('match-end', { winnerId: null });

      // Immediately restore box_count when game ends
      if (originalBoxCountRef.current !== null) {
        try {
          await supabase
            .from('streams')
            .update({ box_count: originalBoxCountRef.current })
            .eq('id', streamId);
          console.log('[useTrollopoly] Restored box_count to:', originalBoxCountRef.current);
        } catch (err) {
          console.error('[useTrollopoly] Failed to restore box_count on game end:', err);
        }
      }

      toast.info('Game ended in a draw - all players bankrupt!');
    }
  }, [isHost, store, broadcastState, refreshProfile, streamId]);

  const addCoinsToGame = useCallback(async (amount: number) => {
    if (!user || !store.match) return false;

    const player = store.match.players.find(p => p.id === user.id);
    if (!player) return false;

    if (player.balance < amount) {
      toast.error('Not enough coins!');
      return false;
    }

    try {
      const result = await deductCoins({
        userId: user.id,
        amount,
        type: 'game',
        description: `Added coins to Trollopoly game pot`,
        metadata: { matchId: store.match.id, gameType: 'trollopoly' },
      });

      if (result.success) {
        store.updatePlayerBalance(user.id, player.balance - amount);
        store.updateGameBalance(amount);
        await syncMatchState();
        toast.success(`Added ${amount} coins to the game pot!`);
        return true;
      } else {
        toast.error(result.error || 'Failed to add coins');
        return false;
      }
    } catch (err) {
      console.error('Failed to add coins to game:', err);
      toast.error('Failed to add coins to game');
      return false;
    }
  }, [user, store, syncMatchState]);

  const resetGame = useCallback(async () => {
    if (!isHost) return;
    store.resetMatch();
    await broadcastState('match-reset', {});

    if (originalBoxCountRef.current !== null) {
      try {
        await supabase
          .from('streams')
          .update({ box_count: originalBoxCountRef.current })
          .eq('id', streamId);
      } catch (err) {
        console.error('[useTrollopoly] Failed to restore box_count on reset:', err);
      }
    }
    toast.info('Trollopoly reset');
  }, [isHost, store, broadcastState, streamId]);

  return {
    match: store.match,
    config: store.config,
    isControllerOpen: store.isControllerOpen,
    viewerStatus: store.viewerStatus,
    availablePieces: store.availablePieces,
    isHost,
    currentPlayer: store.match?.players[store.match?.currentTurnIndex || 0] || null,
    isMyTurn: store.match?.players[store.match?.currentTurnIndex || 0]?.id === user?.id,
    
    setControllerOpen: store.setControllerOpen,
    createGame,
    startCountdown,
    joinGame,
    leaveGame,
    selectPiece,
    startGame,
    rollDice,
    buyProperty,
    addCoinsToGame,
    endTurn,
    endGame,
    resetGame,
    syncMatchState,
  };
}