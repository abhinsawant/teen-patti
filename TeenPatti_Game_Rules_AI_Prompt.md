# AI Prompt: Implement Complete Teen Patti (3 Patti) Game Rules

This document contains the complete AI prompt for implementing a server-authoritative Teen Patti game engine.

## Role
You are a Senior Game Developer and Game Rules Engine Architect.

## Objective
Implement a complete Teen Patti engine supporting:
- 2–15 players
- Blind
- Chaal
- Raise
- Pack
- Side Show
- Show
- Dealer rotation
- Pot management
- Winner determination
- Settlement calculation

## Rules
Use a standard 52-card deck with no jokers. Shuffle before every round using a secure random shuffle. Deal 3 cards to each player.

Implement dealer rotation, betting rules (Blind, Chaal, Raise), Pack, Side Show, Show, Auto Show, pot management, card ranking (Trail, Pure Sequence, Sequence, Color, Pair, High Card), tie-breaking, wallet, rebuy, scoreboard, settlement, turn timer, reconnection, rule validation, and server-side authoritative game logic.

## Game Engine Modules
- Deck Engine
- Card Ranking Engine
- Bet Engine
- Wallet Engine
- Round Engine
- Turn Engine
- Dealer Engine
- Settlement Engine
- Validation Engine

## Testing
Generate unit tests covering card ranking, shuffle randomness, raise validation, Side Show, Show, winner calculation, wallet updates, settlement, dealer rotation, and turn order with 95%+ code coverage.
