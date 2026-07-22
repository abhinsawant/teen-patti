import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.PROD 
  ? window.location.origin 
  : 'http://localhost:3001';

export type Card = {
  rank: string;
  suit: '♠' | '♥' | '♦' | '♣';
};

export type ChatMessage = {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
};

export type PlayerState = 'PLAYING' | 'PACKED' | 'OUT';

export type Player = {
  id: string;
  name: string;
  avatar: string;
  wallet: number;
  seat: number;
  isDealer: boolean;
  isActive: boolean;
  isMe: boolean;
  hasSeen: boolean;
  cards: Card[];
  state: PlayerState;
  betAmount: number;
  invested: number;
  won: number;
  connected?: boolean;
};

export type Table = {
  id: string;
  hostId: string;
  bootAmount: number;
  chaalAmount: number;
  potAmount: number;
  currentRound: number;
  maxRounds: number;
  gameState?: string;
};

export type GameState = 'WAITING' | 'DEALING' | 'PLAYING' | 'SHOWDOWN';

type GameStore = {
  players: Player[];
  table: Table;
  gameState: GameState;
  currentTurnIndex: number;
  myPlayerId: string;
  roomId: string | null;
  playerName: string;
  playerAvatar: string;
  socket: Socket | null;
  chatMessages: ChatMessage[];
  settlements: { fromId: string; toId: string; amount: number }[];
  history: any[];
  pendingRebuys: { playerId: string; playerName: string; amount: number }[];
  
  // Actions
  initSocket: () => void;
  joinRoom: (playerName: string, avatar: string, action: 'CREATE' | 'JOIN') => Promise<boolean>;
  startGame: () => void;
  placeBet: (playerId: string, action: 'BLIND' | 'CHAAL', amount: number) => void;
  pack: (playerId: string) => void;
  seeCards: (playerId: string) => void;
  showCards: () => void;
  requestSideShow: (fromPlayerId: string, toPlayerId: string) => void;
  acceptSideShow: () => void;
  declineSideShow: () => void;
  kickPlayer: (targetId: string) => void;
  transferHost: (targetId: string) => void;
  logout: () => void;
  sendChatMessage: (text: string) => void;
  requestRebuy: (amount: number) => void;
  approveRebuy: (targetId: string) => void;
  declineRebuy: (targetId: string) => void;
  sideShowRequest: { from: string; to: string } | null;
  resolvingSideShow: { requesterId: string; targetId: string } | null;
  winnerData: { winnerIds: string[]; winReason?: string } | null;
  disconnectMsg: string | null;
};



export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      players: [],
      table: {
        id: '',
        hostId: '',
        bootAmount: 5,
        chaalAmount: 10,
        potAmount: 0,
        currentRound: 1,
        maxRounds: 10,
        gameState: 'WAITING'
      },
      gameState: 'WAITING',
      currentTurnIndex: 0,
      myPlayerId: '',
      roomId: null,
      playerName: '',
      playerAvatar: '',
      socket: null,
      chatMessages: [],
      settlements: [],
      history: [],
      pendingRebuys: [],
      sideShowRequest: null,
      resolvingSideShow: null,
      winnerData: null,
      disconnectMsg: null,

  initSocket: () => {
    if (get().socket) return; // Already initialized

    const socket = io(SOCKET_URL);
    
    socket.on('room_update', (serverRoom: any) => {
      // Map server players to our frontend format
      const myId = get().myPlayerId;
      const currentPlayers = get().players;
      
      const mappedPlayers = Object.values(serverRoom.players).map((p: any, index: number) => {
        const existingPlayer = currentPlayers.find(old => old.id === p.id);
        let finalCards = p.cards || [];
        
        // Prevent animation flicker for myPlayer by preserving cards if room_update hides them.
        // The subsequent private_state event will immediately correct this if they actually need to be cleared.
        if (p.id === myId && finalCards.length === 0 && existingPlayer) {
          finalCards = existingPlayer.cards;
        }

        return {
          id: p.id,
          name: p.name,
          avatar: p.avatar,
          wallet: p.wallet,
          seat: index, // Simplified seat assignment for now
          isDealer: serverRoom.dealerId === p.id,
          isActive: serverRoom.activeRound?.currentTurnId === p.id || false,
          isMe: p.id === myId,
          hasSeen: p.seen,
          cards: finalCards,
          state: p.state,
          betAmount: p.betAmount,
          invested: p.invested || 0,
          won: p.won || 0,
          connected: p.connected
        };
      });

      // Find current turn index based on the active player
      const turnIndex = mappedPlayers.findIndex((p: any) => p.isActive);
      
      const activeRound = serverRoom.activeRound;

      set({
        players: mappedPlayers,
        table: {
          id: serverRoom.id,
          hostId: serverRoom.hostId,
          bootAmount: serverRoom.config?.startingBlind || 5,
          chaalAmount: activeRound?.minimumBet || 10,
          potAmount: activeRound?.pot || 0,
          currentRound: serverRoom.roundNumber || 1, // Using server round
          maxRounds: 10,
          gameState: activeRound?.state || 'WAITING'
        },
        roomId: serverRoom.id,
        currentTurnIndex: turnIndex >= 0 ? turnIndex : 0,
        sideShowRequest: activeRound?.pendingSideShow ? { from: activeRound.pendingSideShow.requesterId, to: activeRound.pendingSideShow.targetId } : null,
        resolvingSideShow: activeRound?.resolvingSideShow || null,
        winnerData: activeRound?.winnerIds?.length > 0 ? { winnerIds: activeRound.winnerIds, winReason: activeRound.winReason } : null,
        settlements: serverRoom.settlements || [],
        history: serverRoom.history || [],
        pendingRebuys: serverRoom.pendingRebuys || []
      });
    });

    socket.on('private_state', (cards: Card[]) => {
      set((state) => ({
        players: state.players.map(p => 
          p.id === state.myPlayerId ? { ...p, cards } : p
        )
      }));
    });

    socket.on('chat_message', (message: ChatMessage) => {
      set((state) => ({
        chatMessages: [...state.chatMessages, message]
      }));
    });

    socket.on('room_timeout', (reason: string) => {
      set({ disconnectMsg: reason, roomId: null, players: [], chatMessages: [] });
    });

    set({ socket });
  },

  joinRoom: (playerName, avatar, action) => {
    return new Promise((resolve, reject) => {
      const socket = get().socket;
      if (!socket) return reject(new Error('Socket not initialized'));

      let timeoutId: ReturnType<typeof setTimeout>;

      // One-time listeners for the join response
      const onAssigned = (data: { playerId: string, roomId: string }) => {
        set({ 
          myPlayerId: data.playerId, 
          roomId: data.roomId, 
          playerName,
          playerAvatar: avatar,
          disconnectMsg: null,
          chatMessages: [] // Clear old chat messages on join
        });
        cleanup();
        resolve(true);
      };

      const onError = (msg: string) => {
        cleanup();
        reject(new Error(msg));
      };

      const cleanup = () => {
        clearTimeout(timeoutId);
        socket.off('player_id_assigned', onAssigned);
        socket.off('error', onError);
      };

      timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error('Server connection timed out. Is the backend running?'));
      }, 5000);

      socket.once('player_id_assigned', onAssigned);
      socket.once('error', onError);

      socket.emit(action === 'CREATE' ? 'create_room' : 'join_room', { 
        playerName, 
        avatar, 
        playerId: get().myPlayerId || undefined 
      });
    });
  },

  startGame: () => {
    get().socket?.emit('player_action', { 
      roomId: get().roomId, 
      type: 'START_GAME'
    });
  },

  placeBet: (_playerId, action, amount) => {
    get().socket?.emit('player_action', { 
      roomId: get().roomId, 
      type: action, 
      amount 
    });
  },

  pack: (_playerId) => {
    get().socket?.emit('player_action', { 
      roomId: get().roomId, 
      type: 'PACK' 
    });
  },

  seeCards: (_playerId) => {
    get().socket?.emit('player_action', { 
      roomId: get().roomId, 
      type: 'SEE_CARDS' 
    });
  },

  showCards: () => {
    const table = get().table;
    const myPlayer = get().players.find(p => p.id === get().myPlayerId);
    
    // The cost of a SHOW is twice the current bet that the player would have to play.
    const normalBet = myPlayer?.hasSeen ? table.chaalAmount * 2 : table.chaalAmount;
    const amount = normalBet * 2; 

    get().socket?.emit('player_action', { 
      roomId: get().roomId, 
      type: 'SHOW',
      amount
    });
  },

  requestSideShow: (_fromPlayerId, toPlayerId) => {
    get().socket?.emit('player_action', { 
      roomId: get().roomId, 
      type: 'SIDE_SHOW',
      targetId: toPlayerId
    });
  },

  acceptSideShow: () => {
    const req = get().sideShowRequest;
    if (req) {
      get().socket?.emit('player_action', { 
        roomId: get().roomId, 
        type: 'ACCEPT_SIDE_SHOW',
        targetId: req.from
      });
      set({ sideShowRequest: null });
    }
  },

  declineSideShow: () => {
    const req = get().sideShowRequest;
    if (req) {
      get().socket?.emit('player_action', { 
        roomId: get().roomId, 
        type: 'DECLINE_SIDE_SHOW',
        targetId: req.from
      });
      set({ sideShowRequest: null });
    }
  },

  kickPlayer: (targetId: string) => {
    get().socket?.emit('action_kick_player', {
      roomId: get().roomId,
      targetId,
      requesterId: get().myPlayerId
    });
  },

  transferHost: (targetId: string) => {
    get().socket?.emit('action_transfer_host', {
      roomId: get().roomId,
      targetId,
      requesterId: get().myPlayerId
    });
  },

  logout: () => {
    const s = get().socket;
    if (s) {
      s.emit('logout', { roomId: get().roomId, playerId: get().myPlayerId });
      s.disconnect();
    }
    set({ 
      roomId: null, 
      myPlayerId: '', 
      playerName: '', 
      playerAvatar: '',
      players: [], 
      chatMessages: [], 
      history: [],
      socket: null,
      disconnectMsg: 'You left the room.',
      pendingRebuys: []
    });
  },

  sendChatMessage: (text: string) => {
    const state = get();
    const myPlayer = state.players.find(p => p.id === state.myPlayerId);
    if (!myPlayer || !text.trim() || !state.roomId) return;
    
    state.socket?.emit('chat_message', {
      roomId: state.roomId,
      senderId: myPlayer.id,
      senderName: myPlayer.name,
      text: text.trim()
    });
  },

  requestRebuy: (amount: number) => {
    get().socket?.emit('request_rebuy', {
      roomId: get().roomId,
      amount
    });
  },

  approveRebuy: (targetId: string) => {
    get().socket?.emit('approve_rebuy', {
      roomId: get().roomId,
      targetId,
      requesterId: get().myPlayerId
    });
  },

  declineRebuy: (targetId: string) => {
    get().socket?.emit('decline_rebuy', {
      roomId: get().roomId,
      targetId,
      requesterId: get().myPlayerId
    });
  }
}),
{
  name: 'teen-patti-storage',
  storage: createJSONStorage(() => sessionStorage),
  partialize: (state) => ({ 
    roomId: state.roomId, 
    myPlayerId: state.myPlayerId,
    playerName: state.playerName,
    playerAvatar: state.playerAvatar
  }),
}
));
