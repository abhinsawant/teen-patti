import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';

function cn(...inputs: (string | undefined | null | false)[]) {
  return inputs.filter(Boolean).join(' ');
}

const AVATARS = [
  'Felix', 'Aneka', 'Bandit', 'Charlie', 'Daisy', 
  'Ginger', 'Loki', 'Max', 'Milo', 'Nala'
];

export default function Lobby() {
  const [name, setName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { initSocket, joinRoom } = useGameStore();

  const handleJoinOrCreate = async (action: 'CREATE' | 'JOIN') => {
    if (!name.trim()) {
      setError('Please enter a display name');
      return;
    }
    if (name.length > 12) {
      setError('Name must be 12 characters or less');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      // Connect socket if not already connected
      initSocket();
      
      // Attempt to join/create on the backend via the store
      const success = await joinRoom(name, selectedAvatar, action);
      
      if (success) {
        navigate('/game');
      } else {
        setError(action === 'CREATE' ? 'Active room already exists. Please join instead.' : 'Could not join room. Name might be taken or room inactive.');
      }
    } catch (err: any) {
      setError(err.message || 'Connection failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#111116] flex flex-col items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-green-900/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-900/20 blur-[120px] rounded-full" />
      </div>

      <div className="relative z-10 w-full max-w-md bg-[#1a1c23]/80 backdrop-blur-xl border border-gray-800 rounded-2xl shadow-2xl p-6 md:p-8 flex flex-col items-center">
        <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-400 to-yellow-700 tracking-wider mb-2 drop-shadow-sm">
          3 PATTI
        </h1>
        <p className="text-red-500 font-bold text-[10px] md:text-xs tracking-[0.3em] uppercase mb-8 flex items-center gap-2">
          <span>Play with Friends</span>
          <span className="bg-red-900/50 text-red-200 px-1.5 py-0.5 rounded text-[8px] tracking-normal">v2.0</span>
        </p>

        {error && (
          <div className="w-full bg-red-950/50 border border-red-900 text-red-200 text-sm p-3 rounded-lg mb-6 text-center">
            {error}
          </div>
        )}

        <div className="w-full mb-8">
          <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-3">
            Choose Avatar
          </label>
          <div className="grid grid-cols-5 gap-3 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
            {AVATARS.map((avatar) => (
              <button
                key={avatar}
                onClick={() => setSelectedAvatar(avatar)}
                className={cn(
                  "relative aspect-square rounded-full border-2 transition-all p-0.5 overflow-hidden bg-[#2a2c36]",
                  selectedAvatar === avatar 
                    ? "border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.4)] scale-110 z-10" 
                    : "border-gray-700 opacity-60 hover:opacity-100 hover:border-gray-500"
                )}
              >
                <img 
                  src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${avatar}`} 
                  alt={avatar} 
                  className="w-full h-full object-cover" 
                />
              </button>
            ))}
          </div>
        </div>

        <div className="w-full mb-8">
          <label className="block text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">
            Display Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            maxLength={12}
            className="w-full bg-[#13151b] border border-gray-700 text-white font-bold px-4 py-3 rounded-lg focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-all placeholder:text-gray-600"
          />
        </div>

        <div className="w-full flex flex-col gap-3 mt-4">
          <button 
            onClick={() => handleJoinOrCreate('CREATE')}
            disabled={isLoading}
            className="w-full bg-gradient-to-b from-yellow-600 to-yellow-900 hover:brightness-110 text-white font-black py-4 rounded-xl shadow-lg border border-yellow-500/50 uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Connecting...' : 'Create New Room'}
          </button>
          
          <div className="flex items-center w-full my-1">
            <div className="flex-1 border-t border-gray-800"></div>
            <span className="px-3 text-gray-600 text-xs font-bold uppercase">Or</span>
            <div className="flex-1 border-t border-gray-800"></div>
          </div>

          <button 
            onClick={() => handleJoinOrCreate('JOIN')}
            disabled={isLoading}
            className="w-full bg-gradient-to-b from-blue-700 to-blue-950 hover:brightness-110 text-white font-black py-4 rounded-xl shadow-lg border border-blue-600/50 uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
             {isLoading ? 'Connecting...' : 'Join Active Room'}
          </button>
        </div>
      </div>
      
      {/* Short Custom Scrollbar styles for the avatar grid */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #1a1c23; 
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #374151; 
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #4b5563; 
        }
      `}</style>
    </div>
  );
}
