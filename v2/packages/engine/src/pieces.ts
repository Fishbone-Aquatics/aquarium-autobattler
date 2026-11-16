import type { Cell, PieceDef } from './types';

const row = (n: number): Cell[] => Array.from({ length: n }, (_, x) => ({ x, y: 0 }));
const col = (n: number): Cell[] => Array.from({ length: n }, (_, y) => ({ x: 0, y }));
const square: Cell[] = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
];

export const PIECES: PieceDef[] = [
  // ---- Schooling fish ----
  {
    id: 'neon-tetra', name: 'Neon Tetra', emoji: '🐟', type: 'fish', rarity: 'common', cost: 2,
    shape: row(1), stats: { attack: 2, health: 3, speed: 6 },
    tags: ['schooling', 'nano'], traits: [], school: { attackPer: 1, frenzyAt: 3 },
    text: ['+1 ATK per adjacent schooling fish', 'Double speed with schooling fish on 3 or more of its sides'],
  },
  {
    id: 'cardinal-tetra', name: 'Cardinal Tetra', emoji: '🐠', type: 'fish', rarity: 'uncommon', cost: 3,
    shape: row(1), stats: { attack: 3, health: 2, speed: 7 },
    tags: ['schooling', 'nano'], traits: [], school: { attackPer: 2 },
    text: ['+2 ATK per adjacent schooling fish'],
  },
  {
    id: 'corydoras', name: 'Corydoras', emoji: '🐱', type: 'fish', rarity: 'common', cost: 3,
    shape: row(1), stats: { attack: 1, health: 5, speed: 3 },
    tags: ['schooling', 'bottom'], traits: [], school: { healthPer: 2 },
    text: ['+2 HP per adjacent schooling fish'],
  },

  // ---- Showpiece fish ----
  {
    id: 'betta', name: 'Siamese Betta', emoji: '🎏', type: 'fish', rarity: 'uncommon', cost: 4,
    shape: col(2), stats: { attack: 5, health: 4, speed: 4 },
    tags: ['aggressive'], traits: ['first-strike', 'loner-row'],
    text: ['First strike: acts first on turn 1', '+2 ATK if no other fish shares its rows'],
  },
  {
    id: 'angelfish', name: 'Angelfish', emoji: '👼', type: 'fish', rarity: 'rare', cost: 6,
    shape: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 0 }], stats: { attack: 4, health: 6, speed: 3 },
    tags: ['territorial'], traits: ['solitary'],
    text: ['+3 ATK if nothing is adjacent'],
  },
  {
    id: 'pufferfish', name: 'Pea Puffer', emoji: '🐡', type: 'fish', rarity: 'rare', cost: 5,
    shape: row(1), stats: { attack: 2, health: 7, speed: 2 },
    tags: ['aggressive'], traits: ['spines'],
    text: ['Spines: attackers take 2 damage'],
  },

  // ---- Predators ----
  {
    id: 'pike-cichlid', name: 'Pike Cichlid', emoji: '🦈', type: 'fish', rarity: 'rare', cost: 8,
    shape: row(3), stats: { attack: 7, health: 5, speed: 5 },
    tags: ['predator'], traits: ['predator'],
    text: ['Heals 2 HP when it KOs a smaller fish'],
  },
  {
    id: 'oscar', name: 'Oscar', emoji: '🐋', type: 'fish', rarity: 'epic', cost: 10,
    shape: square, stats: { attack: 8, health: 12, speed: 3 },
    tags: ['predator'], traits: ['bully'], water: -2,
    text: ['Bully: +1 ATK per adjacent fish', 'Messy: -2 water quality'],
  },
  {
    id: 'arowana', name: 'Arowana', emoji: '🐉', type: 'fish', rarity: 'legendary', cost: 12,
    shape: row(4), stats: { attack: 10, health: 10, speed: 8 },
    tags: ['predator'], traits: ['hunter'],
    text: ['Hunter: always attacks the weakest enemy fish'],
  },

  // ---- Bottom dwellers ----
  {
    id: 'bristlenose-pleco', name: 'Bristlenose Pleco', emoji: '🦎', type: 'fish', rarity: 'uncommon', cost: 4,
    shape: row(2), stats: { attack: 1, health: 7, speed: 2 },
    tags: ['bottom'], traits: ['cleaner', 'algae-eater'], water: 0,
    text: ['Cleaner: does not pollute the water', '+1 HP per adjacent plant'],
  },

  // ---- Plants ----
  {
    id: 'java-fern', name: 'Java Fern', emoji: '🌿', type: 'plant', rarity: 'common', cost: 3,
    shape: square, stats: { attack: 0, health: 8, speed: 0 },
    tags: ['plant'], traits: [], aura: { attack: 1, health: 1 },
    text: ['Adjacent fish +1 ATK and +1 HP'],
  },
  {
    id: 'moss-ball', name: 'Moss Ball', emoji: '🟢', type: 'plant', rarity: 'common', cost: 2,
    shape: row(1), stats: { attack: 0, health: 4, speed: 0 },
    tags: ['plant'], traits: [], aura: { health: 1 },
    text: ['Adjacent fish +1 HP'],
  },
  {
    id: 'anubias', name: 'Anubias', emoji: '🍃', type: 'plant', rarity: 'uncommon', cost: 4,
    shape: col(2), stats: { attack: 0, health: 6, speed: 0 },
    tags: ['plant'], traits: [], aura: { health: 2 },
    text: ['Adjacent fish +2 HP'],
  },
  {
    id: 'vallisneria', name: 'Vallisneria', emoji: '🌾', type: 'plant', rarity: 'uncommon', cost: 4,
    shape: col(3), stats: { attack: 0, health: 5, speed: 0 },
    tags: ['plant'], traits: [], aura: { speed: 2 },
    text: ['Adjacent fish +2 SPD'],
  },
  {
    id: 'amazon-sword', name: 'Amazon Sword', emoji: '🌱', type: 'plant', rarity: 'rare', cost: 5,
    shape: col(3), stats: { attack: 0, health: 6, speed: 0 },
    tags: ['plant'], traits: [], aura: { attack: 2 },
    text: ['Adjacent fish +2 ATK'],
  },

  // ---- Equipment ----
  {
    id: 'basic-filter', name: 'Sponge Filter', emoji: '🧽', type: 'equipment', rarity: 'common', cost: 2,
    shape: row(1), stats: { attack: 0, health: 5, speed: 0 },
    tags: ['filter'], traits: ['filter'], water: 1,
    text: ['+1 water quality', 'Adjacent plants give +1 on each stat they buff'],
  },
  {
    id: 'canister-filter', name: 'Canister Filter', emoji: '🛢️', type: 'equipment', rarity: 'rare', cost: 6,
    shape: col(2), stats: { attack: 0, health: 8, speed: 0 },
    tags: ['filter'], traits: ['filter'], water: 3,
    text: ['+3 water quality', 'Adjacent plants give +1 on each stat they buff'],
  },
  {
    id: 'heater', name: 'Heater', emoji: '🌡️', type: 'equipment', rarity: 'uncommon', cost: 3,
    shape: col(2), stats: { attack: 0, health: 4, speed: 0 },
    tags: ['heater'], traits: [], aura: { speed: 2 },
    text: ['Adjacent fish +2 SPD'],
  },
  {
    id: 'driftwood', name: 'Driftwood', emoji: '🪵', type: 'equipment', rarity: 'common', cost: 3,
    shape: row(3), stats: { attack: 0, health: 9, speed: 0 },
    tags: ['decor'], traits: ['decoy'],
    text: ['Decoy: enemies are twice as likely to attack it'],
  },

  // ---- Consumables ----
  {
    id: 'brine-shrimp', name: 'Brine Shrimp', emoji: '🦐', type: 'consumable', rarity: 'common', cost: 2,
    shape: row(1), stats: { attack: 0, health: 0, speed: 0 },
    tags: ['food'], traits: [], aura: { attack: 1 },
    text: ['Eaten at battle start: adjacent fish permanently +1 ATK'],
  },
  {
    id: 'bloodworms', name: 'Bloodworms', emoji: '🪱', type: 'consumable', rarity: 'uncommon', cost: 3,
    shape: row(1), stats: { attack: 0, health: 0, speed: 0 },
    tags: ['food'], traits: [], aura: { health: 2 },
    text: ['Eaten at battle start: adjacent fish permanently +2 HP'],
  },
  {
    id: 'daphnia', name: 'Daphnia', emoji: '🦠', type: 'consumable', rarity: 'uncommon', cost: 3,
    shape: row(1), stats: { attack: 0, health: 0, speed: 0 },
    tags: ['food'], traits: [], aura: { speed: 1, attack: 1 },
    text: ['Eaten at battle start: adjacent fish permanently +1 ATK and +1 SPD'],
  },
];

const BY_ID = new Map(PIECES.map((p) => [p.id, p]));

export function getDef(defId: string): PieceDef {
  const def = BY_ID.get(defId);
  if (!def) throw new Error(`Unknown piece definition: ${defId}`);
  return def;
}

export function hasDef(defId: string): boolean {
  return BY_ID.has(defId);
}
