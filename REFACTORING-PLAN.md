# 🔧 Game Service Refactoring Plan

## Executive Summary

The `game.service.ts` file has grown to ~2000 lines and needs to be broken down into focused, manageable services. This document provides a step-by-step plan to safely refactor without losing any existing functionality.

**Current State:** 
- Single monolithic `game.service.ts` (~2000 lines)
- All game logic mixed together
- Difficult to test individual features
- Hard to find specific functionality

**Target State:**
- Multiple focused services (300-400 lines each)
- Clear separation of concerns
- Easier testing and maintenance
- Better code organization

---

## Pre-Refactoring Checklist

- [ ] Create backup branch: `git checkout -b pre-refactoring-backup`
- [ ] Ensure all tests are passing: `npm run test:comprehensive`
- [ ] Document current working features in this file
- [ ] Commit current state: `git commit -am "Pre-refactoring checkpoint"`

---

## Phase-by-Phase Execution Plan

### **Phase 1: AI Service Extraction** ✅ COMPLETED
**Risk Level: LOW** | **Estimated Time: 30-45 mins** | **Status: COMPLETED**

#### Why Start Here?
- Most isolated logic
- Clear boundaries (only called during opponent turns)
- Won't affect player interactions
- Easy to verify working correctly

#### Files to Create:
- [ ] `game-engine/src/ai/ai.service.ts`
- [ ] `game-engine/src/ai/ai.module.ts`

#### Methods to Extract:
- [ ] `getOpponentPieceForRound()` (lines ~1040-1100)
- [ ] `calculateOpponentSpendingBudget()` (lines ~1496-1543)
- [ ] `updateOpponentTank()` (lines ~1400-1494)
- [ ] `shouldReplaceWeakerPiece()` (lines ~1545-1618)
- [ ] `generateOpponentTank()` (lines ~1700-1795)

#### Verification Steps:
- [ ] Start game, verify AI buys pieces in round 1
- [ ] Progress to round 5, verify AI spending increases
- [ ] Lose a battle, verify AI adapts strategy
- [ ] Check AI water quality decisions (buying plants when needed)
- [ ] Verify crisis mode triggers (lose 3+ times)

#### Task Prompt for Claude Code:
```
Extract all AI opponent logic from game.service.ts into a new ai.service.ts in game-engine/src/ai/. 
Move these methods: getOpponentPieceForRound, calculateOpponentSpendingBudget, updateOpponentTank, 
shouldReplaceWeakerPiece, and generateOpponentTank. Keep the exact same logic, just move it. 
The game.service should import and use the AI service. Create an ai.module.ts that exports the service.
Test that the AI still buys pieces and makes decisions correctly.
```

#### Completion Checklist:
- [x] All methods moved
- [x] Game.service imports AI service
- [x] AI module registered in app.module
- [x] Game runs without errors
- [x] AI behavior unchanged
- [x] Commit: `git commit -am "Extract AI logic to dedicated service"`

---

### **Phase 2: Battle Service Extraction** ✅ COMPLETED
**Risk Level: LOW-MEDIUM** | **Estimated Time: 45-60 mins** | **Status: COMPLETED**

#### Files to Create:
- [x] `game-engine/src/battle/battle.service.ts`
- [x] `game-engine/src/battle/battle.module.ts`

#### Methods to Extract:
- [x] `initializeBattleState()` (lines ~1832-1854)
- [x] `processBattleTurn()` (lines ~760-1000)
- [x] `simulateBattle()` (lines ~1336-1360)
- [x] `convertToBattlePieces()` (lines ~1856-1899)
- [x] Battle event creation helpers
- [x] Damage calculation logic
- [x] Poison damage logic
- [x] Water quality combat modifiers

#### Verification Steps:
- [ ] Start a battle, verify it processes
- [ ] Check damage calculations are correct
- [ ] Verify poison damage in poor water (1-3 quality)
- [ ] Check combat bonuses for good water (8-10 quality)
- [ ] Verify battle log shows all events
- [ ] Check winner determination

#### Task Prompt for Claude Code:
```
Extract all battle logic from game.service.ts into battle.service.ts in game-engine/src/battle/.
Move: initializeBattleState, processBattleTurn, simulateBattle, convertToBattlePieces, 
and all battle-related helper methods including damage calculations, poison effects, and battle events.
Keep exact same logic. Game service should import and use battle service for all combat.
Verify battles still work correctly with proper damage, events, and winner determination.
```

#### Completion Checklist:
- [x] All battle methods moved
- [x] Battle state types preserved
- [x] WebSocket events still fire
- [x] Battle animations work
- [x] Winners determined correctly
- [x] Commit: `git commit -am "Extract battle logic to dedicated service"`

---

### **Phase 3: Create Safety Net Tests**
**Risk Level: NONE** | **Estimated Time: 30 mins** | **Status: NOT STARTED**

#### Files to Create:
- [ ] `game-engine/src/game/game-flow.integration.test.ts`

#### Test Scenarios to Cover:
- [ ] Player can buy a piece from shop
- [ ] Player can place piece on grid
- [ ] Battle starts when requested
- [ ] Battle completes with winner
- [ ] Gold rewards calculated correctly
- [ ] Interest applies properly
- [ ] Water quality changes with pieces
- [ ] Round progression works
- [ ] Shop refreshes between rounds
- [ ] Consumables apply permanently

#### Task Prompt for Claude Code:
```
Create integration tests in game-flow.integration.test.ts that verify core game flows still work.
Test: buying pieces, placing on grid, starting battles, gold/interest calculations, 
water quality changes, round progression. These tests will be our safety net for remaining refactors.
Don't test implementation details, just that features work end-to-end.
```

#### Completion Checklist:
- [ ] Test file created
- [ ] All scenarios covered
- [ ] Tests pass with current code

---

### **Phase 4: Economy Service Extraction**
**Risk Level: MEDIUM** | **Estimated Time: 45-60 mins** | **Status: NOT STARTED**

#### Files to Create:
- [ ] `game-engine/src/economy/economy.service.ts`
- [ ] `game-engine/src/economy/economy.module.ts`

#### Methods to Extract:
- [ ] `generateShop()` (lines ~1000-1034)
- [ ] `calculateInterest()`
- [ ] `calculateGoldReward()`
- [ ] `getRerollCost()`
- [ ] Transaction tracking logic
- [ ] Win/loss streak bonus calculations
- [ ] Shop locking logic

#### Verification Steps:
- [ ] Shop generates with correct number of items
- [ ] Reroll cost increases properly
- [ ] Interest calculates at 10% (max 5)
- [ ] Win streak bonuses apply
- [ ] Loss streak bonuses apply
- [ ] Transaction history tracks
- [ ] Shop lock works

#### Task Prompt for Claude Code:
```
Extract shop generation, interest, and gold management into economy.service.ts in game-engine/src/economy/.
Include: generateShop, calculateInterest, calculateGoldReward, getRerollCost, transaction tracking,
and streak bonus logic. Preserve all existing formulas and behaviors.
Game service should delegate all economy calculations to this service.
```

#### Completion Checklist:
- [ ] All economy methods moved
- [ ] Shop generation works
- [ ] Gold calculations correct
- [ ] Transaction history maintained

---

### **Phase 5: Tank Management Service**
**Risk Level: MEDIUM-HIGH** | **Estimated Time: 60-90 mins** | **Status: NOT STARTED**

#### Files to Create:
- [ ] `game-engine/src/tank/tank.service.ts`
- [ ] `game-engine/src/tank/tank.module.ts`

#### Methods to Extract:
- [ ] `placePieceOnGrid()` (lines ~1200-1300)
- [ ] `removePieceFromGrid()`
- [ ] `findValidPosition()`
- [ ] `canPlacePiece()`
- [ ] `findOptimalPosition()`
- [ ] `getEmptyPositions()`
- [ ] `getGridPositionsForPiece()`
- [ ] Grid initialization logic
- [ ] Grid validation helpers

#### Verification Steps:
- [ ] Single-cell pieces place correctly
- [ ] Multi-cell pieces (L-shape, T-shape) place correctly
- [ ] Collision detection works
- [ ] Pieces can be removed
- [ ] Drag and drop still works
- [ ] AI can place pieces

#### Task Prompt for Claude Code:
```
Extract grid and tank management into tank.service.ts in game-engine/src/tank/.
Include: placePieceOnGrid, removePieceFromGrid, findValidPosition, canPlacePiece,
findOptimalPosition, getEmptyPositions, and all grid-related helpers.
This is complex due to multi-cell piece shapes - ensure all placement logic is preserved.
Test thoroughly with L-shaped and T-shaped pieces.
```

#### Completion Checklist:
- [ ] All grid methods moved
- [ ] Multi-cell pieces work
- [ ] Collision detection works
- [ ] Both player and AI can place pieces

---

### **Phase 6: Piece Stats Service**
**Risk Level: MEDIUM** | **Estimated Time: 45-60 mins** | **Status: NOT STARTED**

#### Files to Create:
- [ ] `game-engine/src/stats/piece-stats.service.ts`
- [ ] `game-engine/src/stats/stats.module.ts`

#### Methods to Extract:
- [ ] `calculateWaterQuality()` (lines ~620-640)
- [ ] `applyAdjacencyBonuses()` (lines ~500-560)
- [ ] `calculateTotalStats()` (lines ~560-620)
- [ ] `applyConsumableEffect()` (lines ~1620-1700)
- [ ] `aretwoPiecesAdjacent()` (lines ~640-720)
- [ ] `getNeighbors()`
- [ ] Schooling bonus logic
- [ ] Equipment effect calculations

#### Verification Steps:
- [ ] Water quality calculates correctly
- [ ] Adjacency bonuses apply to neighbors
- [ ] Schooling fish get speed bonus
- [ ] Filter boosts plant effects
- [ ] Consumables apply permanent bonuses
- [ ] Multi-cell adjacency works

#### Task Prompt for Claude Code:
```
Extract all stat calculation logic into piece-stats.service.ts in game-engine/src/stats/.
Include: calculateWaterQuality, applyAdjacencyBonuses, calculateTotalStats, applyConsumableEffect,
aretwoPiecesAdjacent, and all stat-related helpers. 
Ensure adjacency logic handles multi-cell pieces correctly.
Verify bonuses stack properly and equipment effects work.
```

#### Completion Checklist:
- [ ] All stat methods moved
- [ ] Water quality correct
- [ ] Adjacency bonuses work
- [ ] Equipment effects apply
- [ ] Consumables work


---

### **Phase 7: Final Cleanup & Optimization**
**Risk Level: LOW** | **Estimated Time: 30 mins** | **Status: NOT STARTED**

#### What Should Remain in game.service.ts:
- Core game flow orchestration
- Session management (create, save, load)
- WebSocket event handlers
- Round progression control
- Service coordination
- High-level game state management

#### Cleanup Tasks:
- [ ] Remove all unused imports
- [ ] Remove any duplicate code
- [ ] Update debug service to use new services
- [ ] Ensure all services are properly injected
- [ ] Add JSDoc comments to service methods
- [ ] Update any hardcoded service references

#### Optimization Opportunities:
- [ ] Consider adding caching where appropriate
- [ ] Look for N+1 query patterns in loops
- [ ] Consider extracting interfaces for services
- [ ] Add logging for debugging

#### Final Verification:
- [ ] Run `npm run test:comprehensive`
- [ ] Start new game, play through 5 rounds
- [ ] Test all piece types
- [ ] Verify save/load works
- [ ] Check multiplayer still functions
- [ ] Run `npm run lint:fix`

#### Completion Checklist:
- [ ] Game.service is under 400 lines
- [ ] All tests pass
- [ ] No circular dependencies
- [ ] Code is properly organized

---

## Post-Refactoring Results

### File Structure (Target):
```
game-engine/src/
├── game/
│   ├── game.service.ts (~300 lines - orchestration only)
│   ├── game.module.ts
│   └── game.gateway.ts
├── ai/
│   ├── ai.service.ts (~400 lines)
│   └── ai.module.ts
├── battle/
│   ├── battle.service.ts (~400 lines)
│   └── battle.module.ts
├── economy/
│   ├── economy.service.ts (~200 lines)
│   └── economy.module.ts
├── tank/
│   ├── tank.service.ts (~300 lines)
│   └── tank.module.ts
├── stats/
│   ├── piece-stats.service.ts (~300 lines)
│   └── stats.module.ts
└── app/
    └── data/
        └── pieces.ts (unchanged)
```

### Benefits Achieved:
- [ ] Single Responsibility Principle enforced
- [ ] Easier to test individual features
- [ ] Easier to find and modify specific logic
- [ ] Better code reusability
- [ ] Cleaner dependency injection
- [ ] Prepared for future features (AI personalities, new game modes)

---

## Rollback Plan

If any phase goes critically wrong:

1. **Immediate Rollback:**
   ```bash
   git status  # Check what changed
   git diff    # Review changes
   git checkout -- .  # Discard all changes
   ```

2. **Rollback to Last Good Commit:**
   ```bash
   git log --oneline -5  # Find last good commit
   git reset --hard <commit-hash>
   ```

3. **Recovery from Backup Branch:**
   ```bash
   git checkout pre-refactoring-backup
   git checkout -b refactoring-attempt-2
   ```

---

## Tips for Success

### Do's:
- ✅ Test after EVERY phase
- ✅ Commit after each successful phase
- ✅ Keep logic identical in first pass
- ✅ Move helper methods with their primary methods
- ✅ Update imports incrementally

### Don'ts:
- ❌ Don't optimize while moving code
- ❌ Don't change logic during extraction
- ❌ Don't extract multiple services at once
- ❌ Don't skip verification steps
- ❌ Don't forget to update module imports

### Warning Signs to Stop:
- 🔴 Circular dependency detected
- 🔴 More than 5 test failures
- 🔴 WebSocket connections breaking
- 🔴 Session management failing
- 🔴 Basic features (buy/place/battle) not working

---

## Future Enhancements (Post-Refactoring)

Once refactoring is complete, these become much easier:

1. **AI Personality System** (TODO #3)
   - Add personality parameter to AI service
   - Create defensive(), aggressive(), frugal() strategies
   - Different opponents per round

2. **Enhanced Testing**
   - Unit test each service independently
   - Mock service dependencies
   - Test edge cases more thoroughly

3. **Performance Optimization**
   - Profile each service independently
   - Add caching where beneficial
   - Optimize hot paths

4. **New Features**
   - Easier to add new equipment types
   - Simpler to implement new battle mechanics
   - Cleaner to add new economic systems

---

## Notes Section

### Development Log:
_Use this section to track progress, issues encountered, and solutions found_

**Date: [YYYY-MM-DD]**
- Phase attempted:
- Issues encountered:
- Solution:
- Time taken:

---

## Success Criteria Checklist

### Must Have (Before considering complete):
- [ ] All existing features still work
- [ ] No regression in AI behavior
- [ ] Battle system unchanged
- [ ] Economy calculations identical
- [ ] All tests pass
- [ ] Game is playable end-to-end

### Nice to Have:
- [ ] Improved test coverage
- [ ] Better error messages
- [ ] Cleaner logs
- [ ] Documentation updated
- [ ] README updated with new structure

---

_Last Updated: 2025-08-10_
_Status: PLANNING PHASE_
_Next Action: Begin Phase 1 - AI Service Extraction_