export type Suit = 'Spades' | 'Hearts' | 'Clubs' | 'Diamonds';
export type Rank = '2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'|'10'|'J'|'Q'|'K'|'A';

export interface Card {
  suit: Suit;
  rank: Rank;
}

export type PlayerState = 'WAITING' | 'PLAYING' | 'PACKED' | 'WINNER' | 'OUT';

export interface Player {
  id: string;
  name: string;
  avatar: string;
  socketId?: string;
  connected: boolean;
  wallet: number;
  invested: number;
  won: number;
  rebuys: number;
  
  // round state
  cards: Card[];
  state: PlayerState;
  seen: boolean;
  betAmount: number; // in current round
  missedTurns: number; // tracks consecutive timeouts
}

export interface Settlement {
  fromId: string;
  toId: string;
  amount: number;
}

export interface RoomConfig {
  buyIn: number;
  rebuyAmount: number;
  maxRebuys: number;
  autoApprove: boolean;
  startingBlind: number;
}

export interface Room {
  id: string;
  hostId: string;
  config: RoomConfig;
  players: Record<string, Player>;
  playerOrder: string[]; // for turn order
  dealerId: string; // ID of the current dealer
  locked: boolean;
  paused: boolean;
  pendingRebuys: string[]; // array of player IDs waiting for rebuy
  status: 'ACTIVE' | 'ENDED';
  settlements?: Settlement[];
  activeRound?: Round;
  lastActivityTime: number;
  pauseStartTime?: number;
}

export type RoundState = 'WAITING_TO_START' | 'IN_PROGRESS' | 'COMPLETED';

export interface Round {
  id: string;
  state: RoundState;
  pot: number;
  currentTurnId: string | null;
  turnExpiry?: number; // Unix timestamp for auto-pack
  minimumBet: number;
  winnerIds: string[];
  winReason?: string;
  deck: Card[];
  actionLog: string[];
  pendingSideShow?: { requesterId: string; targetId: string };
  resolvingSideShow?: { requesterId: string; targetId: string };
}

export interface ClientToServerEvents {
  'join_room': (roomId: string, playerName: string, avatar: string, playerId?: string) => void;
  'rejoin_room': (roomId: string, playerId: string) => void;
  'start_game': () => void;
  'action_blind': () => void;
  'action_chaal': () => void;
  'action_pack': () => void;
  'action_show': () => void;
  'action_sideshow': (targetPlayerId: string) => void;
  'action_sideshow_accept': () => void;
  'action_sideshow_deny': () => void;
  'action_see': () => void;
  'action_raise': (amount: number) => void;
  'action_rebuy': () => void;
  'update_config': (config: Partial<RoomConfig>) => void;
  'end_session': () => void;
  'action_leave_room': () => void;
  // Host Controls
  'host_lock_toggle': () => void;
  'host_kick': (playerId: string) => void;
  'host_transfer': (playerId: string) => void;
  'host_pause_toggle': () => void;
  'host_approve_rebuy': (playerId: string) => void;
  'host_deny_rebuy': (playerId: string) => void;
}

export interface ServerToClientEvents {
  'room_update': (room: Omit<Room, 'activeRound'> & { activeRound?: Omit<Round, 'deck'> }) => void;
  'private_state': (cards: Card[]) => void;
  'error': (message: string) => void;
  'notification': (message: string) => void;
  'animate_coin': (data: { fromPlayerId: string, amount: number }) => void;
  'player_id_assigned': (playerId: string) => void;
  'sideshow_result': (data: { requesterId: string, targetId: string, requesterCards: Card[], targetCards: Card[], loserId: string }) => void;
}

export interface SessionReceiptPlayer {
  id: string;
  name: string;
  avatar: string;
  wallet: number;
  invested: number;
  netProfit: number;
}

export interface SessionReceipt {
  id: string; // unique receipt id
  roomId: string;
  date: number; // timestamp
  hostId: string;
  players: Record<string, SessionReceiptPlayer>;
  settlements: Settlement[];
}
