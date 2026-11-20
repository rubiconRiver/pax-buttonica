/**
 * The secret objective deck that /secrets deals from. One line per card: its title and what the card says.
 * To change the deck, edit this list and nothing else: a card's title and text are copied into a deal when it
 * is made, so deals already out are not disturbed.
 *
 * As it stands: the 20 secrets of the base game and the 20 of Prophecy of Kings. The data the AsyncTI4 bot plays
 * Thunder's Edge games with has no secrets of Thunder's Edge's own, so a Thunder's Edge game uses these 40.
 * `phase` (when the card is scored) is shown as a small label and may be left out.
 */
export interface DeckCard {
  name: string;
  text: string;
  phase?: 'Action' | 'Status' | 'Agenda';
  set: 'base' | 'pok';
}

export const SECRET_DECK: DeckCard[] = [
  // ── Base game ─────────────────────────────────────────────────────────────
  { set: 'base', phase: 'Status', name: 'Adapt New Strategies', text: 'Own 2 faction technologies. (Valefar Assimilator technologies do not count toward this objective.)' },
  { set: 'base', phase: 'Status', name: 'Become the Gatekeeper', text: 'Have 1 or more ships in a system that contains an alpha wormhole and 1 or more ships in a system that contains a beta wormhole.' },
  { set: 'base', phase: 'Status', name: 'Control the Region', text: 'Have 1 or more ships in 6 systems.' },
  { set: 'base', phase: 'Status', name: 'Cut Supply Lines', text: "Have 1 or more ships in the same system as another player's space dock." },
  { set: 'base', phase: 'Action', name: 'Destroy Their Greatest Ship', text: "Destroy another player's war sun or flagship." },
  { set: 'base', phase: 'Status', name: 'Establish a Perimeter', text: 'Have 4 PDS units on the game board.' },
  { set: 'base', phase: 'Status', name: 'Forge an Alliance', text: 'Control 4 cultural planets.' },
  { set: 'base', phase: 'Status', name: 'Form a Spy Network', text: 'Discard 5 action cards.' },
  { set: 'base', phase: 'Status', name: 'Fuel the War Machine', text: 'Have 3 space docks on the game board.' },
  { set: 'base', phase: 'Status', name: 'Gather a Mighty Fleet', text: 'Have 5 dreadnoughts on the game board.' },
  { set: 'base', phase: 'Status', name: 'Learn the Secrets of the Cosmos', text: 'Have 1 or more ships in 3 systems that are each adjacent to an anomaly.' },
  { set: 'base', phase: 'Action', name: 'Make an Example of Their World', text: "Destroy the last of a player's ground forces on a planet during the bombardment step." },
  { set: 'base', phase: 'Status', name: 'Master the Laws of Physics', text: 'Own 4 technologies of the same color.' },
  { set: 'base', phase: 'Status', name: 'Mine Rare Metals', text: 'Control 4 hazardous planets.' },
  { set: 'base', phase: 'Status', name: 'Monopolize Production', text: 'Control 4 industrial planets.' },
  { set: 'base', phase: 'Status', name: 'Occupy the Seat of the Empire', text: 'Control Mecatol Rex and have 3 or more ships in its system.' },
  { set: 'base', phase: 'Action', name: 'Spark a Rebellion', text: 'Win a combat against a player who has the most victory points.' },
  { set: 'base', phase: 'Status', name: 'Threaten Enemies', text: "Have 1 or more ships in a system that is adjacent to another player's home system." },
  { set: 'base', phase: 'Action', name: 'Turn Their Fleets to Dust', text: "Destroy the last of a player's non-fighter ships in the active system during the space cannon offense step." },
  { set: 'base', phase: 'Action', name: 'Unveil Flagship', text: 'Win a space combat in a system that contains your flagship. You cannot score this objective if your flagship is destroyed in the combat.' },

  // ── Prophecy of Kings ─────────────────────────────────────────────────────
  { set: 'pok', phase: 'Action', name: 'Become a Martyr', text: 'Lose control of a planet in a home system.' },
  { set: 'pok', phase: 'Action', name: 'Betray a Friend', text: 'Win a combat against a player whose promissory note you had in your play area at the start of your tactical action.' },
  { set: 'pok', phase: 'Action', name: 'Brave the Void', text: 'Win a combat in an anomaly.' },
  { set: 'pok', phase: 'Action', name: 'Darken the Skies', text: "Win a combat in another player's home system." },
  { set: 'pok', phase: 'Status', name: 'Defy Space and Time', text: 'Have units in the wormhole nexus.' },
  { set: 'pok', phase: 'Action', name: 'Demonstrate Your Power', text: 'Have 3 or more non-fighter ships in the active system at the end of a space combat.' },
  { set: 'pok', phase: 'Status', name: 'Destroy Heretical Works', text: 'Purge 2 of your relic fragments of any type.' },
  { set: 'pok', phase: 'Agenda', name: 'Dictate Policy', text: 'There are 3 or more laws in play.' },
  { set: 'pok', phase: 'Agenda', name: 'Drive the Debate', text: 'You or a planet you control are elected by an agenda.' },
  { set: 'pok', phase: 'Status', name: 'Establish Hegemony', text: 'Control planets that have a combined influence value of at least 12.' },
  { set: 'pok', phase: 'Action', name: 'Fight with Precision', text: "Destroy the last of a player's fighters in the active system during the anti-fighter barrage step." },
  { set: 'pok', phase: 'Status', name: 'Foster Cohesion', text: 'Be neighbors with all other players.' },
  { set: 'pok', phase: 'Status', name: 'Hoard Raw Materials', text: 'Control planets that have a combined resource value of at least 12.' },
  { set: 'pok', phase: 'Status', name: 'Mechanize the Military', text: 'Have 1 mech on each of 4 planets.' },
  { set: 'pok', phase: 'Status', name: 'Occupy the Fringe', text: 'Have 9 or more ground forces on a planet that does not contain 1 of your space docks.' },
  { set: 'pok', phase: 'Status', name: 'Produce en Masse', text: 'Have units with a combined PRODUCTION value of at least 8 in a single system.' },
  { set: 'pok', phase: 'Action', name: 'Prove Endurance', text: 'Be the last player to pass during a game round.' },
  { set: 'pok', phase: 'Status', name: 'Seize an Icon', text: 'Control a legendary planet.' },
  { set: 'pok', phase: 'Status', name: 'Stake Your Claim', text: 'Control a planet in a system that contains a planet controlled by another player.' },
  { set: 'pok', phase: 'Status', name: 'Strengthen Bonds', text: "Have another player's promissory note in your play area." },
];
