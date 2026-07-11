import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameSocket } from '../hooks/useGameSocket';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Settings, LogOut, Play, ShieldAlert, Star, Lock, Unlock, Pause, Check, X, PlusCircle, Copy } from 'lucide-react';



export default function GameRoom() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const playerName = sessionStorage.getItem('playerName') || '';
  const playerId = sessionStorage.getItem('playerId') || '';
  const playerAvatar = sessionStorage.getItem('playerAvatar') || '🤵';

  const { 
    socket, room, privateCards, error, notification, 
    startGame, actionPack, actionSee, actionBlind, actionChaal, actionShow, actionSideshow, 
    actionSideshowAccept, actionSideshowDeny, actionRaise, actionRebuy, endSession, updateConfig,
    hostLockToggle, hostKick, hostTransfer, hostPauseToggle, hostApproveRebuy, hostDenyRebuy
  } = useGameSocket(id!, playerName, playerAvatar, playerId);

  const [showScoreboard, setShowScoreboard] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isDealing, setIsDealing] = useState(false);
  const [extraRaise, setExtraRaise] = useState(0);
  const [flyingCoins, setFlyingCoins] = useState<{id: string, fromPlayerId: string, amount: number}[]>([]);
  
  useEffect(() => {
    if (!socket) return;
    const handleCoin = (data: { fromPlayerId: string, amount: number }) => {
      const id = Math.random().toString();
      setFlyingCoins(prev => [...prev, { id, ...data }]);
      setTimeout(() => {
        setFlyingCoins(prev => prev.filter(c => c.id !== id));
      }, 1000);
    };
    socket.on('animate_coin', handleCoin);
    return () => {
      socket.off('animate_coin', handleCoin);
    };
  }, [socket]);
  
  useEffect(() => {
    if (room?.activeRound?.id) {
      setIsDealing(true);
      const numPlayers = Object.keys(room.players || {}).length;
      const maxDelay = (3 * numPlayers * 120) + 400;
      const timeout = setTimeout(() => setIsDealing(false), Math.max(1500, maxDelay));
      return () => clearTimeout(timeout);
    }
  }, [room?.activeRound?.id]);

  useEffect(() => {
    if (room?.activeRound?.currentTurnId === playerId) {
      try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
        
        gainNode.gain.setValueAtTime(0, ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
      } catch (e) {
        // ignore audio play errors
      }
    }
  }, [room?.activeRound?.currentTurnId, playerId]);
  
  // Settings temp state
  const [tempBuyIn, setTempBuyIn] = useState(1000);
  const [tempRebuy, setTempRebuy] = useState(1000);
  const [tempMaxRebuys, setTempMaxRebuys] = useState(3);
  const [tempAutoApprove, setTempAutoApprove] = useState(true);

  useEffect(() => {
    if (room?.config) {
      setTempBuyIn(room.config.buyIn);
      setTempRebuy(room.config.rebuyAmount);
      setTempMaxRebuys(room.config.maxRebuys);
      setTempAutoApprove(room.config.autoApprove);
    }
  }, [room?.config]);

  useEffect(() => {
    if (!playerName || !playerId) {
      navigate('/');
    }
  }, [playerName, playerId, navigate]);

  useEffect(() => {
    if (room?.status === 'ENDED') {
      navigate('/receipts');
    }
  }, [room?.status, navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-surface p-8 rounded-2xl text-center border border-white/10 max-w-sm">
          <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Connection Error</h2>
          <p className="text-white/60 mb-6">{error}</p>
          <button onClick={() => navigate('/')} className="bg-white/10 px-6 py-2 rounded-xl hover:bg-white/20 transition">
            Go Home
          </button>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const isHost = room.hostId === playerId;
  const myPlayer = room.players?.[playerId];
  const playersList = room.playerOrder?.map(pid => room.players![pid]) || [];
  
  // Arrange players circularly (myPlayer at bottom center)
  const myIndex = room.playerOrder?.indexOf(playerId) || 0;
  
  return (
    <div className="fixed inset-0 bg-[#050a07] flex flex-col justify-between overflow-hidden">
      
      {/* Notification Toast */}
      <AnimatePresence>
        {notification && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-20 left-1/2 transform -translate-x-1/2 z-50 bg-yellow-500/90 text-black font-bold px-6 py-2 rounded-full shadow-lg border border-yellow-400"
          >
            {notification}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Header */}
      <header className="p-4 flex justify-between items-center z-10">
        <div className="flex flex-col">
          <span className="text-xs text-white/50 uppercase tracking-wider font-bold">Room Code</span>
          <div className="flex items-center gap-2 mt-1">
            <button onClick={() => navigator.clipboard.writeText(room?.id || '')} className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-lg border border-white/10 cursor-pointer hover:bg-black/60 transition" title="Copy Room Code">
              <span className="text-xl font-mono font-bold text-primary tracking-widest">{room.id}</span>
              <Copy className="w-4 h-4 text-white/50 hover:text-white" />
            </button>
            {room.locked && <ShieldAlert className="w-4 h-4 text-accent" />}
            {isHost && (
              <button onClick={hostLockToggle} className="p-1.5 bg-black/40 rounded hover:bg-black/60 transition text-white/70 hover:text-white border border-white/5">
                {room.locked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>
        
        <div className="flex gap-3">
          <button onClick={actionRebuy} className="p-2 bg-yellow-500/20 rounded-full hover:bg-yellow-500/40 transition text-yellow-500 border border-yellow-500/30" title="Rebuy (Refill Balance)">
            <PlusCircle className="w-5 h-5" />
          </button>
          <button onClick={() => setShowScoreboard(true)} className="p-2 bg-black/40 rounded-full hover:bg-black/60 transition text-white/70 hover:text-white border border-white/5">
            <Users className="w-5 h-5" />
          </button>
          {isHost && (
            <button onClick={() => setShowSettings(true)} className="p-2 bg-black/40 rounded-full hover:bg-black/60 transition text-white/70 hover:text-white border border-white/5">
              <Settings className="w-5 h-5" />
            </button>
          )}
          <button 
            onClick={() => {
              if (isHost) {
                endSession();
              } else {
                navigate('/');
              }
            }} 
            className="p-2 bg-black/40 rounded-full hover:bg-black/60 transition text-red-400 hover:text-red-300 border border-white/5"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Game Table Area */}
      <div className="flex-1 min-h-0 w-full relative flex items-center justify-center overflow-hidden">
        
        {room.paused && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-surface/90 border border-white/10 p-8 rounded-3xl text-center shadow-2xl flex flex-col items-center">
               <Pause className="w-16 h-16 text-yellow-500 mb-4" />
               <h2 className="text-2xl font-bold text-white mb-2">Game Paused</h2>
               <p className="text-white/60">The host has paused the game.</p>
            </div>
          </div>
        )}

        {/* The Poker Table */}
        <div className="absolute top-[15%] sm:top-1/2 transform sm:-translate-y-1/2 w-[95%] aspect-[6/5] sm:aspect-[2/1] max-w-[900px] max-h-[60vh] sm:max-h-[500px] border-[12px] sm:border-[16px] border-[#c79724] rounded-[120px] sm:rounded-full shadow-[0_0_50px_rgba(0,0,0,0.8),inset_0_0_20px_rgba(0,0,0,0.5)] bg-gradient-to-br from-[#0a3d1c] to-[#052e15] flex items-center justify-center">
          {/* Inner ring / felt styling */}
          <div className="absolute w-[94%] h-[90%] border-2 border-[#126b42] rounded-[100px] sm:rounded-full pointer-events-none"></div>
          
          <AnimatePresence>
            {isDealing && (
              <motion.div
                initial={{ opacity: 0, scale: 0, y: -20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0, transition: { duration: 0.3 } }}
                className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none"
              >
                <div className="relative w-12 h-16">
                   <div className="absolute top-2 left-2 w-12 h-16 bg-blue-800 rounded-sm border-2 border-white/80 shadow-2xl transform rotate-[5deg] opacity-60"></div>
                   <div className="absolute top-1 left-1 w-12 h-16 bg-blue-800 rounded-sm border-2 border-white/90 shadow-2xl transform rotate-[-2deg] opacity-80"></div>
                   <div className="relative w-12 h-16 bg-blue-800 rounded-sm border-2 border-white shadow-2xl">
                     <div className="absolute inset-1 border border-blue-400/30 rounded-sm"></div>
                   </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Pot Area */}
          <div className="text-center z-50 relative">
            {room.activeRound?.state === 'COMPLETED' && room.activeRound.winnerIds && room.activeRound.winnerIds.length > 0 && (
              <motion.div 
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 whitespace-nowrap pointer-events-none flex flex-col items-center z-[100]"
              >
                <div className="bg-primary text-black font-black px-4 sm:px-6 py-1.5 sm:py-2 rounded-full text-lg sm:text-2xl uppercase tracking-widest shadow-[0_0_30px_var(--tw-colors-primary)] border-[3px] sm:border-4 border-yellow-200 flex items-center gap-2">
                  WINNER! <span className="text-xl sm:text-2xl animate-bounce">🎉</span>
                </div>
                <div className="text-white font-bold text-sm sm:text-xl mt-2 drop-shadow-md text-center bg-black/60 px-4 py-1 rounded-full border border-white/20">
                  {room.activeRound.winnerIds.map(id => room.players![id]?.name).join(' & ')}
                </div>
              </motion.div>
            )}
            <div className="text-white/60 font-black tracking-widest text-sm md:text-base uppercase mb-1 drop-shadow-md">
              Total Pot
            </div>
            <div className={`text-4xl md:text-5xl font-black text-yellow-400 drop-shadow-[0_2px_5px_rgba(0,0,0,0.8)] flex items-center justify-center gap-2 ${(room.activeRound?.state === 'COMPLETED') ? 'opacity-20' : ''}`}>
              <span className="text-yellow-500">₹</span>
              {room.activeRound?.pot || 0}
            </div>
            <div className="text-white/50 font-semibold text-xs md:text-sm mt-1">
              Min Bet: ₹{room.activeRound?.minimumBet || 0}
            </div>
            
            {/* Coins decoration */}
            <AnimatePresence>
              {(room.activeRound?.pot || 0) > 0 && room.activeRound?.state !== 'COMPLETED' && [10, 50, 100].slice(0, Math.min(3, Math.floor((room.activeRound?.pot || 0)/100) + 1)).map((coin, i) => {
                return (
                  <motion.div
                    key={`coin-${i}`}
                    initial={{ y: -50, opacity: 0, rotateX: 180 }}
                    animate={{ y: 0, opacity: 1, rotateX: 0 }}
                    transition={{ delay: i * 0.1, type: 'spring' }}
                    className="absolute z-[-1]"
                    style={{
                      left: `calc(50% + ${Math.cos(i * 2) * 30}px)`,
                      top: `calc(50% + ${Math.sin(i * 2) * 20}px)`
                    }}
                  >
                    <div className="w-8 h-8 rounded-full bg-yellow-400 border-[3px] border-yellow-600 shadow-xl flex items-center justify-center text-[8px] font-black text-yellow-900 transform rotate-12">
                      ₹{coin}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            
            {/* Flying Coins */}
            <AnimatePresence>
              {flyingCoins.map(coin => {
                const pIndex = room.playerOrder?.indexOf(coin.fromPlayerId) || 0;
                let relIndex = pIndex - myIndex;
                if (relIndex < 0) relIndex += (room.playerOrder?.length || 1);
                const aAngle = (relIndex / (room.playerOrder?.length || 1)) * 2 * Math.PI + Math.PI / 2;
                
                const tw = typeof window !== 'undefined' ? Math.min(window.innerWidth * 0.85, 800) : 800;
                const th = typeof window !== 'undefined' ? Math.min(window.innerHeight * 0.65, 500) : 500;
                const cOffsetX = -(42 / 100) * tw * Math.cos(aAngle);
                const cOffsetY = -(26 / 100) * th * Math.sin(aAngle);
                
                return (
                  <motion.div
                    key={coin.id}
                    initial={{ x: cOffsetX, y: cOffsetY, scale: 0.5, opacity: 0 }}
                    animate={{ x: 0, y: 0, scale: 1, opacity: 1 }}
                    exit={{ opacity: 0, scale: 0 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                    className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-none"
                  >
                    <div className="bg-yellow-500 rounded-full w-10 h-10 border-4 border-yellow-300 shadow-[0_0_15px_rgba(234,179,8,0.5)] flex items-center justify-center font-bold text-black text-xs">
                      ₹{coin.amount}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
          
          {/* Players mapping (Circular Math relative to Table) */}
          {playersList.map((p, index) => {
            let relativeIndex = index - myIndex;
            if (relativeIndex < 0) relativeIndex += playersList.length;
            
            const angle = (relativeIndex / playersList.length) * 2 * Math.PI + Math.PI / 2;
            
            const numPlayers = playersList.length;
            const targetScale = numPlayers > 10 ? 0.65 : numPlayers > 6 ? 0.8 : 1;
            
            const baseA = 46; 
            const baseB = 44; 
            
            const a = numPlayers > 6 ? baseA + 3 : baseA; 
            const b = numPlayers > 6 ? baseB + 3 : baseB;
            
            const left = `${50 + a * Math.cos(angle)}%`;
            const top = `${50 + b * Math.sin(angle)}%`;
            
            const tw = 800;
            const th = 500;
            const offsetX = -(a / 100) * tw * Math.cos(angle);
            const offsetY = -(b / 100) * th * Math.sin(angle);
            
            const isTurn = room.activeRound?.currentTurnId === p.id;
            
            return (
              <motion.div 
                key={p.id}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: targetScale, opacity: 1 }}
                className={`absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-30 transition-all duration-500`}
                style={{ left, top }}
              >
                {/* Player Avatar */}
                <div className="relative flex flex-col items-center">
                  {room.hostId === p.id && (
                    <div className="absolute -top-2 -right-1 z-40 bg-black/80 rounded-full p-0.5 border border-primary/50">
                      <Star className="w-3.5 h-3.5 text-primary fill-primary drop-shadow-[0_0_5px_rgba(234,179,8,1)]" />
                    </div>
                  )}
                  {room.dealerId === p.id && (
                    <div className="absolute -bottom-1 -right-2 z-40 bg-white rounded-full w-5 h-5 flex items-center justify-center border-2 border-black font-bold text-black text-[10px] shadow-lg">
                      D
                    </div>
                  )}
                  <div className={`relative w-16 h-16 md:w-20 md:h-20 rounded-full border-[3px] ${isTurn ? 'border-primary shadow-[0_0_20px_var(--tw-colors-primary)]' : 'border-[#d4af37]'} ${p.connected ? 'bg-surface' : 'bg-surface/50 grayscale'} flex items-center justify-center overflow-hidden z-10`}>
                    <span className="text-3xl md:text-4xl">{p.avatar || '🤵'}</span>
                    {isTurn && (
                      <div className="absolute inset-0 border-4 border-primary rounded-full animate-ping opacity-20"></div>
                    )}
                  </div>
                  
                  {/* Name & Wallet Badge */}
                  <div className="relative -mt-3 bg-black border border-[#d4af37] px-3 py-0.5 rounded-full flex flex-col items-center shadow-lg z-20 min-w-[80px]">
                    <span className="text-white font-bold text-[10px] md:text-xs truncate w-full text-center">{p.name}</span>
                    <span className="text-primary font-black text-[10px] md:text-xs">₹{p.wallet}</span>
                  </div>
                </div>
  
                {/* Cards */}
                {(p.state === 'PLAYING' || (room.activeRound?.state === 'COMPLETED' && p.state !== 'PACKED')) && (() => {
                  const displayCards = (p.id === playerId && (!p.cards || p.cards.length === 0) && privateCards.length > 0) ? privateCards : p.cards;
                  return (
                    <div className={`flex justify-center -space-x-3 sm:-space-x-5 z-40 ${
                        p.id === playerId 
                          ? 'absolute top-[110%] sm:top-[120%] mt-2 sm:mt-2 scale-[1.2] sm:scale-[1.2]' 
                          : Math.sin(angle) > 0 ? 'absolute bottom-[90%] mb-1 sm:mb-2' : 'absolute top-[90%] mt-1 sm:mt-2'
                      }`}>
                      {displayCards && displayCards.length > 0 ? displayCards.map((c, i) => (
                        <motion.div 
                          key={`${room.activeRound?.id || 'r'}-${p.id}-${i}`}
                          initial={{ opacity: 0, scale: 0.2, x: offsetX, y: offsetY, rotateZ: -180 }}
                          animate={{ opacity: 1, scale: 1, x: 0, y: 0, rotateZ: i === 0 ? -5 : i === 1 ? 0 : 5 }}
                          transition={{ delay: (i * playersList.length + index) * 0.12, type: 'spring', stiffness: 200, damping: 20 }}
                          whileHover={{ scale: 1.15, rotateZ: 0, y: -10, zIndex: 50 }}
                          className={`${p.id === playerId ? 'w-12 h-16 sm:w-16 sm:h-24' : 'w-8 h-12 sm:w-10 sm:h-14'} bg-white rounded-md border border-gray-300 shadow-xl flex flex-col items-center justify-center relative`}
                        >
                           <span className={`${p.id === playerId ? 'text-sm sm:text-base' : 'text-[10px] sm:text-xs'} font-black ${c.suit === 'Hearts' || c.suit === 'Diamonds' ? 'text-red-500' : 'text-black'}`}>{c.rank}</span>
                           <span className={`${p.id === playerId ? 'text-base sm:text-xl' : 'text-xs sm:text-sm'} ${c.suit === 'Hearts' || c.suit === 'Diamonds' ? 'text-red-500' : 'text-black'}`}>{c.suit === 'Spades' ? '♠' : c.suit === 'Hearts' ? '♥' : c.suit === 'Diamonds' ? '♦' : '♣'}</span>
                        </motion.div>
                      )) : [1,2,3].map(i => (
                        <motion.div 
                          key={`${room.activeRound?.id || 'r'}-${p.id}-back-${i}`}
                          initial={{ opacity: 0, scale: 0.2, x: offsetX, y: offsetY, rotateZ: -180 }}
                          animate={{ opacity: 1, scale: 1, x: 0, y: 0, rotateZ: i === 1 ? -5 : i === 2 ? 0 : 5 }}
                          transition={{ delay: (i * playersList.length + index) * 0.12, type: 'spring', stiffness: 200, damping: 20 }}
                          className={`${p.id === playerId ? 'w-12 h-16 sm:w-16 sm:h-24' : 'w-8 h-12 sm:w-10 sm:h-14'} bg-blue-600 rounded-md border border-white/50 shadow-xl flex items-center justify-center relative`}
                        >
                          <div className="w-[80%] h-[90%] border border-white/20 rounded-sm"></div>
                           <div className="w-full h-full bg-blue-800 rounded-sm m-[1px] border-2 border-blue-400/30 absolute inset-0"></div>
                        </motion.div>
                      ))}
                    </div>
                  );
                })()}
                {p.state === 'PACKED' && (
                  <div className="mt-1 text-sm md:text-xs text-accent font-bold bg-accent/10 px-3 py-1 rounded shadow-sm border border-accent/20">PACKED</div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      <footer className="p-4 bg-surface/80 backdrop-blur-xl border-t border-white/10 relative z-20 pb-safe">
        
        {/* Host Controls */}
        {isHost && (
          <div className="flex justify-center gap-4 mb-4">
            {(!room.activeRound || room.activeRound.state === 'COMPLETED') && (
              <button 
                onClick={startGame}
                className="bg-primary text-black font-bold px-8 py-3 rounded-xl flex items-center gap-2 hover:scale-105 transition-transform"
              >
                <Play className="w-5 h-5 fill-black" />
                {room.activeRound ? 'START NEXT ROUND' : 'START GAME'}
              </button>
            )}
            {room.activeRound && room.activeRound.state !== 'COMPLETED' && (
              <button 
                onClick={hostPauseToggle}
                className="bg-yellow-500/20 text-yellow-500 font-bold px-6 py-2 rounded-xl flex items-center gap-2 hover:bg-yellow-500/30 transition border border-yellow-500/30 text-sm"
              >
                {room.paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                {room.paused ? 'RESUME GAME' : 'PAUSE GAME'}
              </button>
            )}
          </div>
        )}

        {/* Player Controls (When in game) */}
        {room.activeRound && myPlayer && myPlayer.state === 'PLAYING' && (() => {
          const activePlayers = Object.values(room.players || {}).filter(p => p.state === 'PLAYING');
          const isTwoPlayersLeft = activePlayers.length === 2;
          const canShow = isTwoPlayersLeft;
          
          let targetSideShowId = '';
          if (activePlayers.length > 2) {
            const myIdx = room.playerOrder!.indexOf(playerId);
            for (let i = 1; i < room.playerOrder!.length; i++) {
              let pIdx = (myIdx - i + room.playerOrder!.length) % room.playerOrder!.length;
              const p = room.players![room.playerOrder![pIdx]];
              if (p.state === 'PLAYING') {
                targetSideShowId = p.id;
                break;
              }
            }
          }
          const isTargetSeen = targetSideShowId ? room.players![targetSideShowId].seen : false;
          const canSideShow = activePlayers.length > 2 && myPlayer.seen && isTargetSeen;
          
          return (
            <div className="w-full max-w-[500px] mx-auto flex flex-col gap-2 px-2 pb-2">
              {/* Optional SEE CARDS Row */}
              {!myPlayer.seen && (
                 <button 
                   onClick={actionSee} 
                   className="w-full bg-yellow-500/90 text-yellow-950 font-black py-3 sm:py-2.5 rounded-lg hover:bg-yellow-400 transition shadow-[0_4px_15px_rgba(234,179,8,0.3)] text-base sm:text-sm uppercase tracking-widest"
                 >
                   SEE MY CARDS
                 </button>
              )}
              
              {/* Main Action Bar Row */}
              <div className="flex gap-2 w-full h-20 sm:h-24 mt-2">
                <button 
                  onClick={myPlayer.seen ? actionChaal : actionBlind}
                  disabled={room.activeRound.currentTurnId !== playerId}
                  className={`flex-[1.5] ${myPlayer.seen ? 'bg-[#127027] hover:bg-[#1a8a36]' : 'bg-[#c29415] hover:bg-[#d6a317]'} text-white font-bold rounded-lg transition disabled:opacity-40 disabled:grayscale text-base sm:text-lg shadow-[0_4px_0_rgba(0,0,0,0.5),0_5px_10px_rgba(0,0,0,0.5)] active:shadow-[0_0_0_rgba(0,0,0,0.5),0_2px_5px_rgba(0,0,0,0.5)] active:translate-y-1 flex flex-col items-center justify-center leading-tight border border-white/10`}
                >
                  <span>{myPlayer.seen ? 'CHAAL' : 'BLIND'}</span>
                  <span className="text-sm sm:text-base text-white/80 font-normal">₹{myPlayer.seen ? room.activeRound.minimumBet * 2 : room.activeRound.minimumBet}</span>
                </button>
                
                {(() => {
                  const minAllowed = myPlayer.seen ? room.activeRound!.minimumBet * 2 : room.activeRound!.minimumBet;
                  const stepValue = myPlayer.seen ? room.config!.startingBlind * 2 : room.config!.startingBlind;
                  const minRaise = minAllowed + stepValue;
                  const currentRaise = minRaise + extraRaise;
                  
                  return (
                    <div className="flex-[2] flex bg-[#104e7a] rounded-lg shadow-[0_4px_0_rgba(0,0,0,0.5),0_5px_10px_rgba(0,0,0,0.5)] border border-white/10">
                      <button 
                        onClick={() => setExtraRaise(prev => Math.max(0, prev - stepValue))}
                        className="px-2 sm:px-3 text-white/70 hover:text-white font-bold text-lg hover:bg-white/10 rounded-l-lg transition disabled:opacity-40"
                        disabled={room.activeRound!.currentTurnId !== playerId || extraRaise === 0}
                      >
                        -
                      </button>
                      <button 
                        onClick={() => { actionRaise(currentRaise); setExtraRaise(0); }}
                        disabled={room.activeRound!.currentTurnId !== playerId}
                        className="flex-1 flex flex-col items-center justify-center font-bold text-white text-base sm:text-lg leading-tight hover:bg-white/5 transition disabled:opacity-40 disabled:grayscale"
                      >
                        <span>RAISE</span>
                        <span className="text-sm sm:text-base text-white/80 font-normal">₹{currentRaise}</span>
                      </button>
                      <button 
                        onClick={() => setExtraRaise(prev => prev + stepValue)}
                        className="px-2 sm:px-3 text-white/70 hover:text-white font-bold text-lg hover:bg-white/10 rounded-r-lg transition disabled:opacity-40"
                        disabled={room.activeRound!.currentTurnId !== playerId}
                      >
                        +
                      </button>
                    </div>
                  );
                })()}

                {isTwoPlayersLeft ? (
                  <button 
                    onClick={actionShow}
                    disabled={room.activeRound.currentTurnId !== playerId || !canShow}
                    className="flex-1 bg-[#d97706] text-white font-bold rounded-lg hover:bg-[#b45309] transition disabled:opacity-40 disabled:grayscale text-base sm:text-lg shadow-[0_4px_0_rgba(0,0,0,0.5),0_5px_10px_rgba(0,0,0,0.5)] active:shadow-[0_0_0_rgba(0,0,0,0.5),0_2px_5px_rgba(0,0,0,0.5)] active:translate-y-1 flex items-center justify-center flex-col leading-tight border border-white/10"
                  >
                    <span>SHOW</span>
                  </button>
                ) : (
                  <button 
                    onClick={() => actionSideshow(targetSideShowId)}
                    disabled={room.activeRound.currentTurnId !== playerId || !canSideShow}
                    className="flex-1 bg-[#522461] text-white font-bold rounded-lg hover:bg-[#6b2f7f] transition disabled:opacity-40 disabled:grayscale text-base sm:text-lg shadow-[0_4px_0_rgba(0,0,0,0.5),0_5px_10px_rgba(0,0,0,0.5)] active:shadow-[0_0_0_rgba(0,0,0,0.5),0_2px_5px_rgba(0,0,0,0.5)] active:translate-y-1 flex items-center justify-center flex-col leading-tight border border-white/10"
                  >
                    <span>SIDE</span>
                    <span>SHOW</span>
                  </button>
                )}

                <button 
                  onClick={actionPack}
                  disabled={room.activeRound.currentTurnId !== playerId}
                  className="flex-1 bg-[#75191c] text-white font-bold rounded-lg hover:bg-[#9c2125] transition disabled:opacity-40 disabled:grayscale text-base sm:text-lg shadow-[0_4px_0_rgba(0,0,0,0.5),0_5px_10px_rgba(0,0,0,0.5)] active:shadow-[0_0_0_rgba(0,0,0,0.5),0_2px_5px_rgba(0,0,0,0.5)] active:translate-y-1 flex items-center justify-center border border-white/10"
                >
                  PACK
                </button>
              </div>
            </div>
          );
        })()}
        
        {/* Waiting State */}
        {(!room.activeRound || myPlayer?.state === 'WAITING') && !isHost && (
          <div className="text-center text-white/50 text-sm py-4">
            Waiting for host to start the next round...
          </div>
        )}
      </footer>

      {/* Private Cards Overlay */}
      <AnimatePresence>
        
        {room.activeRound?.pendingSideShow?.targetId === playerId && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <div className="bg-surface border border-blue-500/50 p-6 rounded-2xl w-full max-w-sm text-center">
              <h2 className="text-2xl font-bold mb-2 text-white">Side Show Request</h2>
              <p className="text-white/60 mb-6">
                <span className="font-bold text-primary">{room.players![room.activeRound.pendingSideShow.requesterId].name}</span> wants to compare cards with you!
              </p>
              <div className="flex gap-3">
                <button onClick={actionSideshowAccept} className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 rounded-xl transition">
                  Accept
                </button>
                <button onClick={actionSideshowDeny} className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl transition">
                  Deny
                </button>
              </div>
            </div>
          </motion.div>
        )}
        
      </AnimatePresence>

      {/* Modals */}
      {showScoreboard && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-white/10 p-6 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4 text-white">Scoreboard</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-white/50 text-sm">
                    <th className="py-2 px-4">Player</th>
                    <th className="py-2 px-4 text-right">Wallet</th>
                    <th className="py-2 px-4 text-right">Invested</th>
                    <th className="py-2 px-4 text-right">Won</th>
                    <th className="py-2 px-4 text-right">Net Profit</th>
                    {isHost && <th className="py-2 px-4 text-right">Host Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {Object.values(room.players || {}).map(p => {
                    const net = p.wallet - p.invested;
                    return (
                       <tr key={p.id} className="border-b border-white/5 last:border-0">
                         <td className="py-3 px-4 flex items-center gap-2">
                           <span className="text-2xl">{p.avatar || '🤵'}</span>
                           <span className="flex items-center gap-2">
                             {p.name}
                             {room.hostId === p.id && <span className="bg-primary/20 text-primary text-[10px] uppercase font-bold px-1.5 py-0.5 rounded flex items-center gap-1"><Star className="w-3 h-3 fill-primary" /> HOST</span>}
                           </span>
                         </td>
                         <td className="py-3 px-4 text-right font-mono">₹{p.wallet}</td>
                         <td className="py-3 px-4 text-right font-mono text-white/50">₹{p.invested}</td>
                         <td className="py-3 px-4 text-right font-mono text-primary">₹{p.won}</td>
                         <td className={`py-3 px-4 text-right font-mono font-bold ${net > 0 ? 'text-primary' : net < 0 ? 'text-red-400' : 'text-white'}`}>
                           {net > 0 ? '+' : ''}₹{net}
                         </td>
                         {isHost && (
                           <td className="py-3 px-4 text-right">
                             {p.id !== playerId && (
                               <div className="flex justify-end gap-2">
                                 <button onClick={() => hostTransfer(p.id)} className="bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30 px-2 py-1 rounded text-xs font-bold transition">Make Host</button>
                                 <button onClick={() => hostKick(p.id)} className="bg-red-500/20 text-red-500 hover:bg-red-500/30 px-2 py-1 rounded text-xs font-bold transition">Kick</button>
                               </div>
                             )}
                           </td>
                         )}
                       </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <h3 className="text-xl font-bold mt-8 mb-4 text-white">Live Settlement Projection</h3>
            <div className="space-y-2">
              {(() => {
                const players = room.players || {};
                const debtors = Object.values(players).filter(p => (p.wallet - p.invested) < 0).map(p => ({ id: p.id, amount: p.invested - p.wallet })).sort((a,b) => b.amount - a.amount);
                const creditors = Object.values(players).filter(p => (p.wallet - p.invested) > 0).map(p => ({ id: p.id, amount: p.wallet - p.invested })).sort((a,b) => b.amount - a.amount);
                const settlements = [];
                let d = 0, c = 0;
                while(d < debtors.length && c < creditors.length) {
                  const amount = Math.min(debtors[d].amount, creditors[c].amount);
                  if (amount > 0) {
                    settlements.push({ fromId: debtors[d].id, toId: creditors[c].id, amount });
                  }
                  debtors[d].amount -= amount;
                  creditors[c].amount -= amount;
                  if (debtors[d].amount <= 0) d++;
                  if (creditors[c].amount <= 0) c++;
                }
                
                if (settlements.length === 0) return <div className="text-white/40 italic">No debts currently.</div>;
                
                return settlements.map((s, i) => {
                  const fromP = players[s.fromId];
                  const toP = players[s.toId];
                  return (
                    <div key={i} className="bg-black/30 border border-white/5 p-3 rounded-lg flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{fromP.avatar}</span>
                        <span className="text-white/80">{fromP.name}</span>
                      </div>
                      <div className="text-[10px] text-white/30 uppercase tracking-widest px-2">owes</div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{toP.avatar}</span>
                        <span className="font-bold text-primary">{toP.name}</span>
                      </div>
                      <div className="font-mono text-yellow-400 font-bold ml-auto">₹{s.amount}</div>
                    </div>
                  );
                });
              })()}
            </div>

            <div className="mt-6 flex justify-end">
              <button onClick={() => setShowScoreboard(false)} className="bg-white/10 hover:bg-white/20 px-6 py-2 rounded-xl transition font-bold">Close</button>
            </div>
          </div>
        </div>
      )}

      {showSettings && isHost && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-white/10 p-6 rounded-2xl w-full max-w-sm">
            <h2 className="text-2xl font-bold mb-6 text-white">Host Settings</h2>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs text-white/50 mb-1">Buy-In</label>
                <input type="number" value={tempBuyIn} onChange={e => setTempBuyIn(Number(e.target.value))} className="w-full bg-black border border-white/10 rounded px-3 py-2 text-white" />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Rebuy Amount</label>
                <input type="number" value={tempRebuy} onChange={e => setTempRebuy(Number(e.target.value))} className="w-full bg-black border border-white/10 rounded px-3 py-2 text-white" />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Max Rebuys</label>
                <input type="number" value={tempMaxRebuys} onChange={e => setTempMaxRebuys(Number(e.target.value))} className="w-full bg-black border border-white/10 rounded px-3 py-2 text-white" />
              </div>
            </div>
            
            <div className="flex gap-2 mb-4">
              <button onClick={() => {
                updateConfig({ buyIn: tempBuyIn, rebuyAmount: tempRebuy, maxRebuys: tempMaxRebuys, autoApprove: tempAutoApprove });
                setShowSettings(false);
              }} className="flex-1 bg-primary text-black font-bold py-2 rounded-xl">Save</button>
              <button onClick={() => setShowSettings(false)} className="flex-1 bg-white/10 hover:bg-white/20 py-2 rounded-xl">Cancel</button>
            </div>
            
            <div className="border-t border-white/10 pt-4 mt-4">
              <button onClick={() => { endSession(); setShowSettings(false); }} className="w-full bg-red-500/20 hover:bg-red-500/30 text-red-500 border border-red-500/50 font-bold py-3 rounded-xl transition">
                End Session (Settle Up)
              </button>
            </div>
          </div>
        </div>
      )}
      


      {/* Pending Rebuy Approvals Modal */}
      {isHost && room.pendingRebuys && room.pendingRebuys.length > 0 && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-white/10 p-6 rounded-2xl w-full max-w-sm text-center">
            <h2 className="text-xl font-bold mb-4 text-white">Pending Rebuys</h2>
            <div className="space-y-3 mb-6">
              {room.pendingRebuys.map(reqId => {
                const p = room.players![reqId];
                if (!p) return null;
                return (
                  <div key={reqId} className="flex items-center justify-between bg-black/40 p-3 rounded-lg border border-white/5">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{p.avatar}</span>
                      <span className="text-white font-bold">{p.name}</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => hostApproveRebuy(reqId)} className="bg-green-500 hover:bg-green-600 text-white p-2 rounded-lg transition">
                        <Check className="w-4 h-4" />
                      </button>
                      <button onClick={() => hostDenyRebuy(reqId)} className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg transition">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
