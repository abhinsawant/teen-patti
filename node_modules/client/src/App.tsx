import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import GameRoom from './pages/GameRoom';
import Receipts from './pages/Receipts';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background text-white selection:bg-primary/30">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/room/:id" element={<GameRoom />} />
          <Route path="/receipts" element={<Receipts />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
