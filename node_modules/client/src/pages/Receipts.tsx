import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import type { SessionReceipt } from 'shared';

const API_URL = import.meta.env.VITE_SERVER_URL || (import.meta.env.PROD ? '' : 'http://localhost:3001');

export default function Receipts() {
  const [receipts, setReceipts] = useState<SessionReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const navigate = useNavigate();
  
  const playerId = (sessionStorage.getItem('playerId') || localStorage.getItem('playerId'));

  useEffect(() => {
    if (!playerId) {
      setLoading(false);
      return;
    }
    
    fetch(`${API_URL}/api/kitchen/receipts/${playerId}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setReceipts(data.receipts);
        } else {
          setError(data.error || 'Failed to fetch receipts');
        }
      })
      .catch(err => {
        console.error(err);
        setError('Connection failed');
      })
      .finally(() => setLoading(false));
  }, [playerId]);

  return (
    <div className="min-h-screen bg-background text-white p-6 md:p-12 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-[-10%] right-[-5%] w-[40vw] h-[40vw] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[30vw] h-[30vw] rounded-full bg-purple-500/10 blur-[100px] pointer-events-none" />
      
      <div className="max-w-4xl mx-auto relative z-10">
        <header className="flex items-center mb-12">
          <button 
            onClick={() => navigate('/')}
            className="p-3 bg-surface border border-white/5 rounded-xl hover:bg-white/10 transition group"
          >
            <ArrowLeft className="w-6 h-6 text-white/70 group-hover:text-primary transition" />
          </button>
          <div className="ml-6">
            <h1 className="text-4xl font-black tracking-tight flex items-center gap-3">
              <FileText className="w-10 h-10 text-primary" />
              Past Receipts
            </h1>
            <p className="text-white/50 mt-1">Your historical session settlements</p>
          </div>
        </header>

        {loading ? (
          <div className="flex justify-center p-12">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : error ? (
          <div className="bg-red-500/20 text-red-400 p-6 rounded-xl border border-red-500/30 text-center">
            {error}
          </div>
        ) : receipts.length === 0 ? (
          <div className="bg-surface/50 border border-white/5 p-12 rounded-3xl text-center">
            <FileText className="w-16 h-16 text-white/10 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white/70 mb-2">No Receipts Found</h2>
            <p className="text-white/40">You haven't played any sessions to completion yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {receipts.map(receipt => {
              const isExpanded = expandedId === receipt.id;
              const dateObj = new Date(receipt.date);
              
              // Calculate total pot of the session (sum of all net losses / winnings)
              let totalExchanged = 0;
              Object.values(receipt.players).forEach(p => {
                if (p.netProfit > 0) totalExchanged += p.netProfit;
              });

              return (
                <div key={receipt.id} className="bg-surface border border-white/5 rounded-2xl overflow-hidden transition-all duration-300 shadow-lg">
                  <div 
                    onClick={() => setExpandedId(isExpanded ? null : receipt.id)}
                    className="p-6 flex flex-wrap items-center justify-between cursor-pointer hover:bg-white/5 transition"
                  >
                    <div className="flex items-center gap-4">
                      <div className="bg-primary/20 p-3 rounded-xl">
                        <Calendar className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg">Room: {receipt.roomId}</h3>
                        <p className="text-sm text-white/50">{dateObj.toLocaleString()}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6 mt-4 sm:mt-0">
                      <div className="text-right">
                        <p className="text-xs text-white/50 uppercase tracking-wider">Total Exchanged</p>
                        <p className="font-bold text-primary text-xl">₹{totalExchanged}</p>
                      </div>
                      {isExpanded ? <ChevronUp className="w-6 h-6 text-white/50" /> : <ChevronDown className="w-6 h-6 text-white/50" />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-white/5 bg-black/20 p-6">
                      <div className="grid md:grid-cols-2 gap-8">
                        
                        {/* Player Balances */}
                        <div>
                          <h4 className="text-sm font-bold text-white/50 uppercase tracking-wider mb-4">Final Balances</h4>
                          <div className="space-y-3">
                            {Object.values(receipt.players).map(p => (
                              <div key={p.id} className="flex justify-between items-center bg-surface/50 p-3 rounded-xl border border-white/5">
                                <div className="flex items-center gap-2">
                                  <span className="text-xl">{p.avatar}</span>
                                  <span className="font-medium">{p.name} {p.id === playerId ? '(You)' : ''}</span>
                                </div>
                                <div className={`font-mono font-bold ${p.netProfit > 0 ? 'text-primary' : p.netProfit < 0 ? 'text-red-400' : 'text-white/50'}`}>
                                  {p.netProfit > 0 ? '+' : ''}₹{p.netProfit}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Who Owes Whom */}
                        <div>
                          <h4 className="text-sm font-bold text-white/50 uppercase tracking-wider mb-4">Settlement Details</h4>
                          {receipt.settlements.length === 0 ? (
                            <div className="bg-surface/50 p-4 rounded-xl border border-white/5 text-center text-white/50 italic">
                              Everyone broke even. No debts!
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {receipt.settlements.map((s, i) => {
                                const fromPlayer = receipt.players[s.fromId];
                                const toPlayer = receipt.players[s.toId];
                                return (
                                  <div key={i} className="bg-surface/50 p-4 rounded-xl border border-white/5 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span>{fromPlayer?.avatar}</span>
                                      <span className="font-bold text-red-400">{fromPlayer?.name}</span>
                                    </div>
                                    <div className="flex flex-col items-center px-4">
                                      <span className="text-xs text-white/40 uppercase tracking-widest mb-1">Owes</span>
                                      <span className="font-mono font-bold text-primary bg-primary/10 px-3 py-1 rounded-full">₹{s.amount}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-primary">{toPlayer?.name}</span>
                                      <span>{toPlayer?.avatar}</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
