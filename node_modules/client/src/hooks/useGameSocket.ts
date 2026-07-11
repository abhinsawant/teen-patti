import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { Room, Card, ClientToServerEvents, ServerToClientEvents } from 'shared';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || (import.meta.env.PROD ? '' : 'http://localhost:3001');

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function useGameSocket(roomId: string, playerName: string, avatar: string, playerId?: string) {
  const [socket, setSocket] = useState<GameSocket | null>(null);
  const [room, setRoom] = useState<Partial<Room> | null>(null);
  const [privateCards, setPrivateCards] = useState<Card[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    if (!roomId || !playerName) return;

    const newSocket: GameSocket = io(SERVER_URL);

    newSocket.on('connect', () => {
      newSocket.emit('join_room', roomId, playerName, avatar, playerId);
    });

    newSocket.on('room_update', (updatedRoom) => {
      setRoom(updatedRoom as any);
      setError(null);
    });

    newSocket.on('private_state', (cards) => {
      setPrivateCards(cards);
    });

    newSocket.on('error', (msg) => {
      setError(msg);
    });
    
    newSocket.on('notification', (msg) => {
      setNotification(msg);
      // Auto-clear notification after 3 seconds
      setTimeout(() => setNotification(null), 3000);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [roomId, playerName, playerId]);

  const startGame = useCallback(() => socket?.emit('start_game'), [socket]);
  const actionBlind = useCallback(() => socket?.emit('action_blind'), [socket]);
  const actionChaal = useCallback(() => socket?.emit('action_chaal'), [socket]);
  const actionPack = useCallback(() => socket?.emit('action_pack'), [socket]);
  const actionShow = useCallback(() => socket?.emit('action_show'), [socket]);
  const actionSideshow = useCallback((targetId: string) => socket?.emit('action_sideshow', targetId), [socket]);
  const actionSideshowAccept = useCallback(() => socket?.emit('action_sideshow_accept'), [socket]);
  const actionSideshowDeny = useCallback(() => socket?.emit('action_sideshow_deny'), [socket]);
  const actionSee = useCallback(() => socket?.emit('action_see'), [socket]);
  const actionRaise = useCallback((amount: number) => socket?.emit('action_raise', amount), [socket]);
  const actionRebuy = useCallback(() => socket?.emit('action_rebuy'), [socket]);
  const endSession = useCallback(() => socket?.emit('end_session'), [socket]);
  const updateConfig = useCallback((config: any) => socket?.emit('update_config', config), [socket]);
  
  // Host Controls
  const hostLockToggle = useCallback(() => socket?.emit('host_lock_toggle'), [socket]);
  const hostKick = useCallback((id: string) => socket?.emit('host_kick', id), [socket]);
  const hostTransfer = useCallback((id: string) => socket?.emit('host_transfer', id), [socket]);
  const hostPauseToggle = useCallback(() => socket?.emit('host_pause_toggle'), [socket]);
  const hostApproveRebuy = useCallback((id: string) => socket?.emit('host_approve_rebuy', id), [socket]);
  const hostDenyRebuy = useCallback((id: string) => socket?.emit('host_deny_rebuy', id), [socket]);

  return { 
    socket, room, privateCards, error, notification, 
    startGame, actionBlind, actionChaal, actionPack, actionShow, actionSideshow, 
    actionSideshowAccept, actionSideshowDeny, actionSee, actionRaise, actionRebuy, 
    endSession, updateConfig,
    hostLockToggle, hostKick, hostTransfer, hostPauseToggle, hostApproveRebuy, hostDenyRebuy
  };
}
