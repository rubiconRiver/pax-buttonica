// Static game data. Names are used factually; no artwork or card text is reproduced.

export interface StrategyCard {
  n: number;
  name: string;
  color: string;
  /** One-line reminder in our own words — enough to jog memory at the table. */
  primary: string;
  secondary: string;
}

export const STRATEGY_CARDS: StrategyCard[] = [
  { n: 1, name: 'Leadership', color: '#e5484d', primary: 'Gain 3 command tokens, buy more with influence.', secondary: 'Buy command tokens with influence.' },
  { n: 2, name: 'Diplomacy', color: '#f08c3a', primary: 'Lock down a system, ready two planets.', secondary: 'Spend a token to ready two planets.' },
  { n: 3, name: 'Politics', color: '#f2cc45', primary: 'Pick the speaker, draw action cards, peek at agendas.', secondary: 'Spend a token to draw two action cards.' },
  { n: 4, name: 'Construction', color: '#46b86c', primary: 'Place a space dock or PDS, then one more PDS.', secondary: 'Spend a token in a system to place one structure there.' },
  { n: 5, name: 'Trade', color: '#2ec4b0', primary: 'Gain 3 trade goods, refresh commodities, pick who gets the secondary free.', secondary: 'Spend a token to refresh commodities.' },
  { n: 6, name: 'Warfare', color: '#3b9bf5', primary: 'Pull a token off the board, shuffle your pools.', secondary: 'Spend a token to produce at home.' },
  { n: 7, name: 'Technology', color: '#5468f0', primary: 'Research a tech, pay 6 for a second.', secondary: 'Spend a token and 4 resources to research.' },
  { n: 8, name: 'Imperial', color: '#a562f0', primary: 'Score a public objective; 1 VP if you control Mecatol Rex, else draw a secret.', secondary: 'Spend a token to draw a secret objective.' },
];

export const cardByNumber = (n: number): StrategyCard => STRATEGY_CARDS[n - 1];

export interface PlayerColor {
  id: string;
  name: string;
  /** The colour the LED actually shows. Black plastic gets a white light. */
  led: string;
}

export const PLAYER_COLORS: PlayerColor[] = [
  { id: 'red', name: 'Red', led: '#ff3b3b' },
  { id: 'orange', name: 'Orange', led: '#ff8a1f' },
  { id: 'yellow', name: 'Yellow', led: '#ffd21f' },
  { id: 'green', name: 'Green', led: '#2fe06b' },
  { id: 'blue', name: 'Blue', led: '#2f8cff' },
  { id: 'purple', name: 'Purple', led: '#a24bff' },
  { id: 'pink', name: 'Pink', led: '#ff5fc4' },
  { id: 'black', name: 'Black', led: '#e9f0ff' },
];

export const colorById = (id: string): PlayerColor =>
  PLAYER_COLORS.find((c) => c.id === id) ?? PLAYER_COLORS[0];

export interface FactionGroup {
  label: string;
  factions: string[];
}

export const FACTION_GROUPS: FactionGroup[] = [
  {
    label: 'Base game',
    factions: [
      'The Arborec',
      'The Barony of Letnev',
      'The Clan of Saar',
      'The Embers of Muaat',
      'The Emirates of Hacan',
      'The Federation of Sol',
      'The Ghosts of Creuss',
      'The L1Z1X Mindnet',
      'The Mentak Coalition',
      'The Naalu Collective',
      'The Nekro Virus',
      "Sardakk N'orr",
      'The Universities of Jol-Nar',
      'The Winnu',
      'The Xxcha Kingdom',
      'The Yin Brotherhood',
      'The Yssaril Tribes',
    ],
  },
  {
    label: 'Prophecy of Kings',
    factions: [
      'The Argent Flight',
      'The Empyrean',
      'The Mahact Gene-Sorcerers',
      'The Naaz-Rokha Alliance',
      'The Nomad',
      'The Titans of Ul',
      "The Vuil'raith Cabal",
    ],
  },
  { label: 'Codex', factions: ['The Council Keleres'] },
  {
    label: "Thunder's Edge",
    factions: [
      'The Crimson Rebellion',
      'The Deepwrought Scholarate',
      'The Firmament',
      'The Last Bastion',
      'The Ral Nel Consortium',
    ],
  },
];

export const NAALU = 'The Naalu Collective';

export const STATUS_STEPS = [
  'Score objectives, in initiative order',
  'Reveal a public objective',
  'Draw an action card',
  'Pull command tokens off the board',
  'Gain 2 command tokens, redistribute',
  'Ready all cards',
  'Repair units',
  'Return strategy cards',
];
