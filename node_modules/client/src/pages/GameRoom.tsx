import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Settings, LogOut, Wallet, History, ChevronUp, UserPlus, Menu, Gamepad2, Users, Trophy, Volume2, Smile } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

// Desktop: Horizontal Pill (aspect-[2.4/1])
const getDesktopPlayerPosition = (index: number) => {
  const positions = [
    { x: 50, y: 0 },   // 0: Top Center (Rahul)
    { x: 82, y: 8 },   // 1: Top Right (Amit)
    { x: 97, y: 35 },  // 2: Right Top (Priya)
    { x: 97, y: 65 },  // 3: Right Bottom (Karan)
    { x: 82, y: 92 },  // 4: Bottom Right (Neha)
    { x: 50, y: 100 }, // 5: Bottom Center (You)
    { x: 18, y: 92 },  // 6: Bottom Left (Pooja)
    { x: 3,  y: 65 },  // 7: Left Bottom (Arjun)
    { x: 3,  y: 35 },  // 8: Left Top (Sneha)
    { x: 18, y: 8 },   // 9: Top Left (Vikram)
  ];
  return positions[index % 10];
};

// Mobile: Vertical Pill (aspect-[4/5])
const getMobilePlayerPosition = (index: number) => {
  const positions = [
    { x: 50, y: 0 },   // 0: Top Center
    { x: 90, y: 15 },  // 1: Top Right
    { x: 100, y: 40 }, // 2: Right Top
    { x: 100, y: 65 }, // 3: Right Bottom
    { x: 85, y: 90 },  // 4: Bottom Right
    { x: 50, y: 100 }, // 5: Bottom Center
    { x: 15, y: 90 },  // 6: Bottom Left
    { x: 0,  y: 65 },  // 7: Left Bottom
    { x: 0,  y: 40 },  // 8: Left Top
    { x: 10, y: 15 },  // 9: Top Left
  ];
  return positions[index % 10];
};

const getSuitSymbol = (suit: string) => {
  switch (suit) {
    case 'Spades': return '♠';
    case 'Hearts': return '♥';
    case 'Clubs': return '♣';
    case 'Diamonds': return '♦';
    default: return suit;
  }
};

const getSuitColor = (suit: string) => {
  return suit === 'Hearts' || suit === 'Diamonds' ? 'text-red-600' : 'text-black';
};

const EMOJIS = ['😀', '😂', '😎', '😍', '😭', '😡', '👍', '👎', '👏', '🥳', '🔥', '💯', '💸', '🤑', '🤔', '🤐', '🙏', '😈', '♠️', '♥️', '♦️', '♣️'];

import { useGameStore } from '../store/gameStore';

export default function GameRoom() {
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [showStartModal, setShowStartModal] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [playersOpen, setPlayersOpen] = useState(false);
  const [showAddFundsModal, setShowAddFundsModal] = useState(false);
  const [fundAmount, setFundAmount] = useState('1000');
  const [fundError, setFundError] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  
  const { players, table, myPlayerId, roomId, playerName, playerAvatar, socket, initSocket, joinRoom, placeBet, pack, seeCards, requestSideShow, disconnectMsg, logout, startGame, showCards, resolvingSideShow, winnerData, chatMessages, sendChatMessage, history, kickPlayer, transferHost, pendingRebuys, requestRebuy, approveRebuy, declineRebuy, sideShowRequest, acceptSideShow, declineSideShow, settlements, playerOrder } = useGameStore();
  const myPlayer = players.find(p => p.id === myPlayerId);
  const myPlayerIndex = players.findIndex(p => p.id === myPlayerId);
  const isMyTurn = myPlayer?.isActive;

  const isPreviousPlayerSeen = useMemo(() => {
    if (!playerOrder || playerOrder.length === 0 || !myPlayerId) return false;
    const currentIndex = playerOrder.indexOf(myPlayerId);
    if (currentIndex === -1) return false;
    
    for (let i = 1; i < playerOrder.length; i++) {
      let prevIndex = currentIndex - i;
      if (prevIndex < 0) prevIndex += playerOrder.length;
      const pid = playerOrder[prevIndex];
      const prevPlayer = players.find(p => p.id === pid);
      if (prevPlayer && prevPlayer.state === 'PLAYING') {
        return !!prevPlayer.hasSeen;
      }
    }
    return false;
  }, [playerOrder, players, myPlayerId]);
  const navigate = useNavigate();
  
  const [raiseSteps, setRaiseSteps] = useState(1);

  // Auto-reconnect on refresh
  useEffect(() => {
    if (roomId && myPlayerId && !socket) {
      initSocket();
      joinRoom(playerName, playerAvatar, 'JOIN').catch(() => {
        // If it fails (e.g. room died), they will get disconnectMsg and UI will boot them
      });
    }
  }, [roomId, myPlayerId, socket, initSocket, joinRoom, playerName, playerAvatar]);

  // Reset raise steps and play audio notification when turn changes
  useEffect(() => {
    if (isMyTurn) {
      setRaiseSteps(1);
      
      // Play subtle turn notification sound
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
        oscillator.frequency.exponentialRampToValueAtTime(1760, audioCtx.currentTime + 0.1); // A6
        
        gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.3);
      } catch(e) {
        console.error('Turn audio notification failed', e);
      }
    }
  }, [isMyTurn]);

  // Track unread messages for mobile UI using derived state
  const [lastReadCount, setLastReadCount] = useState(0);

  useEffect(() => {
    if (chatOpen) {
      setLastReadCount(chatMessages.length);
    }
  }, [chatOpen, chatMessages.length]);

  const unreadCount = chatOpen ? 0 : Math.max(0, chatMessages.length - lastReadCount);

  // Delayed start modal for completed state
  useEffect(() => {
    if (table.gameState === 'COMPLETED') {
      const timer = setTimeout(() => setShowStartModal(true), 4000);
      return () => clearTimeout(timer);
    } else if (table.gameState === 'WAITING') {
      setShowStartModal(true);
    } else {
      setShowStartModal(false);
    }
  }, [table.gameState]);

  // Toast Notifications for game history
  const [toasts, setToasts] = useState<{id: number, message: string}[]>([]);
  const prevHistoryLen = useRef(history.length);
  useEffect(() => {
    if (history.length > prevHistoryLen.current) {
      const newItems = history.slice(prevHistoryLen.current);
      newItems.forEach((item, idx) => {
        const id = Date.now() + idx;
        let msg = item.message;
        if (!msg) {
          if (item.winReason) {
            msg = `Round ${item.roundNumber} ended: ${item.winReason}`;
          } else {
            msg = '';
          }
        }
        if (!msg) return;
        setToasts(prev => [...prev, { id, message: msg }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
      });
      prevHistoryLen.current = history.length;
    }
  }, [history]);

  const activePlayersCount = players.filter(p => p.state !== 'OUT' && p.state !== 'PACKED').length;
  
  const baseBetAmount = myPlayer?.hasSeen ? table.chaalAmount * 2 : table.chaalAmount;

  const handleStartGameClick = () => {
    if (players.length < 2) {
      setStartError('Waiting for more players to join...');
      setTimeout(() => setStartError(null), 3000);
      return;
    }
    startGame();
  };

  const raiseStepSize = myPlayer?.hasSeen ? table.bootAmount * 2 : table.bootAmount;
  const raiseAmount = baseBetAmount + (raiseSteps * raiseStepSize);

  const mySeat = myPlayer ? myPlayer.seat : 5;
  const getRelativeSeat = (seat: number) => (seat - mySeat + 5 + 10) % 10;

  const handleLogout = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Exit Room',
      message: 'Are you sure you want to exit the room? You will have to rejoin manually.',
      confirmText: 'LOGOUT',
      isDanger: true,
      onConfirm: () => {
        logout();
        navigate('/');
      }
    });
  };

  const handleSendMessage = () => {
    if (chatMessage.trim()) {
      sendChatMessage(chatMessage);
      setChatMessage('');
    }
  };

  return (
    <div className="flex flex-row h-full w-full bg-[#111116] relative overflow-hidden">
      
      {/* Toast Notifications */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[300] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.9 }}
              className="bg-black/80 backdrop-blur-md text-white border border-yellow-600/50 px-4 py-2 rounded-full shadow-[0_0_15px_rgba(202,138,4,0.3)] text-xs md:text-sm font-bold text-center pointer-events-auto"
            >
              {toast.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Disconnect / Kick Overlay */}
      {disconnectMsg && (
        <div className="absolute inset-0 bg-black/90 z-[200] flex flex-col items-center justify-center p-6">
          <div className="bg-red-950/50 border border-red-900 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
            <h2 className="text-2xl font-black text-red-500 mb-4 uppercase tracking-widest">Room Closed</h2>
            <p className="text-red-200 mb-8 font-medium">{disconnectMsg}</p>
            <button 
              onClick={() => navigate('/')}
              className="w-full bg-gradient-to-b from-red-600 to-red-800 text-white font-bold py-3 rounded-lg hover:brightness-110"
            >
              Return to Lobby
            </button>
          </div>
        </div>
      )}

      {/* DESKTOP LEFT SIDEBAR */}
      <div className="hidden md:flex w-[240px] bg-[#0b0b0f] border-r border-[#2a2c36] flex-col h-full z-50 flex-shrink-0">
        {/* Logo Area */}
        <div className="p-6 border-b border-[#2a2c36] flex flex-col items-center justify-center">
          <span className="text-3xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-600 drop-shadow-lg text-center leading-tight">
            3 PATTI
          </span>
          <span className="text-[9px] bg-red-900 text-red-200 font-bold uppercase tracking-widest px-2 py-0.5 rounded-sm mt-1">Play with friends</span>
        </div>
        
        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto py-4 flex flex-col gap-1 px-3">
          <button className="flex items-center space-x-3 px-4 py-3 bg-yellow-600/10 text-yellow-500 rounded-lg font-bold border border-yellow-600/30 transition-all">
            <Gamepad2 className="w-5 h-5" />
            <span>GAME TABLE</span>
          </button>
          
          <button className="flex items-center space-x-3 px-4 py-3 text-gray-400 hover:bg-[#1a1d24] hover:text-white rounded-lg font-bold transition-all" onClick={() => setPlayersOpen(true)}>
            <Users className="w-5 h-5" />
            <span>PLAYERS</span>
          </button>
          
          <button className="flex items-center space-x-3 px-4 py-3 text-gray-400 hover:bg-[#1a1d24] hover:text-white rounded-lg font-bold transition-all" onClick={() => setHistoryOpen(true)}>
            <History className="w-5 h-5" />
            <span>HISTORY</span>
          </button>
          
          <button className="flex items-center space-x-3 px-4 py-3 text-gray-400 hover:bg-[#1a1d24] hover:text-white rounded-lg font-bold transition-all" onClick={() => setLeaderboardOpen(true)}>
            <Trophy className="w-5 h-5" />
            <span>LEADERBOARD</span>
          </button>
          
          <button className="flex items-center space-x-3 px-4 py-3 text-gray-400 hover:bg-[#1a1d24] hover:text-white rounded-lg font-bold transition-all" onClick={() => setShowAddFundsModal(true)}>
            <Wallet className="w-5 h-5" />
            <span>WALLET</span>
          </button>
          
          <button className="hidden items-center space-x-3 px-4 py-3 text-gray-400 hover:bg-[#1a1d24] hover:text-white rounded-lg font-bold transition-all">
            <Settings className="w-5 h-5" />
            <span>SETTINGS</span>
          </button>
          
          <button className="flex items-center space-x-3 px-4 py-3 text-gray-400 hover:bg-red-900/20 hover:text-red-400 rounded-lg font-bold transition-all mt-auto" onClick={handleLogout}>
            <LogOut className="w-5 h-5" />
            <span>LOGOUT</span>
          </button>
        </div>
        
        {/* Wallet Balance Card */}
        <div className="p-4 border-t border-[#2a2c36] bg-[#0d0f14]">
          <div className="bg-[#13151b] border border-[#2a2c36] rounded-xl p-4 flex flex-col">
            <div className="flex justify-between items-center mb-1">
              <span className="text-gray-500 text-xs font-bold uppercase">Wallet Balance</span>
              {pendingRebuys && pendingRebuys.some(r => r.playerId === myPlayerId) && (
                <span className="text-red-400 text-[9px] font-bold animate-pulse">PENDING APPROVAL</span>
              )}
            </div>
            <div className="flex items-center text-yellow-500 text-2xl font-black mb-1">
              <Wallet className="w-5 h-5 mr-2" />
              ₹{myPlayer?.wallet ?? 0}
            </div>
            {pendingRebuys && pendingRebuys.find(r => r.playerId === myPlayerId) && (
              <span className="text-gray-400 text-[10px] mb-3">Pending: +₹{pendingRebuys.find(r => r.playerId === myPlayerId)?.amount}</span>
            )}
            {!pendingRebuys?.some(r => r.playerId === myPlayerId) && <div className="h-4" />}
            <button className="w-full bg-green-700 hover:bg-green-600 border border-green-500 text-white font-bold py-2 rounded-lg flex items-center justify-center transition-colors text-sm" onClick={() => setShowAddFundsModal(true)}>
              + ADD FUNDS
            </button>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col h-full relative overflow-hidden">
        {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between p-4 bg-[#13151b] border-b border-[#2a2c36] relative z-50">
        <button onClick={() => setMenuOpen(true)} className="p-1 hover:bg-[#2a2c36] rounded-md transition-colors">
          <Menu className="text-gray-400" />
        </button>
        <div className="flex flex-col items-center">
          <span className="text-xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-600">
            3 PATTI
          </span>
          <span className="text-[8px] text-red-500 font-bold uppercase tracking-widest">Play with friends</span>
        </div>
        <UserPlus className="text-gray-400" />
      </div>

      {/* Header Info Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between bg-[#111116] md:bg-transparent border-b border-[#2a2c36] md:border-none p-0 md:p-4 z-50">
        
        {/* Mobile Info Grid / Desktop Info Row */}
        <div className="w-full md:w-auto grid grid-cols-4 md:flex text-[10px] md:text-sm font-medium divide-x divide-[#2a2c36] md:border md:border-[#2a2c36] md:rounded-sm">
          <div className="flex flex-col items-center md:items-start py-2 md:py-0 px-1 md:pr-6">
            <span className="text-gray-500">Table ID</span>
            <span className="text-white font-bold">#TP7852</span>
          </div>
          <div className="flex flex-col items-center md:items-start py-2 md:py-0 px-1 md:px-6">
            <span className="text-gray-500 md:text-gray-400">Boot Amount</span>
            <span className="text-white font-bold">₹5</span>
          </div>
          <div className="flex flex-col items-center md:items-start py-2 md:py-0 px-1 md:px-6">
            <span className="text-gray-500 md:text-gray-400">Chaal Amount</span>
            <span className="text-white font-bold">₹10</span>
          </div>
          <div className="flex flex-col items-center md:items-start py-2 md:py-0 px-1 md:pl-6">
            <span className="text-gray-500 md:text-gray-400">Round</span>
            <span className="text-white font-bold">{table.currentRound}</span>
          </div>
        </div>

        {/* Desktop Top Right Icons */}
        <div className="hidden md:flex items-center space-x-3">
          <button className="w-10 h-10 bg-[#13151b] border border-[#2a2c36] rounded-lg flex items-center justify-center hover:bg-[#1a1d24] transition-colors group" title="Volume">
            <Volume2 size={20} className="text-gray-400 group-hover:text-white"/>
          </button>
          <button className="hidden w-10 h-10 bg-[#13151b] border border-[#2a2c36] rounded-lg items-center justify-center hover:bg-[#1a1d24] transition-colors group" title="Settings">
            <Settings size={20} className="text-gray-400 group-hover:text-white"/>
          </button>
          <button className="bg-purple-900/30 hover:bg-purple-900/50 border border-purple-500/50 text-purple-400 hover:text-purple-300 font-bold px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors">
            <UserPlus size={16} />
            <span>INVITE</span>
          </button>
        </div>
      </div>

      {/* Main Game Area (Table + Bottom UI) */}
      <div className="flex-1 relative w-full overflow-visible md:overflow-hidden block">
        
        {/* TOP PORTION: The Poker Table (Background Layer) */}
        <div className="absolute top-2 left-0 right-0 bottom-[35%] [@media(max-height:750px)]:bottom-[40%] md:bottom-0 md:inset-0 flex items-center justify-center p-2 md:p-6 md:pb-[10vh] z-0">
          {/* Table Container - Pill Shape (Vertical on Mobile, Horizontal on Desktop) */}
          <div className="relative w-[min(92%,45.45vh)] md:w-[min(95%,132vh)] aspect-table bg-gradient-to-b from-[#1b4321] to-[#0a230f] rounded-[120px] md:rounded-full border-[4px] md:border-[8px] border-[#6b4724] shadow-[0_0_30px_rgba(0,0,0,0.5),inset_0_0_20px_rgba(0,0,0,0.8)] before:content-[''] before:absolute before:inset-0 before:border-[2px] md:before:border-[3px] before:border-[#d6a541]/30 before:rounded-[116px] md:before:rounded-full before:m-1 md:before:m-2 mx-auto shrink-0">
            
            {/* Pot Area */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-10">
              {/* Chips Graphic Placeholder */}
              <div className="relative w-12 h-10 md:w-16 md:h-12 mb-1 md:mb-2">
                <div className="absolute bottom-0 left-2 w-4 h-4 md:w-6 md:h-6 bg-red-600 rounded-full border border-red-800 shadow-md"></div>
                <div className="absolute bottom-1 right-2 w-4 h-4 md:w-6 md:h-6 bg-blue-600 rounded-full border border-blue-800 shadow-md"></div>
                <div className="absolute bottom-3 left-4 w-4 h-4 md:w-6 md:h-6 bg-green-600 rounded-full border border-green-800 shadow-md"></div>
                <div className="absolute bottom-4 right-4 w-4 h-4 md:w-6 md:h-6 bg-white rounded-full border border-gray-300 shadow-md"></div>
              </div>
              <span className="text-gray-300 text-[8px] md:text-xs uppercase font-bold tracking-widest">Pot Amount</span>
              <span className="text-yellow-400 text-xl md:text-4xl font-black">₹{table.potAmount}</span>
              <div className="mt-1 md:mt-2 bg-green-900/80 text-green-400 px-2 py-0.5 md:px-4 md:py-1 rounded-full text-[10px] md:text-xs font-bold border border-green-700 uppercase">
                Game Status
                <div className="text-center text-white">
                  {table.gameState === 'WAITING' ? 'Waiting to Start' : 
                   table.gameState === 'COMPLETED' ? 'Round Over' : 
                   isMyTurn ? 'Your Turn' : 'Waiting for Turn'}
                </div>
              </div>
              
              {/* Side Show Notification */}
              {resolvingSideShow && (
                <div className="mt-2 bg-blue-900/80 text-blue-200 px-3 py-1 rounded-lg text-[10px] md:text-xs font-bold border border-blue-500 shadow-lg shadow-blue-900/50 text-center max-w-[200px]">
                  Side Show in progress between {players.find(p => p.id === resolvingSideShow.requesterId)?.name} and {players.find(p => p.id === resolvingSideShow.targetId)?.name}...
                </div>
              )}
            </div>

            {/* Players Mapping */}
            {players.map((player, pIdx) => {
              const relSeat = getRelativeSeat(player.seat);
              const mobilePos = getMobilePlayerPosition(relSeat);
              const desktopPos = getDesktopPlayerPosition(relSeat);
              const isRightSide = mobilePos.x >= 50;
              
              return (
              <div 
                key={player.id} 
                className={cn(
                  "absolute flex flex-col items-center transition-all duration-300",
                  "left-[var(--x-mobile)] top-[var(--y-mobile)] md:left-[var(--x-desktop)] md:top-[var(--y-desktop)]",
                  "-translate-x-1/2 -translate-y-1/2",
                  player.isActive && "scale-110 z-20"
                )}
                style={{
                  '--x-mobile': `${mobilePos.x}%`,
                  '--y-mobile': `${mobilePos.y}%`,
                  '--x-desktop': `${desktopPos.x}%`,
                  '--y-desktop': `${desktopPos.y}%`,
                } as React.CSSProperties}
              >
                <div className="relative">
                  {/* Winner Badge */}
                  {winnerData && winnerData.winnerIds.includes(player.id) && (
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gradient-to-r from-yellow-500 to-yellow-700 text-white px-2 py-0.5 rounded text-[8px] md:text-[10px] font-black uppercase whitespace-nowrap shadow-[0_0_15px_rgba(234,179,8,0.8)] border border-yellow-300 z-50">
                      Winner: {winnerData.winReason}
                    </div>
                  )}

                  {/* Avatar Ring & Timer */}
                  <div className="relative w-10 h-10 md:w-16 md:h-16">
                    {/* Pulsing Glow if active */}
                    {player.isActive && (
                      <motion.div 
                        className="absolute -inset-1 md:-inset-1.5 rounded-full border-2 border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.8)] z-0"
                        animate={{ scale: [1, 1.15, 1], opacity: [0.5, 1, 0.5] }}
                        transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                      />
                    )}
                    
                    {/* The Avatar */}
                    <div className={cn(
                      "absolute inset-0 rounded-full border-[2px] md:border-[3px] shadow-lg flex items-center justify-center overflow-hidden bg-[#2a2c36] z-10",
                      player.isActive ? "border-green-400" : "border-yellow-600",
                      player.state === 'PACKED' || player.state === 'OUT' ? "opacity-30 grayscale" : ""
                    )}>
                      <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${player.avatar || player.name}`} alt={player.name} className="w-full h-full object-cover" />
                    </div>
                  </div>
                  
                  {/* Dealer Button */}
                  {player.isDealer && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 md:w-5 md:h-5 bg-yellow-500 rounded-full flex items-center justify-center text-black font-bold text-[8px] md:text-[10px] border border-yellow-700 shadow-sm">
                      D
                    </div>
                  )}

                  {/* Seat Number */}
                  <div className="absolute top-1 -right-3 md:-right-4 w-3 h-3 md:w-4 md:h-4 bg-[#13151b] rounded-full flex items-center justify-center text-gray-400 text-[7px] md:text-[9px] border border-[#2a2c36]">
                    {player.seat + 1}
                  </div>
                  
                  {/* Cards for other players */}
                  {!player.isMe && table.gameState !== 'WAITING' && player.state !== 'OUT' && player.state !== 'PACKED' && (
                    <div className={cn(
                      "absolute -bottom-2 flex space-x-[-4px] md:space-x-[-6px] z-30",
                      isRightSide ? "-left-14 md:-left-20" : "-right-14 md:-right-20"
                    )}>
                      {player.cards && player.cards.length === 3 ? (
                        <AnimatePresence mode="popLayout">
                          {[0, 1, 2].map((i) => (
                            <motion.div 
                              key={`card-front-other-${i}`}
                              initial={{ rotateY: 90, scale: 0.8 }}
                              animate={{ rotateY: 0, scale: 1 }}
                              transition={{ duration: 0.4, delay: i * 0.1, type: "spring", bounce: 0.4 }}
                              className={cn(
                                "w-6 h-9 md:w-8 md:h-12 bg-white rounded shadow-md border border-gray-300 flex flex-col items-center py-0.5 md:py-1",
                                i === 0 ? "rotate-[-10deg] z-10" : i === 1 ? "z-20" : "rotate-[10deg] z-30"
                              )}
                            >
                              <span className={cn("text-[7px] md:text-[10px] font-bold leading-none px-1 self-start", getSuitColor(player.cards[i].suit))}>{player.cards[i].rank}</span>
                              <span className={cn("text-[8px] md:text-[12px] leading-none mt-0.5 md:mt-1", getSuitColor(player.cards[i].suit))}>{getSuitSymbol(player.cards[i].suit)}</span>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      ) : (
                        <AnimatePresence mode="popLayout">
                          {[0, 1, 2].map((i) => {
                            const relSeat = getRelativeSeat(player.seat);
                            const pos = getDesktopPlayerPosition(relSeat);
                            const startX = (50 - pos.x) * 8;
                            const startY = (50 - pos.y) * 6;
                            
                            return (
                              <motion.div 
                                key={`card-back-other-${i}`}
                                initial={{ y: startY, x: startX, opacity: 0, scale: 0.2 }}
                                animate={{ y: 0, x: 0, opacity: 1, scale: 1 }}
                                transition={{ 
                                  duration: 0.5, 
                                  delay: (i * players.length * 0.15) + (pIdx * 0.15),
                                  type: "spring",
                                  bounce: 0.3
                                }}
                                className={cn(
                                  "w-6 h-9 md:w-8 md:h-12 bg-red-800 rounded shadow-md border border-white/20",
                                  i === 0 ? "rotate-[-10deg] z-10" : i === 1 ? "z-20" : "rotate-[10deg] z-30"
                                )}
                              />
                            );
                          })}
                        </AnimatePresence>
                      )}
                    </div>
                  )}
                  
                  {/* Seen Eye Icon */}
                  {player.hasSeen && (
                    <div className="absolute top-3 -right-4 md:top-4 md:-right-6 text-green-500 bg-black/50 rounded-full p-0.5">
                      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="md:w-3 md:h-3"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                    </div>
                  )}
                </div>

                {/* Player Info Badge */}
                <div className="mt-1 md:mt-2 flex flex-col items-center bg-black/70 px-1.5 py-0.5 rounded-lg border border-white/10">
                  <span className="text-[8px] md:text-xs text-white font-medium truncate max-w-[50px] md:max-w-[60px]">{player.name}</span>
                  {player.state === 'PACKED' ? (
                    <span className="text-[8px] md:text-[10px] bg-red-700/80 text-red-100 px-1.5 rounded-sm font-bold border border-red-500 mt-0.5">PACK</span>
                  ) : player.isMe ? (
                    <span className="text-[8px] md:text-xs text-yellow-500 font-bold">₹{player.wallet}</span>
                  ) : (
                    player.hasSeen ? (
                      <span className="text-[8px] md:text-[10px] bg-green-700/80 text-green-100 px-1.5 rounded-sm font-bold border border-green-500 mt-0.5">SEEN</span>
                    ) : (
                      <span className="text-[8px] md:text-[10px] text-gray-400 font-bold mt-0.5">BLIND</span>
                    )
                  )}
                </div>
              </div>
            )})}

            </div>

        </div>

        {/* BOTTOM PORTION: My Cards & Action Buttons (Absolute Foreground Layer) */}
        <div className="absolute bottom-0 left-0 right-0 z-40 bg-gradient-to-t from-black via-black/90 to-transparent pt-24 pb-2 md:pb-4 px-2 md:px-6 pointer-events-none flex flex-col items-center">
          
          {/* My Cards & SEE button Wrapper */}
          <div className="relative w-full max-w-4xl mx-auto flex items-center justify-center mb-2 [@media(max-height:750px)]:mb-0 md:mb-4 pointer-events-auto z-50">
            {/* My Cards (Centered) */}
            <div className="relative flex justify-center items-end space-x-1 md:space-x-2">
              {table.gameState !== 'WAITING' && myPlayer && myPlayer.state !== 'OUT' && myPlayer.state !== 'PACKED' && (
                <AnimatePresence mode="popLayout">
                  {myPlayer.cards.length === 3 ? (
                    [0, 1, 2].map((i) => (
                      <motion.div 
                        key={`card-front-${i}`}
                        initial={{ rotateY: 90, scale: 0.8 }}
                        animate={{ rotateY: 0, scale: 1 }}
                        transition={{ duration: 0.4, delay: i * 0.1, type: "spring", bounce: 0.4 }}
                        className={cn(
                          "w-9 h-12 [@media(max-height:750px)]:w-7 [@media(max-height:750px)]:h-10 md:w-14 md:h-20 bg-white rounded-lg shadow-xl border border-gray-300 flex flex-col items-center py-0.5 md:py-1.5 hover:rotate-0 hover:-translate-y-2 transition-transform",
                          i === 0 ? "rotate-[-6deg] z-10" : i === 1 ? "z-20" : "rotate-[6deg] z-30"
                        )}
                      >
                        <span className={cn("font-bold text-[10px] [@media(max-height:750px)]:text-[8px] md:text-sm self-start px-1 md:px-2", getSuitColor(myPlayer.cards[i].suit))}>{myPlayer.cards[i].rank}</span>
                        <span className={cn("text-xs md:text-xl mt-0.5 md:mt-1", getSuitColor(myPlayer.cards[i].suit))}>{getSuitSymbol(myPlayer.cards[i].suit)}</span>
                      </motion.div>
                    ))
                  ) : (
                    [0, 1, 2].map((i) => (
                      <motion.div 
                        key={`card-back-${i}`}
                        initial={{ y: -300, opacity: 0, scale: 0.3 }}
                        animate={{ y: 0, opacity: 1, scale: 1 }}
                        exit={{ rotateY: 90, scale: 0.8 }}
                        transition={{ 
                          duration: 0.5, 
                          delay: (i * players.length * 0.15) + ((myPlayerIndex >= 0 ? myPlayerIndex : 0) * 0.15),
                          type: "spring",
                          bounce: 0.4
                        }}
                        className={cn(
                          "w-9 h-12 [@media(max-height:750px)]:w-7 [@media(max-height:750px)]:h-10 md:w-14 md:h-20 bg-red-800 rounded-lg shadow-xl border border-white/20 hover:rotate-0 hover:-translate-y-2 transition-transform",
                          i === 0 ? "rotate-[-6deg] z-10" : i === 1 ? "z-20" : "rotate-[6deg] z-30"
                        )}
                      />
                    ))
                  )}
                </AnimatePresence>
              )}
            </div>

            {table.gameState !== 'WAITING' && myPlayer && myPlayer.state !== 'OUT' && myPlayer.state !== 'PACKED' && !myPlayer.hasSeen && (
              <button onClick={() => seeCards(myPlayerId)} className="absolute right-0 md:right-4 top-1/2 -translate-y-1/2 bg-[#13151b]/90 border border-gray-500 py-1.5 px-3 md:w-auto md:h-auto md:px-6 md:py-2 rounded-md text-[8px] md:text-sm font-bold flex flex-row items-center justify-center hover:bg-black transition-colors z-40 shadow-lg">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 md:w-5 md:h-5 mr-1 md:mr-2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                <span className="leading-tight text-center whitespace-nowrap">SEE CARDS</span>
              </button>
            )}
          </div>

          {/* MOBILE Action Buttons (Grid) */}
          <div className="md:hidden w-full grid grid-cols-2 gap-1.5 [@media(max-height:750px)]:gap-1 mt-1 pointer-events-auto">
            {!myPlayer?.hasSeen && (
              <button 
                onClick={() => isMyTurn && placeBet(myPlayerId, 'BLIND', table.chaalAmount)}
                disabled={!isMyTurn}
                className={cn(
                  "font-extrabold py-1.5 [@media(max-height:750px)]:py-1 rounded shadow-lg flex flex-col items-center transition-all",
                  isMyTurn ? "bg-gradient-to-b from-yellow-700 to-yellow-900 hover:brightness-110 text-white border border-yellow-600/50" : "bg-gray-800 text-gray-500 border border-gray-700 opacity-50"
                )}
              >
                <span className="text-[9px] [@media(max-height:750px)]:text-[8px] tracking-wider">BLIND</span>
                <span className="text-[11px] [@media(max-height:750px)]:text-[10px]">₹{table.chaalAmount}</span>
              </button>
            )}
            
            {myPlayer?.hasSeen && (
              <button 
                onClick={() => isMyTurn && placeBet(myPlayerId, 'CHAAL', table.chaalAmount * 2)}
                disabled={!isMyTurn}
                className={cn(
                  "font-extrabold py-1.5 [@media(max-height:750px)]:py-1 rounded shadow-lg flex flex-col items-center transition-all",
                  isMyTurn ? "bg-gradient-to-b from-green-700 to-green-900 hover:brightness-110 text-white border border-green-600/50" : "bg-gray-800 text-gray-500 border border-gray-700 opacity-50"
                )}
              >
                <span className="text-[9px] [@media(max-height:750px)]:text-[8px] tracking-wider">CHAAL</span>
                <span className="text-[11px] [@media(max-height:750px)]:text-[10px]">₹{table.chaalAmount * 2}</span>
              </button>
            )}
            
            <div className="bg-[#1a1c23] border border-[#2a2c36] rounded flex flex-col justify-center items-center px-2 py-1 [@media(max-height:750px)]:py-0.5">
              <span className="text-[8px] [@media(max-height:750px)]:text-[7px] text-gray-400 uppercase tracking-widest mb-0.5 [@media(max-height:750px)]:mb-0">RAISE TO</span>
              <div className="flex items-center space-x-1 w-full max-w-[160px]">
                <button 
                  onClick={() => setRaiseSteps(s => Math.max(1, s - 1))}
                  disabled={!isMyTurn}
                  className="w-5 h-5 [@media(max-height:750px)]:h-4 [@media(max-height:750px)]:w-4 rounded bg-[#2a2c36] hover:bg-[#3f4252] flex items-center justify-center font-bold text-xs disabled:opacity-50"
                >-</button>
                <button 
                  onClick={() => isMyTurn && placeBet(myPlayerId, myPlayer?.hasSeen ? 'CHAAL' : 'BLIND', raiseAmount)}
                  disabled={!isMyTurn}
                  className="flex-1 bg-white hover:bg-gray-200 text-black font-extrabold text-center py-0.5 [@media(max-height:750px)]:py-0 rounded text-[11px] [@media(max-height:750px)]:text-[10px] disabled:opacity-50"
                >
                  ₹{raiseAmount}
                </button>
                <button 
                  onClick={() => setRaiseSteps(s => s + 1)}
                  disabled={!isMyTurn}
                  className="w-5 h-5 [@media(max-height:750px)]:h-4 [@media(max-height:750px)]:w-4 rounded bg-[#2a2c36] hover:bg-[#3f4252] flex items-center justify-center font-bold text-xs disabled:opacity-50"
                >+</button>
              </div>
              <span className="text-[7px] [@media(max-height:750px)]:text-[6px] text-gray-500 mt-0.5 [@media(max-height:750px)]:mt-0">Step: ₹{raiseStepSize}</span>
            </div>

            <div className="col-span-2 flex gap-1.5">
              <button 
                onClick={() => isMyTurn && activePlayersCount > 2 && requestSideShow(myPlayerId, '')}
                disabled={!isMyTurn || activePlayersCount <= 2 || !myPlayer?.hasSeen || !isPreviousPlayerSeen}
                className={cn(
                  "flex-1 font-extrabold py-2 [@media(max-height:750px)]:py-1 rounded shadow-lg text-[9px] [@media(max-height:750px)]:text-[8px] tracking-wider transition-all",
                  isMyTurn && activePlayersCount > 2 ? "bg-gradient-to-b from-blue-800 to-blue-950 hover:brightness-110 text-blue-200 border border-blue-700/50" : "bg-gray-800 text-gray-500 border border-gray-700 opacity-50 cursor-not-allowed"
                )}
              >
                SIDE SHOW
              </button>
              
              <button 
                onClick={() => isMyTurn && activePlayersCount === 2 && showCards()}
                disabled={!isMyTurn || activePlayersCount !== 2}
                className={cn(
                  "flex-1 font-extrabold py-2 [@media(max-height:750px)]:py-1 rounded shadow-lg text-[9px] [@media(max-height:750px)]:text-[8px] tracking-wider transition-all flex flex-col items-center justify-center gap-0.5",
                  isMyTurn && activePlayersCount === 2 ? "bg-gradient-to-b from-purple-800 to-purple-950 hover:brightness-110 text-purple-200 border border-purple-700/50" : "bg-gray-800 text-gray-500 border border-gray-700 opacity-50 cursor-not-allowed"
                )}
              >
                <span>SHOW</span>
                <span className="text-[9px] font-black text-purple-300">₹{baseBetAmount * 2}</span>
              </button>
            </div>
            
            <button 
              onClick={() => isMyTurn && pack(myPlayerId)}
              disabled={!isMyTurn}
              className={cn(
                "col-span-2 font-extrabold py-2 [@media(max-height:750px)]:py-1 rounded shadow-lg text-[9px] [@media(max-height:750px)]:text-[8px] tracking-wider transition-all",
                isMyTurn ? "bg-gradient-to-b from-red-800 to-red-950 hover:brightness-110 text-red-200 border border-red-700/50" : "bg-gray-800 text-gray-500 border border-gray-700 opacity-50"
              )}
            >
              PACK
            </button>
          </div>

          {/* DESKTOP Action Buttons (Flex Row) */}
          <div className="hidden md:flex w-full max-w-[1400px] mx-auto flex-row justify-center items-end gap-3 pointer-events-auto">
            {!myPlayer?.hasSeen && (
              <button 
                onClick={() => isMyTurn && placeBet(myPlayerId, 'BLIND', table.chaalAmount)}
                disabled={!isMyTurn}
                className={cn(
                  "font-extrabold py-2 px-6 rounded-lg shadow-lg flex flex-col items-center min-w-[100px] transition-all",
                  isMyTurn ? "bg-gradient-to-b from-yellow-700 to-yellow-900 hover:brightness-110 text-white border border-yellow-600/50" : "bg-gray-800 text-gray-500 border border-gray-700 opacity-50"
                )}
              >
                <span className="text-[10px] tracking-wider">BLIND</span>
                <span className="text-sm">₹{table.chaalAmount}</span>
              </button>
            )}
            
            {myPlayer?.hasSeen && (
              <button 
                onClick={() => isMyTurn && placeBet(myPlayerId, 'CHAAL', table.chaalAmount * 2)}
                disabled={!isMyTurn}
                className={cn(
                  "font-extrabold py-2 px-6 rounded-lg shadow-lg flex flex-col items-center min-w-[100px] transition-all",
                  isMyTurn ? "bg-gradient-to-b from-green-700 to-green-900 hover:brightness-110 text-white border border-green-600/50" : "bg-gray-800 text-gray-500 border border-gray-700 opacity-50"
                )}
              >
                <span className="text-[10px] tracking-wider">CHAAL</span>
                <span className="text-sm">₹{table.chaalAmount * 2}</span>
              </button>
            )}
            
            <div className="bg-[#1a0f2e] border border-[#2d1b4e] rounded-lg flex flex-col justify-center items-center px-4 py-1.5 min-w-[180px]">
              <span className="text-[9px] text-gray-300 uppercase tracking-widest mb-0.5">RAISE TO</span>
              <div className="flex items-center space-x-2 w-full">
                <button 
                  onClick={() => setRaiseSteps(s => Math.max(1, s - 1))}
                  disabled={!isMyTurn}
                  className="w-6 h-6 rounded bg-[#2a1b42] hover:bg-[#3d2760] border border-[#4d337a] flex items-center justify-center font-bold text-sm disabled:opacity-50"
                >-</button>
                <button 
                  onClick={() => isMyTurn && placeBet(myPlayerId, myPlayer?.hasSeen ? 'CHAAL' : 'BLIND', raiseAmount)}
                  disabled={!isMyTurn}
                  className="flex-1 bg-white hover:bg-gray-200 text-black font-extrabold text-center py-0.5 rounded text-sm disabled:opacity-50 transition-colors"
                >
                  ₹{raiseAmount}
                </button>
                <button 
                  onClick={() => setRaiseSteps(s => s + 1)}
                  disabled={!isMyTurn}
                  className="w-6 h-6 rounded bg-[#2a1b42] hover:bg-[#3d2760] border border-[#4d337a] flex items-center justify-center font-bold text-sm disabled:opacity-50"
                >+</button>
              </div>
              <span className="text-[9px] text-gray-400 mt-0.5">Step: ₹{raiseStepSize}</span>
            </div>

            <button 
              onClick={() => isMyTurn && activePlayersCount > 2 && requestSideShow(myPlayerId, '')}
              disabled={!isMyTurn || activePlayersCount <= 2 || !myPlayer?.hasSeen || !isPreviousPlayerSeen}
              className={cn(
                "font-extrabold py-3 px-8 rounded-lg shadow-lg text-[10px] tracking-wider transition-all",
                isMyTurn && activePlayersCount > 2 ? "bg-gradient-to-b from-blue-800 to-blue-950 hover:brightness-110 text-blue-200 border border-blue-700/50" : "bg-gray-800 text-gray-500 border border-gray-700 opacity-50 cursor-not-allowed"
              )}
            >
              SIDE SHOW
            </button>
            
            <button 
              onClick={() => isMyTurn && activePlayersCount === 2 && showCards()}
              disabled={!isMyTurn || activePlayersCount !== 2}
              className={cn(
                "font-extrabold py-2 px-6 rounded-lg shadow-lg flex flex-col items-center min-w-[100px] transition-all",
                isMyTurn && activePlayersCount === 2 ? "bg-gradient-to-b from-purple-800 to-purple-950 hover:brightness-110 text-purple-200 border border-purple-700/50" : "bg-gray-800 text-gray-500 border border-gray-700 opacity-50 cursor-not-allowed"
              )}
            >
              <span className="text-[10px] tracking-wider">SHOW</span>
              <span className="text-sm">₹{baseBetAmount * 2}</span>
            </button>

            <button 
              onClick={() => isMyTurn && pack(myPlayerId)}
              disabled={!isMyTurn}
              className={cn(
                "font-extrabold py-3 px-8 rounded-lg shadow-lg text-[10px] tracking-wider transition-all",
                isMyTurn ? "bg-gradient-to-b from-red-800 to-red-950 hover:brightness-110 text-red-200 border border-red-700/50" : "bg-gray-800 text-gray-500 border border-gray-700 opacity-50"
              )}
            >
              PACK
            </button>
          </div>
        </div>
      </div>

      {/* Chat Section (Mobile: Collapsible Stack, Desktop: Horizontal Row) */}
      
      {/* MOBILE CHAT UI */}
      <div className={cn(
        "md:hidden bg-[#0b0b0f] border-t border-[#2a2c36] z-50 flex flex-col transition-all duration-300",
        chatOpen ? "h-[300px]" : "h-[40px]"
      )}>
        <div 
          className="flex items-center justify-between px-4 h-[40px] cursor-pointer bg-[#13151b]"
          onClick={() => setChatOpen(!chatOpen)}
        >
          <div className="flex items-center space-x-2 font-bold text-sm relative">
            <span>💬</span> <span>CHAT</span>
            {unreadCount > 0 && !chatOpen && (
              <span className="absolute -top-3 -right-5 bg-red-600 text-white text-[11px] font-black rounded-full h-5 w-5 flex items-center justify-center shadow-lg border-2 border-[#13151b] animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
          <ChevronUp className={cn("transition-transform", chatOpen && "rotate-180")} />
        </div>

        <div className={cn("flex-1 flex flex-col overflow-hidden", !chatOpen && "hidden")}>
          <div className="flex-1 overflow-y-auto px-4 pb-2 space-y-2 text-xs pt-2">
            {chatMessages.map(msg => (
              <div key={msg.id}><span className={cn("font-bold", msg.senderId === myPlayerId ? "text-yellow-500" : "text-pink-500")}>{msg.senderName}:</span> <span className="text-gray-300">{msg.text}</span></div>
            ))}
          </div>
          <div className="p-3 border-t border-[#1c1f28] flex items-center space-x-2 bg-[#111116] relative">
            {showEmojiPicker && (
              <div className="absolute bottom-full left-3 mb-2 bg-[#1a1c23] border border-[#2a2c36] rounded-xl p-3 shadow-2xl z-50 w-64">
                <div className="grid grid-cols-6 gap-2">
                  {EMOJIS.map(emoji => (
                    <button 
                      key={emoji} 
                      onClick={() => { setChatMessage(prev => prev + emoji); setShowEmojiPicker(false); }}
                      className="text-xl hover:bg-[#2a2c36] rounded p-1 transition-colors flex items-center justify-center"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <button 
              className="text-gray-400 hover:text-white p-2"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            >
              <Smile className="w-5 h-5" />
            </button>
            <input 
              type="text" 
              placeholder="Type a message..." 
              className="flex-1 bg-[#13151b] border border-[#2a2c36] rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            />
            <button className="bg-purple-900 hover:bg-purple-800 text-purple-200 px-4 py-2 rounded-lg font-bold text-sm flex items-center justify-center" onClick={handleSendMessage}>
              SEND
            </button>
          </div>
        </div>
      </div>

      {/* DESKTOP CHAT UI (Horizontal Layout) */}
      <div className="hidden md:flex flex-row items-center justify-between px-6 py-3 bg-[#0b0b0f] border-t border-[#2a2c36] z-50 h-[100px]">
        {/* Left Side: Chat Messages */}
        <div className="flex flex-col flex-1 pr-6">
          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">CHAT</div>
          <div className="flex flex-col space-y-1 h-[48px] overflow-y-auto text-xs scrollbar-hide">
            {chatMessages.map(msg => (
              <div key={msg.id}><span className={cn("font-bold", msg.senderId === myPlayerId ? "text-yellow-500" : "text-pink-500")}>{msg.senderName}:</span> <span className="text-gray-300">{msg.text}</span></div>
            ))}
          </div>
        </div>
        
        {/* Right Side: Input Box */}
        <div className="w-[400px] border-l border-[#2a2c36] pl-6 relative">
          {showEmojiPicker && (
            <div className="absolute bottom-full left-6 mb-4 bg-[#1a1c23] border border-[#2a2c36] rounded-xl p-3 shadow-2xl z-50 w-64">
              <div className="grid grid-cols-6 gap-2">
                {EMOJIS.map(emoji => (
                  <button 
                    key={emoji} 
                    onClick={() => { setChatMessage(prev => prev + emoji); setShowEmojiPicker(false); }}
                    className="text-xl hover:bg-[#2a2c36] rounded p-1 transition-colors flex items-center justify-center"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center space-x-2">
            <button 
              className="text-gray-400 hover:text-white p-2"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            >
              <Smile className="w-5 h-5" />
            </button>
            <input 
              type="text" 
              placeholder="Type a message..." 
              className="flex-1 bg-[#13151b] border border-[#2a2c36] rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500"
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            />
            <button className="bg-purple-900 hover:bg-purple-800 text-purple-200 px-6 py-3 rounded-lg font-bold text-sm" onClick={handleSendMessage}>
              SEND
            </button>
          </div>
        </div>
      </div>

      {/* Removed redundant Menu Overlay */}

      {/* Host Start Game Button (Floating) */}
      {(table.gameState === 'WAITING' || table.gameState === 'COMPLETED') && table.hostId === myPlayerId && showStartModal && (
        <div className="absolute inset-0 bg-black/40 z-[45] flex flex-col items-center justify-center p-4">
          <div className="bg-[#1a1c23] border border-yellow-500/30 rounded-xl p-8 max-w-sm w-full shadow-2xl flex flex-col items-center text-center">
            <h2 className="text-2xl font-black text-white mb-2">{table.gameState === 'COMPLETED' ? 'Round Over' : 'Ready to Play?'}</h2>
            <p className="text-gray-400 text-sm mb-4">Start the game once all players have joined the table.</p>
            
            {startError && (
              <div className="bg-red-900/40 border border-red-500 text-red-200 text-sm py-2 px-4 rounded-lg mb-4 w-full animate-bounce">
                {startError}
              </div>
            )}
            
            <button 
              onClick={handleStartGameClick}
              className="w-full bg-gradient-to-b from-green-600 to-green-800 text-white py-4 rounded-xl font-black uppercase tracking-widest hover:brightness-110 shadow-lg shadow-green-900/50"
            >
              {table.gameState === 'COMPLETED' ? 'Start Next Round' : 'Start Game'}
            </button>
          </div>
        </div>
      )}

      {/* Mobile Hamburger Menu Overlay */}
      {menuOpen && (
        <div className="fixed inset-0 z-[200] flex">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/80 backdrop-blur-sm" 
            onClick={() => setMenuOpen(false)}
          />
          {/* Slide-out Panel */}
          <div className="relative w-64 bg-[#13151b] h-full flex flex-col border-r border-[#2a2c36] shadow-2xl animate-in slide-in-from-left duration-200">
            <div className="p-4 border-b border-[#2a2c36] flex justify-between items-center bg-[#0d0e12]">
              <span className="text-yellow-500 font-black tracking-widest text-lg">3 PATTI</span>
              <button onClick={() => setMenuOpen(false)} className="text-gray-400 hover:text-white">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
              <button 
                onClick={() => setMenuOpen(false)}
                className="w-full px-6 py-4 text-left text-yellow-500 bg-yellow-600/10 hover:bg-yellow-600/20 transition-colors flex items-center space-x-3 font-bold"
              >
                <Gamepad2 className="w-5 h-5" />
                <span>Game Table</span>
              </button>
              <button 
                onClick={() => { setMenuOpen(false); setPlayersOpen(true); }}
                className="w-full px-6 py-4 text-left text-gray-300 hover:bg-[#2a2c36] hover:text-white transition-colors flex items-center space-x-3"
              >
                <Users className="w-5 h-5" />
                <span>Players</span>
              </button>
              <button 
                onClick={() => { setMenuOpen(false); setHistoryOpen(true); }}
                className="w-full px-6 py-4 text-left text-gray-300 hover:bg-[#2a2c36] hover:text-white transition-colors flex items-center space-x-3"
              >
                <History className="w-5 h-5" />
                <span>History</span>
              </button>
              <button 
                onClick={() => setMenuOpen(false)}
                className="hidden w-full px-6 py-4 text-left text-gray-300 hover:bg-[#2a2c36] hover:text-white transition-colors items-center space-x-3"
              >
                <Settings className="w-5 h-5" />
                <span>Settings</span>
              </button>
              <button 
                onClick={() => { setMenuOpen(false); setLeaderboardOpen(true); }}
                className="w-full px-6 py-4 text-left text-gray-300 hover:bg-[#2a2c36] hover:text-white transition-colors flex items-center space-x-3"
              >
                <Trophy className="w-5 h-5" />
                <span>Leaderboard</span>
              </button>
              <button 
                onClick={() => { setMenuOpen(false); setShowAddFundsModal(true); }}
                className="w-full px-6 py-4 text-left text-gray-300 hover:bg-[#2a2c36] hover:text-white transition-colors flex items-center space-x-3"
              >
                <Wallet className="w-5 h-5" />
                <span>Wallet</span>
              </button>
              <div className="border-t border-[#2a2c36] mt-2 pt-2">
                <button 
                  onClick={() => { setMenuOpen(false); handleLogout(); }}
                  className="w-full px-6 py-4 text-left text-red-400 hover:bg-[#2a2c36] hover:text-red-300 transition-colors flex items-center space-x-3 font-bold"
                >
                  <LogOut className="w-5 h-5" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
            <div className="p-4 border-t border-[#2a2c36]">
              <button onClick={() => { setMenuOpen(false); setShowAddFundsModal(true); }} className="w-full py-3 rounded-lg bg-green-700 hover:bg-green-600 border border-green-500 text-white font-bold transition-colors flex justify-center items-center">
                <Wallet className="w-5 h-5 mr-2" />
                ADD FUNDS
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard Modal */}
      {leaderboardOpen && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex flex-col items-center justify-center p-4">
          <div className="bg-[#13151b] border border-[#2a2c36] rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-4 border-b border-[#2a2c36] flex justify-between items-center bg-[#0d0e12]">
              <div className="flex items-center space-x-2">
                <Trophy className="text-yellow-500 w-5 h-5" />
                <span className="text-yellow-500 font-black tracking-widest text-lg">SCORECARD</span>
              </div>
              <button onClick={() => setLeaderboardOpen(false)} className="text-gray-400 hover:text-white">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {players.length === 0 ? (
                <div className="text-gray-400 text-sm text-center mb-4">No settlements available yet. Finish the game to see full scores.</div>
              ) : (
                <>
                  <div className="bg-[#1a1c24] rounded-xl p-4 border border-[#2a2c36]">
                    <h3 className="text-sm font-bold text-gray-300 mb-3 uppercase tracking-wider">Player Scores</h3>
                    <div className="overflow-x-auto rounded-lg border border-[#2a2c36]">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#0d0e12] text-gray-400 uppercase">
                          <tr>
                            <th className="px-3 py-2 font-bold">Player</th>
                            <th className="px-3 py-2 font-bold text-right">Invested</th>
                            <th className="px-3 py-2 font-bold text-right">Wallet</th>
                            <th className="px-3 py-2 font-bold text-right">Net P/L</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#2a2c36] bg-[#13151b]">
                          {players.map(p => (
                            <tr key={p.id} className="hover:bg-[#1a1d24] transition-colors">
                              <td className="px-3 py-2">
                                <div className="flex items-center space-x-2">
                                  <img src={p.avatar} alt="avatar" className="w-6 h-6 rounded-full border border-gray-600" />
                                  <span className="text-white font-bold whitespace-nowrap">{p.name} {p.id === myPlayerId ? "(You)" : ""}</span>
                                </div>
                              </td>
                              <td className="px-3 py-2 text-right text-red-400 font-bold">₹{p.invested || 0}</td>
                              <td className="px-3 py-2 text-right text-blue-400 font-bold">₹{p.wallet || 0}</td>
                              <td className={`px-3 py-2 text-right font-bold ${(p.wallet - p.invested) >= 0 ? "text-green-500" : "text-red-500"}`}>
                                ₹{p.wallet - p.invested}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  
                  {settlements?.length > 0 && (
                    <div className="bg-[#1a1c24] rounded-xl p-4 border border-[#2a2c36]">
                      <h3 className="text-sm font-bold text-gray-300 mb-3 uppercase tracking-wider">Settlements</h3>
                      <div className="space-y-2">
                        {settlements.map((s, idx) => {
                          const fromP = players.find(p => p.id === s.fromId)?.name || s.fromId;
                          const toP = players.find(p => p.id === s.toId)?.name || s.toId;
                          return (
                            <div key={idx} className="flex justify-between items-center bg-[#13151b] px-4 py-2 rounded-lg border border-[#2a2c36] text-xs">
                              <span className="text-gray-300"><span className="text-red-400 font-bold">{fromP}</span> owes <span className="text-green-400 font-bold">{toP}</span></span>
                              <span className="text-yellow-500 font-black">₹{s.amount}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            
            <div className="p-4 border-t border-[#2a2c36] bg-[#0b0b0f] flex justify-end">
              <button onClick={() => setLeaderboardOpen(false)} className="px-6 py-2 bg-[#2a2c36] hover:bg-[#343743] rounded-lg text-white font-bold transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* History Modal */}
      {historyOpen && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex flex-col items-center justify-center p-4">
          <div className="bg-[#13151b] border border-[#2a2c36] rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-4 border-b border-[#2a2c36] flex justify-between items-center bg-[#0d0e12]">
              <div className="flex items-center space-x-2">
                <History className="text-blue-400 w-5 h-5" />
                <span className="text-blue-400 font-black tracking-widest text-lg">ROUND HISTORY</span>
              </div>
              <button onClick={() => setHistoryOpen(false)} className="text-gray-400 hover:text-white">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {!history || history.length === 0 ? (
                <div className="text-gray-400 text-sm text-center py-8">No rounds have been completed yet.</div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-[#2a2c36]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#0d0e12] text-gray-400 uppercase">
                      <tr>
                        <th className="px-3 py-2 font-bold">Round</th>
                        <th className="px-3 py-2 font-bold">Winner(s)</th>
                        <th className="px-3 py-2 font-bold text-right">Pot</th>
                        <th className="px-3 py-2 font-bold">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2a2c36] bg-[#13151b]">
                      {history.map((h: any, idx: number) => {
                        const winnerNames = h.winnerIds.map((wid: string) => {
                          const p = players.find(player => player.id === wid);
                          return p ? p.name : wid;
                        }).join(', ');
                        
                        return (
                          <tr key={idx} className="hover:bg-[#1a1d24] transition-colors">
                            <td className="px-3 py-2 font-bold text-gray-300">{h.roundNumber}</td>
                            <td className="px-3 py-2 font-bold text-white whitespace-nowrap">{winnerNames}</td>
                            <td className="px-3 py-2 text-right text-yellow-500 font-black">₹{h.pot}</td>
                            <td className="px-3 py-2 text-blue-300 font-medium truncate max-w-[120px] md:max-w-[150px]" title={h.winReason}>{h.winReason}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-[#2a2c36] bg-[#0b0b0f] flex justify-end">
              <button onClick={() => setHistoryOpen(false)} className="px-6 py-2 bg-[#2a2c36] hover:bg-[#343743] rounded-lg text-white font-bold transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* End of Main Area */}
      </div>
      
      {/* Players Modal */}
      {playersOpen && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#13151b] border border-[#2a2c36] rounded-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-4 border-b border-[#2a2c36] flex justify-between items-center bg-[#0d0f14]">
              <h2 className="text-white font-black text-xl flex items-center space-x-2">
                <Users className="text-blue-500 w-6 h-6" />
                <span>PLAYERS</span>
              </h2>
              <button 
                onClick={() => setPlayersOpen(false)}
                className="text-gray-400 hover:text-white transition-colors p-2"
              >
                ✕
              </button>
            </div>
            
            <div className="overflow-y-auto p-4 flex-1">
              <div className="overflow-x-auto rounded-lg border border-[#2a2c36]">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#0d0e12] text-gray-400 uppercase text-xs">
                    <tr>
                      <th className="px-3 py-3 font-bold">Player</th>
                      <th className="px-3 py-3 font-bold">Status</th>
                      <th className="px-3 py-3 font-bold text-right">Balance</th>
                      <th className="px-3 py-3 font-bold text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2a2c36] bg-[#13151b]">
                    {players.map((p) => {
                      const isHost = table.hostId === myPlayerId;
                      const amIHost = p.id === table.hostId;
                      return (
                        <tr key={p.id} className="hover:bg-[#1a1d24] transition-colors">
                          <td className="px-3 py-3">
                            <div className="flex items-center space-x-3">
                              <div className="flex flex-col">
                                <span className="text-white font-bold whitespace-nowrap flex items-center space-x-2">
                                  <span>{p.name} {p.id === myPlayerId ? '(You)' : ''}</span>
                                  {amIHost && <span className="bg-purple-900 text-purple-200 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Host</span>}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center space-x-2">
                              <span className={`font-bold text-xs ${p.state === 'OUT' ? 'text-gray-500' : 'text-gray-300'}`}>{p.state}</span>
                              {!p.connected && <span className="bg-red-900/50 text-red-300 border border-red-500/30 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Offline</span>}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-right">
                            <span className="text-green-400 font-bold whitespace-nowrap">₹{p.wallet}</span>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center justify-center space-x-2">
                              {isHost && p.id !== myPlayerId ? (
                                <>
                                  <button 
                                    onClick={() => {
                                      setConfirmDialog({
                                        isOpen: true,
                                        title: 'Make Host',
                                        message: `Are you sure you want to transfer host privileges to ${p.name}? You will lose host controls.`,
                                        confirmText: 'MAKE HOST',
                                        isDanger: false,
                                        onConfirm: () => transferHost(p.id)
                                      });
                                    }}
                                    className="bg-blue-900/30 hover:bg-blue-900/60 border border-blue-500/30 text-blue-400 px-3 py-1 rounded text-xs font-bold transition-colors whitespace-nowrap"
                                  >
                                    MAKE HOST
                                  </button>
                                  <button 
                                    onClick={() => {
                                      setConfirmDialog({
                                        isOpen: true,
                                        title: 'Kick Player',
                                        message: `Are you sure you want to kick ${p.name} from the room?`,
                                        confirmText: 'KICK PLAYER',
                                        isDanger: true,
                                        onConfirm: () => kickPlayer(p.id)
                                      });
                                    }}
                                    className="bg-red-900/30 hover:bg-red-900/60 border border-red-500/30 text-red-400 px-3 py-1 rounded text-xs font-bold transition-colors whitespace-nowrap"
                                  >
                                    KICK
                                  </button>
                                </>
                              ) : (
                                <span className="text-gray-600 text-xs">-</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Custom Confirmation Modal */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#13151b] border border-[#2a2c36] rounded-2xl w-full max-w-sm overflow-hidden flex flex-col shadow-2xl">
            <div className="p-5 border-b border-[#2a2c36] bg-[#0d0f14]">
              <h2 className="text-white font-black text-xl">{confirmDialog.title}</h2>
            </div>
            <div className="p-6">
              <p className="text-gray-300 font-medium leading-relaxed">{confirmDialog.message}</p>
            </div>
            <div className="p-4 bg-[#0a0b0f] border-t border-[#2a2c36] flex space-x-3 justify-end">
              <button 
                onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                className="px-5 py-2.5 rounded-lg font-bold text-gray-400 hover:text-white hover:bg-[#2a2c36] transition-colors"
              >
                {confirmDialog.cancelText || 'CANCEL'}
              </button>
              <button 
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                }}
                className={`px-5 py-2.5 rounded-lg font-black transition-all ${
                  confirmDialog.isDanger 
                    ? 'bg-red-900/40 text-red-400 border border-red-500/30 hover:bg-red-900/70' 
                    : 'bg-blue-900/40 text-blue-400 border border-blue-500/30 hover:bg-blue-900/70'
                }`}
              >
                {confirmDialog.confirmText || 'CONFIRM'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Funds Modal */}
      {showAddFundsModal && (
        <div className="fixed inset-0 bg-black/85 z-[120] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#13151b] border border-[#2a2c36] rounded-2xl w-full max-w-sm overflow-hidden flex flex-col shadow-2xl">
            <div className="p-5 border-b border-[#2a2c36] bg-[#0d0f14] flex justify-between items-center">
              <h2 className="text-white font-black text-xl flex items-center gap-2">
                <Wallet className="text-yellow-500 w-5 h-5" />
                <span>ADD FUNDS</span>
              </h2>
              <button onClick={() => setShowAddFundsModal(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            
            <div className="p-6 space-y-4">
              {fundError && (
                <div className="bg-red-950/50 border border-red-900 text-red-200 text-xs p-3 rounded-lg text-center font-bold">
                  {fundError}
                </div>
              )}
              
              <div className="flex flex-col">
                <label className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Amount to Add (₹)</label>
                <input 
                  type="number"
                  min="1"
                  step="1"
                  className="bg-[#1a1c24] border border-[#2a2c36] rounded-xl px-4 py-3 text-white text-lg font-black focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                  value={fundAmount}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFundAmount(val);
                    if (Number(val) <= 0) {
                      setFundError('Amount must be greater than zero');
                    } else if (val.includes('.') || val.includes('-')) {
                      setFundError('Amount must be a whole positive number');
                    } else {
                      setFundError(null);
                    }
                  }}
                  placeholder="1000"
                />
                <p className="text-[10px] text-gray-500 mt-2">
                  * Dynamic limit: Additions pushing total invested above ₹3,000 require Host approval. Hosts bypass this check.
                </p>
              </div>
            </div>

            <div className="p-4 bg-[#0a0b0f] border-t border-[#2a2c36] flex space-x-3 justify-end">
              <button 
                onClick={() => { setShowAddFundsModal(false); setFundError(null); }}
                className="px-5 py-2.5 rounded-lg font-bold text-gray-400 hover:text-white transition-colors"
              >
                CANCEL
              </button>
              <button 
                onClick={() => {
                  const num = Number(fundAmount);
                  if (isNaN(num) || num <= 0 || fundAmount.includes('.') || fundAmount.includes('-')) {
                    setFundError('Invalid amount. Enter a positive whole number.');
                    return;
                  }
                  requestRebuy(num);
                  setShowAddFundsModal(false);
                  setFundError(null);
                }}
                className="px-6 py-2.5 rounded-lg font-black bg-gradient-to-b from-yellow-500 to-yellow-700 hover:brightness-110 text-white transition-all border border-yellow-500/30"
              >
                ADD FUNDS
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Side Show Request Modal */}
      {sideShowRequest && sideShowRequest.to === myPlayerId && (
        <div className="fixed inset-0 bg-black/85 z-[120] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#13151b] border border-[#2a2c36] rounded-2xl w-full max-w-sm overflow-hidden flex flex-col shadow-2xl text-center p-6">
            <h2 className="text-white font-black text-xl mb-2 text-blue-400">SIDE SHOW REQUEST</h2>
            <p className="text-gray-300 text-sm mb-6">
              <span className="font-bold text-white">{players.find(p => p.id === sideShowRequest.from)?.name}</span> has requested a side show with you.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => declineSideShow()}
                className="flex-1 py-3 rounded-lg font-bold text-gray-400 hover:bg-gray-800 hover:text-white transition-colors border border-gray-700"
              >
                DECLINE
              </button>
              <button 
                onClick={() => acceptSideShow()}
                className="flex-1 py-3 rounded-lg font-black bg-gradient-to-b from-blue-600 to-blue-800 hover:brightness-110 text-white transition-all border border-blue-500/30"
              >
                ACCEPT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Host Approval Dashboard panel - floating top center when requests exist */}
      {table.hostId === myPlayerId && pendingRebuys && pendingRebuys.length > 0 && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[110] bg-[#1a1c23]/95 border-2 border-yellow-500/50 backdrop-blur-md rounded-2xl p-4 shadow-2xl w-full max-w-sm flex flex-col space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-yellow-500 text-xs font-black tracking-widest uppercase flex items-center gap-1.5 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-yellow-500 animate-ping"></span>
              Add Funds Requests ({pendingRebuys.length})
            </span>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {pendingRebuys.map((req) => (
              <div key={req.playerId} className="flex justify-between items-center bg-[#13151b] p-3 rounded-lg border border-[#2a2c36]">
                <div className="flex flex-col">
                  <span className="text-white text-xs font-bold">{req.playerName}</span>
                  <span className="text-yellow-500 text-xs font-black">₹{req.amount}</span>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => declineRebuy(req.playerId)}
                    className="bg-red-950/30 hover:bg-red-950/60 border border-red-500/30 text-red-400 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                  >
                    Decline
                  </button>
                  <button 
                    onClick={() => approveRebuy(req.playerId)}
                    className="bg-green-700 hover:bg-green-600 border border-green-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                  >
                    Approve
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
