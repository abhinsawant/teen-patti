# Teen Patti (3 Patti) Master Specification

> This document consolidates the agreed requirements discussed during planning. It does not introduce new features beyond those already agreed.

## 1. Objective
Build a multiplayer Teen Patti Progressive Web Application for private groups.

- Minimum Players: 2
- Maximum Players: 15
- Starting Pot: ₹5

## 2. Technology Stack
- React + TypeScript + Vite
- Tailwind CSS
- Framer Motion
- Node.js
- Express.js
- Socket.IO
- JSON File Storage
- Single Monorepo
- Single Node.js Deployment
- PWA

## 3. Deployment
Single deployment:
- One repository
- One package.json
- React served by Express
- Socket.IO hosted by Express
- Single npm start

Preferred Hosting:
- Railway
Fallback:
- Render

Artifacts:
- Dockerfile
- docker-compose.yml
- railway.json
- .env.example
- GitHub Actions
- README.md

## 4. Project Structure

/client
/server
/shared
/data

JSON:
- rooms.json
- players.json
- sessions.json
- rounds.json
- settlements.json
- config.json

## 5. JSON Storage
Server is the single source of truth.

Requirements:
- Atomic writes
- Read/write locking
- Automatic backup
- Recovery
- In-memory cache
- Periodic flush

## 6. Client Storage

Use Session Storage only for:
- Session Token
- Player ID
- Player Name
- Room Code
- Reconnect Token
- Temporary UI state

Local Storage only for:
- Theme
- Sound
- Volume

Never store gameplay in Local Storage.

## 7. Mobile Frontend

- Mobile-first responsive UI
- PWA
- Android/iPhone compatible
- Tablet/Desktop responsive
- Circular poker table
- Bottom action bar
- Portrait optimized
- No hover dependency
- Safe area support
- No horizontal scrolling

## 8. Gameplay

Support:
- Blind
- Chaal
- Raise
- Pack
- Side Show
- Show

After every raise:
- Auto update minimum Blind
- Auto update minimum Chaal
- Cannot decrease below minimum

## 9. Player Layout

Players arranged around circular table.

Pot centered.

Indicators:
- Seen
- Blind
- Packed
- Winner
- Connected
- Disconnected

## 10. Host Controls

- Start Game
- End Session
- Pause
- Resume
- Kick Player
- Lock Room
- Unlock Room
- Transfer Host
- Approve/Revoke Rebuy

## 11. Session Wallet

Host configures:
- Buy-in
- Rebuy Amount
- Max Rebuys
- Auto Approve

Track:
- Buy-in
- Rebuys
- Contributions
- Winnings
- Wallet
- Net Profit/Loss

## 12. Scoreboard

Display:
- Player
- Invested
- Won
- Wallet
- Net Profit/Loss
- Status

## 13. Settlement

Show optimized "Who Owes Whom".

## 14. APIs

Cooking-themed wrapper endpoints only.

## 15. Security

Server validates all actions.
Server is authoritative.

## 16. Reconnection

Restore session from server using Session Storage token.

## 17. Deliverables

1. Project Setup
2. Folder Structure
3. Backend
4. Socket.IO
5. JSON Storage
6. Game Engine
7. React UI
8. Circular Table
9. Animations
10. Scoreboard
11. Settlement
12. Rebuy
13. Testing
14. Deployment
15. Documentation
