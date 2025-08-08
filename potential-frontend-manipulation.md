# 🔒 Potential Frontend Manipulation Vulnerabilities

This document identifies potential security vulnerabilities where client-side logic could be manipulated to bypass game rules or gain unfair advantages.

## 🔴 **CRITICAL PRIORITY**

### 1. **Gold-Based Purchase Validation**
- **Files**: `frontend/src/components/game/Shop.tsx:54`, `PieceCard.tsx:45,113,133,137`
- **Issue**: Frontend checks `gold >= piece.cost` and `gold >= rerollCost` to enable/disable buttons
- **Risk**: DOM manipulation could enable purchases without sufficient gold
- **Current State**: Client-side validation only
- **Solution**: Backend must validate all gold transactions
- **Affected Operations**: Purchase pieces, reroll shop

### 2. **Reroll Cost Enforcement**
- **Files**: `frontend/src/components/game/Shop.tsx:54-58`
- **Issue**: Reroll button disabled based on `gold < rerollCost` client-side check
- **Risk**: Modified JavaScript could enable free rerolls
- **Current State**: Frontend-controlled
- **Solution**: Server must validate reroll cost payment

### 3. **Shop Phase Restrictions**
- **Files**: `frontend/src/components/game/GameView.tsx:531,538,586`
- **Issue**: Piece placement/dragging disabled based on `gameState.phase === 'shop'`
- **Risk**: Phase manipulation could allow placing pieces during battle
- **Current State**: Client-side phase checking
- **Solution**: Server-side phase validation for all actions

## 🟡 **HIGH PRIORITY**

### 4. **Draft State Manipulation**
- **Files**: `frontend/src/components/ui/Footer.tsx:32-44`
- **Issue**: Save/restore game state buttons could be exploited
- **Risk**: Players might restore favorable past states
- **Current State**: Client controls save/restore timing
- **Solution**: Server-side state validation and integrity checks

### 5. **Battle Phase UI Controls**
- **Files**: `frontend/src/components/game/BattleView.tsx:320,332`
- **Issue**: "Start Battle" button and battle UI shown based on `gameState.phase`
- **Risk**: Phase manipulation could skip battle phases
- **Current State**: Client-side phase rendering
- **Solution**: Server authoritative phase transitions

### 6. **Player ID Session Mapping**
- **Files**: `frontend/src/contexts/GameContext.tsx:225,226,242,243`
- **Issue**: Player ID sent from client in WebSocket events
- **Risk**: Players could impersonate other players
- **Current State**: Client provides player ID
- **Solution**: Server-side session authentication

## 🟠 **MEDIUM PRIORITY**

### 7. **Interest Rate Display**
- **Files**: `frontend/src/components/ui/Header.tsx:49-53`
- **Issue**: Interest calculation shown client-side (`Math.min(Math.floor(gold / 10), 5)`)
- **Risk**: Display manipulation, less critical since server calculates actual rewards
- **Current State**: Client calculates display
- **Solution**: Server provides calculated interest

### 8. **Win Rate Calculations**
- **Files**: `frontend/src/components/ui/Header.tsx:26`
- **Issue**: Win rate calculated client-side (`wins / (wins + losses) * 100`)
- **Risk**: Display manipulation only, cosmetic
- **Current State**: Client calculates display
- **Solution**: Server provides calculated stats

### 9. **Water Quality Effects**
- **Files**: `frontend/src/components/ui/Footer.tsx:53`
- **Issue**: Water quality displayed from client state
- **Risk**: If water quality affects gameplay, client manipulation possible
- **Current State**: Client-side display
- **Solution**: Server authoritative water quality effects

## 🔵 **LOW PRIORITY**

### 10. **Debug Information Exposure**
- **Files**: `frontend/src/contexts/GameContext.tsx:89-97,232-233`
- **Issue**: Extensive console logging of game state
- **Risk**: Information disclosure, easier reverse engineering
- **Current State**: Debug logs in production
- **Solution**: Remove/disable debug logs in production builds

### 11. **Battle Log Manipulation**
- **Files**: `frontend/src/components/game/BattleLog.tsx:97-120`
- **Issue**: Battle events rendered from client state
- **Risk**: Display manipulation of battle history
- **Current State**: Client renders battle log
- **Solution**: Server-signed battle events

## 📋 **RECOMMENDED IMPLEMENTATION PATTERN**

For all critical and high priority issues, implement this pattern:

```typescript
// ❌ VULNERABLE: Client-side validation
const canPurchase = gold >= piece.cost;
if (canPurchase) {
  onPurchase(piece.id, shopIndex);
}

// ✅ SECURE: Server-authoritative validation
const purchaseResult = await serverPurchase(piece.id, shopIndex);
if (purchaseResult.success) {
  // Update UI with server response
} else {
  // Show server error message
}
```

## 🛡️ **GENERAL SECURITY PRINCIPLES**

1. **Never trust client data** - Validate everything on server
2. **Server-authoritative game state** - Client is display-only
3. **Authenticated sessions** - Verify player identity server-side
4. **Signed transactions** - Prevent replay attacks
5. **Rate limiting** - Prevent spam/abuse
6. **Input sanitization** - Prevent injection attacks

## ⚡ **QUICK WINS**

Start with these high-impact, low-effort fixes:
1. **Gold validation** in purchase/reroll endpoints
2. **Phase checking** in all game action endpoints  
3. **Remove debug logs** from production builds
4. **Server-side interest calculation** return values