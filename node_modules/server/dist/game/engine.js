"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HandType = void 0;
exports.createDeck = createDeck;
exports.shuffle = shuffle;
exports.dealCards = dealCards;
exports.handTypeToString = handTypeToString;
exports.evaluateHand = evaluateHand;
exports.compareHands = compareHands;
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const SUITS = ['Spades', 'Hearts', 'Clubs', 'Diamonds'];
function createDeck() {
    const deck = [];
    for (const suit of SUITS) {
        for (const rank of RANKS) {
            deck.push({ suit, rank });
        }
    }
    return deck;
}
function shuffle(deck) {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}
function dealCards(deck, numPlayers) {
    const hands = Array.from({ length: numPlayers }, () => []);
    const currentDeck = [...deck];
    for (let i = 0; i < 3; i++) {
        for (let p = 0; p < numPlayers; p++) {
            const card = currentDeck.pop();
            if (card)
                hands[p].push(card);
        }
    }
    return { hands, remainingDeck: currentDeck };
}
// Evaluation
var HandType;
(function (HandType) {
    HandType[HandType["HIGH_CARD"] = 1] = "HIGH_CARD";
    HandType[HandType["PAIR"] = 2] = "PAIR";
    HandType[HandType["COLOR"] = 3] = "COLOR";
    HandType[HandType["SEQUENCE"] = 4] = "SEQUENCE";
    HandType[HandType["PURE_SEQUENCE"] = 5] = "PURE_SEQUENCE";
    HandType[HandType["TRAIL"] = 6] = "TRAIL";
})(HandType || (exports.HandType = HandType = {}));
function handTypeToString(type) {
    switch (type) {
        case HandType.HIGH_CARD: return 'High Card';
        case HandType.PAIR: return 'Pair';
        case HandType.COLOR: return 'Color';
        case HandType.SEQUENCE: return 'Sequence';
        case HandType.PURE_SEQUENCE: return 'Pure Sequence';
        case HandType.TRAIL: return 'Trail';
        default: return 'Winning Hand';
    }
}
const getRankValue = (rank) => RANKS.indexOf(rank);
function evaluateHand(cards) {
    if (cards.length !== 3)
        throw new Error("A hand must have exactly 3 cards");
    // Sort cards by rank descending
    const sorted = [...cards].sort((a, b) => getRankValue(b.rank) - getRankValue(a.rank));
    const r1 = getRankValue(sorted[0].rank);
    const r2 = getRankValue(sorted[1].rank);
    const r3 = getRankValue(sorted[2].rank);
    const isFlush = sorted[0].suit === sorted[1].suit && sorted[1].suit === sorted[2].suit;
    // A-2-3 is a valid sequence and is considered highest after A-K-Q
    let isSequence = false;
    let sequenceScore = 0;
    if (r1 - r2 === 1 && r2 - r3 === 1) {
        isSequence = true;
        sequenceScore = r1;
    }
    else if (sorted[0].rank === 'A' && sorted[1].rank === '3' && sorted[2].rank === '2') {
        isSequence = true;
        sequenceScore = RANKS.indexOf('3'); // It's treated as A-2-3 (highest card 3 in normal run, but usually A-2-3 is second highest sequence)
        // Actually, in standard Teen Patti: A-K-Q is highest, A-2-3 is second highest. 
        // Let's adjust A-2-3 score to be artificially high, just below A-K-Q.
        sequenceScore = 13.5;
    }
    const baseScore = r1 * 14 * 14 + r2 * 14 + r3;
    if (r1 === r2 && r2 === r3) {
        return { type: HandType.TRAIL, score: r1 }; // Trail
    }
    if (isSequence && isFlush) {
        return { type: HandType.PURE_SEQUENCE, score: sequenceScore || r1 };
    }
    if (isSequence) {
        return { type: HandType.SEQUENCE, score: sequenceScore || r1 };
    }
    if (isFlush) {
        return { type: HandType.COLOR, score: baseScore };
    }
    if (r1 === r2) {
        return { type: HandType.PAIR, score: r1 * 14 + r3 }; // Pair of high, plus kicker
    }
    if (r2 === r3) {
        return { type: HandType.PAIR, score: r2 * 14 + r1 };
    }
    return { type: HandType.HIGH_CARD, score: baseScore };
}
function compareHands(hand1, hand2) {
    const eval1 = evaluateHand(hand1);
    const eval2 = evaluateHand(hand2);
    if (eval1.type !== eval2.type) {
        return eval1.type - eval2.type; // Positive if hand1 is better
    }
    return eval1.score - eval2.score; // Positive if hand1 is better
}
