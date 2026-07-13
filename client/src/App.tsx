import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import GameRoom from './pages/GameRoom';
import Lobby from './pages/Lobby';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Lobby />} />
        <Route path="/game" element={<GameRoom />} />
      </Routes>
    </Router>
  );
}
export default App;
