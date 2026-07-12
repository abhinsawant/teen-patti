import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Spade, Heart, Club, Diamond, FileText } from 'lucide-react';

const API_URL = import.meta.env.VITE_SERVER_URL || (import.meta.env.PROD ? '' : 'http://localhost:3001');

const AVATARS = ['🤵', '🧑‍🚀', '🥷', '🧑‍🔬', '🧙‍♂️', '🦸‍♂️', '🤴', '👸', '🧛‍♂️', '🕵️'];

export default function Home() {
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleCreateRoom = async () => {
    if (!name.trim()) return setError('Please enter your name');
    setLoading(true);
    setError('');
    
    try {
      let playerId = sessionStorage.getItem('playerId');
      if (!playerId) {
        if (localStorage.getItem('playerName') === name) {
          playerId = localStorage.getItem('playerId');
        }
      }
      if (!playerId) {
        playerId = Math.random().toString(36).substring(2, 9);
      }
      
      const res = await fetch(`${API_URL}/api/kitchen/open-kitchen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostName: name, hostId: playerId })
      });
      const data = await res.json();
      if (data.success) {
        sessionStorage.setItem('playerId', playerId); localStorage.setItem('playerId', playerId);
        sessionStorage.setItem('playerName', name); localStorage.setItem('playerName', name);
        sessionStorage.setItem('playerAvatar', avatar); localStorage.setItem('playerAvatar', avatar);
        navigate(`/room/${data.roomId}`);
      } else {
        setError(data.error || 'Failed to create room');
      }
    } catch (e) {
      setError('Connection failed');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!name.trim()) return setError('Please enter your name');
    if (!roomCode.trim()) return setError('Please enter a room code');
    setLoading(true);
    setError('');
    
    try {
      const res = await fetch(`${API_URL}/api/kitchen/inspect-kitchen/${roomCode}`);
      const data = await res.json();
      if (data.success) {
        if (data.locked) {
          setError('This room is currently locked.');
        } else {
          sessionStorage.setItem('playerName', name); localStorage.setItem('playerName', name);
          sessionStorage.setItem('playerAvatar', avatar); localStorage.setItem('playerAvatar', avatar);
          let pid = sessionStorage.getItem('playerId');
          if (!pid) {
            if (localStorage.getItem('playerName') === name) {
              pid = localStorage.getItem('playerId');
            }
          }
          if (!pid) {
            pid = Math.random().toString(36).substring(2, 9);
          }
          sessionStorage.setItem('playerId', pid); localStorage.setItem('playerId', pid);
          navigate(`/room/${roomCode.toUpperCase()}`);
        }
      } else {
        setError(data.error || 'Room not found');
      }
    } catch (e) {
      setError('Connection failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-start sm:justify-center min-h-[100vh] min-h-[100lvh] pt-12 sm:pt-4 p-4 overflow-y-auto relative bg-background">
      {/* Background decorations */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-accent/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-secondary/10 rounded-full blur-[100px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-surface/50 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl z-10"
      >
        <div className="flex justify-center gap-4 mb-6 text-primary">
          <Spade className="w-8 h-8" />
          <Heart className="w-8 h-8 text-accent" />
          <Club className="w-8 h-8" />
          <Diamond className="w-8 h-8 text-accent" />
        </div>
        
        <div className="flex items-center justify-center gap-3 mb-2">
          <h1 className="text-4xl font-bold text-center bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Teen Patti Master
          </h1>
          <span className="bg-primary/20 text-primary border border-primary/50 text-[10px] font-bold px-2 py-0.5 rounded-full">v1.2</span>
        </div>
        <p className="text-center text-white/60 mb-8">Premium Multiplayer Experience</p>

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-xl mb-6 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">Your Name</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[16px] text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              placeholder="e.g. Casino King"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/60 ml-1">Choose Avatar</label>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {AVATARS.map(a => (
                <button
                  key={a}
                  onClick={() => setAvatar(a)}
                  className={`flex-shrink-0 w-12 h-12 rounded-full text-2xl flex items-center justify-center transition-all ${avatar === a ? 'bg-primary border-2 border-primary scale-110 shadow-[0_0_10px_var(--tw-colors-primary)]' : 'bg-surface border border-white/10 hover:bg-white/10'}`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 space-y-4">
            <button 
              onClick={handleCreateRoom}
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/90 text-black font-bold py-4 rounded-xl transition-all active:scale-[0.98] disabled:opacity-50"
            >
              Create New Room
            </button>
            
            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-white/10"></div>
              <span className="flex-shrink-0 mx-4 text-white/40 text-sm">OR JOIN EXISTING</span>
              <div className="flex-grow border-t border-white/10"></div>
            </div>

            <div className="flex gap-2">
              <input 
                type="text" 
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                className="flex-grow bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[16px] text-white focus:outline-none focus:ring-2 focus:ring-secondary/50 transition-all font-mono uppercase"
                placeholder="ROOM CODE"
                maxLength={6}
              />
              <button 
                onClick={handleJoinRoom}
                disabled={loading || !roomCode}
                className="bg-surface border border-white/10 hover:bg-white/10 text-white font-bold px-6 rounded-xl transition-all active:scale-[0.98] disabled:opacity-50"
              >
                Join
              </button>
            </div>
          </div>
          
          <div className="mt-8 text-center">
             <button onClick={() => navigate('/receipts')} className="text-white/50 hover:text-primary transition flex items-center gap-2 mx-auto text-sm">
               <FileText className="w-4 h-4" />
               View Past Receipts
             </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
