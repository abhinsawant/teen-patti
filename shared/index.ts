export type Suit = 'Spades' | 'Hearts' | 'Clubs' | 'Diamonds';
export type Rank = '2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'|'10'|'J'|'Q'|'K'|'A';

export interface Card {
  suit: Suit;
  rank: Rank;
}

export type PlayerState = 'WAITING' | 'PLAYING' | 'PACKED' | 'WINNER' | 'OUT';

export interface Player {
  id: string;            // Unique device-bound identifier
  name: string;          // Display name (unique per room)
  avatar: string;        // Emoji avatar
  socketId?: string;     // Current WebSocket connection ID
  connected: boolean;    // Live connection status
  wallet: number;        // Current chip balance (₹)
  invested: number;      // Total chips invested (for settlement)
  won: number;           // Total chips won across all rounds
  rebuys: number;        // Number of rebuys used
  cards: Card[];         // 3 cards dealt each round
  state: PlayerState;    // Current game state
  seen: boolean;         // Whether player has seen their cards
  betAmount: number;     // Total bet in current round
  missedTurns: number;   // Consecutive turn timeouts counter (max 3)
}

export interface RoomConfig {
  buyIn: number;          // Initial chip amount (default: ₹1000)
  rebuyAmount: number;    // Chips per rebuy (default: ₹1000)
  maxRebuys: number;      // Max rebuys per player (default: 3)
  autoApprove: boolean;   // Auto-approve rebuys (default: true)
  startingBlind: number;  // Blind bet amount (default: ₹5)
}

export interface RoundHistory {
  roundNumber: number;
  winnerIds: string[];
  winReason: string;
  pot: number;
}

export interface Room {
  id: string;             // 6-char alphanumeric room code
  hostId: string;         // Player ID of the host
  config: RoomConfig;
  players: Record<string, Player>;
  playerOrder: string[];  // Turn order (by join order)
  dealerId: string;       // Current dealer (rotates each round)
  locked: boolean;        // No new players can join
  paused: boolean;        // Turn timers suspended
  pendingRebuys: string[];// Players awaiting host rebuy approval
  roundNumber: number;    // Current round number
  status: 'ACTIVE' | 'ENDED';
  settlements?: Settlement[];
  history?: RoundHistory[];
  activeRound?: Round;
  lastActivityTime: number;
  pauseStartTime?: number;
}

export type RoundState = 'WAITING_TO_START' | 'IN_PROGRESS' | 'COMPLETED';

export interface Round {
  id: string;
  state: RoundState;
  pot: number;                // Total chips in pot
  currentTurnId: string | null; // null = locked (transition state)
  turnExpiry?: number;         // Unix timestamp for turn timeout
  minimumBet: number;          // Current minimum bet (escalates on Raise)
  winnerIds: string[];
  winReason?: string;          // e.g., 'Trail', 'Pure Sequence'
  deck: Card[];                // Remaining deck (hidden from clients)
  actionLog: string[];         // Chronological action history
  pendingSideShow?: { requesterId: string; targetId: string };
  resolvingSideShow?: { requesterId: string; targetId: string };
}

export interface Settlement {
  fromId: string;   // Debtor player ID
  toId: string;     // Creditor player ID
  amount: number;   // Amount to be paid
}

export interface SessionReceiptPlayer {
  id: string;
  name: string;
  invested: number;
  wallet: number;
}

export interface SessionReceipt {
  id: string;           // Unique receipt ID
  roomId: string;
  date: number;         // Unix timestamp
  hostId: string;
  players: Record<string, SessionReceiptPlayer>;
  settlements: Settlement[];
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}
