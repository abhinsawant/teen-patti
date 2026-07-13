"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HandType = exports.ranks = exports.suits = void 0;
exports.createDeck = createDeck;
exports.shuffle = shuffle;
exports.dealCards = dealCards;
exports.evaluateHand = evaluateHand;
exports.compareHands = compareHands;
exports.handTypeToString = handTypeToString;
exports.suits = ['Spades', 'Hearts', 'Clubs', 'Diamonds'];
exports.ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const rankValues = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
    '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
};
var HandType;
(function (HandType) {
    HandType[HandType["HIGH_CARD"] = 1] = "HIGH_CARD";
    HandType[HandType["PAIR"] = 2] = "PAIR";
    HandType[HandType["COLOR"] = 3] = "COLOR";
    HandType[HandType["SEQUENCE"] = 4] = "SEQUENCE";
    HandType[HandType["PURE_SEQUENCE"] = 5] = "PURE_SEQUENCE";
    HandType[HandType["TRAIL"] = 6] = "TRAIL";
})(HandType || (exports.HandType = HandType = {}));
function createDeck() {
    const deck = [];
    for (const suit of exports.suits) {
        for (const rank of exports.ranks) {
            deck.push({ suit, rank });
        }
    }
    return deck;
}
function shuffle(deck) {
    const newDeck = [...deck];
    for (let i = newDeck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
    }
    return newDeck;
}
function dealCards(deck, numPlayers) {
    const hands = Array.from({ length: numPlayers }, () => []);
    for (let i = 0; i < 3; i++) {
        for (let p = 0; p < numPlayers; p++) {
            const card = deck.pop();
            if (card)
                hands[p].push(card);
        }
    }
    return hands;
}
function evaluateHand(cards) {
    const sorted = [...cards].sort((a, b) => rankValues[b.rank] - rankValues[a.rank]); // Descending
    const isColor = sorted[0].suit === sorted[1].suit && sorted[1].suit === sorted[2].suit;
    let isSequence = false;
    if (rankValues[sorted[0].rank] - rankValues[sorted[1].rank] === 1 && rankValues[sorted[1].rank] - rankValues[sorted[2].rank] === 1) {
        isSequence = true;
    }
    else if (sorted[0].rank === 'A' && sorted[1].rank === '3' && sorted[2].rank === '2') {
        // A-2-3 is a special sequence
        isSequence = true;
    }
    const isTrail = sorted[0].rank === sorted[1].rank && sorted[1].rank === sorted[2].rank;
    const isPair = sorted[0].rank === sorted[1].rank || sorted[1].rank === sorted[2].rank || sorted[0].rank === sorted[2].rank;
    let type = HandType.HIGH_CARD;
    if (isTrail)
        type = HandType.TRAIL;
    else if (isSequence && isColor)
        type = HandType.PURE_SEQUENCE;
    else if (isSequence)
        type = HandType.SEQUENCE;
    else if (isColor)
        type = HandType.COLOR;
    else if (isPair)
        type = HandType.PAIR;
    // Calculate a comparable score based on ranks
    let score = 0;
    if (type === HandType.SEQUENCE || type === HandType.PURE_SEQUENCE) {
        if (sorted[0].rank === 'A' && sorted[1].rank === '3' && sorted[2].rank === '2') {
            score = rankValues['3'] * 10000 + rankValues['2'] * 100 + rankValues['A']; // Treat as 3-2-A for comparison
        }
        else {
            score = rankValues[sorted[0].rank] * 10000 + rankValues[sorted[1].rank] * 100 + rankValues[sorted[2].rank];
        }
    }
    else if (type === HandType.PAIR) {
        const pairRank = sorted[0].rank === sorted[1].rank ? sorted[0].rank : sorted[1].rank === sorted[2].rank ? sorted[1].rank : sorted[0].rank;
        const kickerRank = sorted.find(c => c.rank !== pairRank)?.rank || pairRank; // fallback
        score = rankValues[pairRank] * 10000 + rankValues[kickerRank];
    }
    else {
        score = rankValues[sorted[0].rank] * 10000 + rankValues[sorted[1].rank] * 100 + rankValues[sorted[2].rank];
    }
    return { type, score };
}
function compareHands(hand1, hand2) {
    const eval1 = evaluateHand(hand1);
    const eval2 = evaluateHand(hand2);
    if (eval1.type !== eval2.type) {
        return eval1.type - eval2.type; // Positive if hand1 is better
    }
    return eval1.score - eval2.score; // Positive if hand1 has better score
}
function handTypeToString(type) {
    switch (type) {
        case HandType.TRAIL: return 'Trail';
        case HandType.PURE_SEQUENCE: return 'Pure Sequence';
        case HandType.SEQUENCE: return 'Sequence';
        case HandType.COLOR: return 'Color';
        case HandType.PAIR: return 'Pair';
        case HandType.HIGH_CARD: return 'High Card';
        default: return 'Unknown';
    }
}
