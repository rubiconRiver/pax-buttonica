/**
 * Public objectives from the base game and Prophecy of Kings. Names are the
 * cards' names; the requirement is written here in our own words as a reminder
 * you can read from across the table. The card on the table is the authority.
 * Anything missing (another expansion, a house rule) can be added in-game as a
 * custom objective.
 */
export interface ObjectiveCard {
  id: string;
  stage: 1 | 2;
  name: string;
  text: string;
  set: 'base' | 'pok';
}

const card = (stage: 1 | 2, set: 'base' | 'pok', name: string, text: string): ObjectiveCard => ({
  id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  stage,
  name,
  text,
  set,
});

export const OBJECTIVE_CARDS: ObjectiveCard[] = [
  // Stage I — 1 point
  card(1, 'base', 'Corner the Market', 'Control 4 planets that all share one trait.'),
  card(1, 'base', 'Develop Weaponry', 'Own 2 unit upgrade technologies.'),
  card(1, 'base', 'Diversify Research', 'Own 2 technologies in each of 2 colours.'),
  card(1, 'base', 'Erect a Monument', 'Spend 8 resources.'),
  card(1, 'base', 'Expand Borders', 'Control 6 planets outside home systems.'),
  card(1, 'base', 'Found Research Outposts', 'Control 3 planets with technology specialties.'),
  card(1, 'base', 'Intimidate Council', 'Have ships in 2 systems adjacent to Mecatol Rex.'),
  card(1, 'base', 'Lead from the Front', 'Spend 3 command tokens from your tactic and/or strategy pools.'),
  card(1, 'base', 'Negotiate Trade Routes', 'Spend 5 trade goods.'),
  card(1, 'base', 'Sway the Council', 'Spend 8 influence.'),
  card(1, 'pok', 'Amass Wealth', 'Spend 3 influence, 3 resources and 3 trade goods.'),
  card(1, 'pok', 'Build Defenses', 'Have 4 or more structures.'),
  card(1, 'pok', 'Discover Lost Outposts', 'Control 2 planets that have attachments.'),
  card(1, 'pok', 'Engineer a Marvel', 'Have your flagship or a war sun on the board.'),
  card(1, 'pok', 'Explore Deep Space', 'Have units in 3 systems that contain no planets.'),
  card(1, 'pok', 'Improve Infrastructure', 'Have structures on 3 planets outside your home system.'),
  card(1, 'pok', 'Make History', 'Have units in 2 systems containing a legendary planet, Mecatol Rex or an anomaly.'),
  card(1, 'pok', 'Populate the Outer Rim', 'Have units in 3 systems on the edge of the board, not counting your home system.'),
  card(1, 'pok', 'Push Boundaries', 'Control more planets than each of 2 of your neighbours.'),
  card(1, 'pok', 'Raise a Fleet', 'Have 5 or more non-fighter ships in 1 system.'),
  // Stage II — 2 points
  card(2, 'base', 'Centralize Galactic Trade', 'Spend 10 trade goods.'),
  card(2, 'base', 'Conquer the Weak', "Control 1 planet in another player's home system."),
  card(2, 'base', 'Form Galactic Brain Trust', 'Control 5 planets with technology specialties.'),
  card(2, 'base', 'Found a Golden Age', 'Spend 16 resources.'),
  card(2, 'base', 'Galvanize the People', 'Spend 6 command tokens from your tactic and/or strategy pools.'),
  card(2, 'base', 'Manipulate Galactic Law', 'Spend 16 influence.'),
  card(2, 'base', 'Master the Sciences', 'Own 2 technologies in each of 4 colours.'),
  card(2, 'base', 'Revolutionize Warfare', 'Own 3 unit upgrade technologies.'),
  card(2, 'base', 'Subdue the Galaxy', 'Control 11 planets outside home systems.'),
  card(2, 'base', 'Unify the Colonies', 'Control 6 planets that all share one trait.'),
  card(2, 'pok', 'Achieve Supremacy', "Have your flagship or a war sun in another player's home system or on Mecatol Rex's system."),
  card(2, 'pok', 'Become a Legend', 'Have units in 4 systems containing a legendary planet, Mecatol Rex or an anomaly.'),
  card(2, 'pok', 'Command an Armada', 'Have 8 or more non-fighter ships in 1 system.'),
  card(2, 'pok', 'Construct Massive Cities', 'Have 7 or more structures.'),
  card(2, 'pok', 'Control the Borderlands', 'Have units in 5 systems on the edge of the board, not counting your home system.'),
  card(2, 'pok', 'Hold Vast Reserves', 'Spend 6 influence, 6 resources and 6 trade goods.'),
  card(2, 'pok', 'Patrol Vast Territories', 'Have units in 5 systems that contain no planets.'),
  card(2, 'pok', 'Protect the Border', 'Have structures on 5 planets outside your home system.'),
  card(2, 'pok', 'Reclaim Ancient Monuments', 'Control 3 planets that have attachments.'),
  card(2, 'pok', 'Rule Distant Lands', "Control 2 planets, each in or next to a different other player's home system."),
];

/** Names only: effects vary with who or what was elected, so the table writes those in. */
export const LAW_NAMES = [
  'Anti-Intellectual Revolution', 'Articles of War', 'Checks and Balances', 'Classified Document Leaks', 'Committee Formation',
  'Conventions of War', 'Core Mining', 'Demilitarized Zone', 'Enforced Travel Ban', 'Executive Sanctions', 'Fleet Regulations',
  'Holy Planet of Ixth', 'Homeland Defense Act', 'Imperial Arbiter', 'Minister of Commerce', 'Minister of Exploration',
  'Minister of Industry', 'Minister of Peace', 'Minister of Policy', 'Minister of Sciences', 'Minister of War', 'Nexus Sovereignty',
  'Political Censure', 'Prophecy of Ixth', 'Publicize Weapon Schematics', 'Regulated Conscription', 'Representative Government',
  'Research Team: Biotic', 'Research Team: Cybernetic', 'Research Team: Propulsion', 'Research Team: Warfare', 'Search Warrant',
  'Senate Sanctuary', 'Shard of the Throne', 'Shared Research', 'Terraforming Initiative', 'The Crown of Emphidia',
  'The Crown of Thalnos', 'Wormhole Reconstruction',
];

/** Common places points come from besides objectives. */
export const EXTRA_POINT_SOURCES = ['Custodians of Mecatol Rex', 'Imperial (holding Mecatol Rex)', 'Support for the Throne', 'Shard of the Throne', 'The Crown of Emphidia', 'Agenda', 'Action card', 'Relic'];
