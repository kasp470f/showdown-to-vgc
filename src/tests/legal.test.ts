import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { PokemonSet } from '@pkmn/data';

import { isLegalTeam } from '../utils/legal';
import { isLegalTeam as packageIsLegalTeam } from '../index';
import type { Format, GenerationID, LegalLogEntry } from '../types';

const genNum = 9;

function pokemon(overrides: Partial<PokemonSet<string>>): Partial<PokemonSet<string>> {
  return { level: 50, ...overrides };
}

async function legalityOf(
  set: Partial<PokemonSet<string>>,
  gen: GenerationID = genNum,
  format?: Format,
): Promise<LegalLogEntry[]> {
  const result = await isLegalTeam({ team: [pokemon(set)] }, gen, format);
  if (!result) throw new Error('result should be defined');
  const entries = result[0];
  if (!entries) throw new Error('entries should be defined');
  return entries;
}

test('isLegalTeam marks a clean Pokemon as legal', async () => {
  const entries = await legalityOf({
    species: 'Pikachu',
    ability: 'Static',
    item: 'Light Ball',
    moves: ['Volt Tackle', 'Quick Attack'],
  });

  assert.deepEqual(entries, [{ pokemon: 'Pikachu', legality: 'legal' }]);
});

test('isLegalTeam reports every violation for a Pokemon with multiple problems', async () => {
  const entries = await legalityOf({
    species: 'Pikachu',
    ability: 'Blaze',
    item: 'Light Ball',
    moves: ['Fire Blast', 'Not A Real Move'],
  });

  assert.equal(entries.length, 3);
  assert.ok(entries.every((entry) => entry.legality === 'illegal'));
  assert.ok(entries.some((entry) => entry.reason?.includes("cannot have the ability 'Blaze'")));
  assert.ok(entries.some((entry) => entry.reason?.includes("cannot learn 'Fire Blast'")));
  assert.ok(
    entries.some((entry) => entry.reason?.includes("Move 'Not A Real Move' does not exist")),
  );
});

test('isLegalTeam flags an item that does not exist in the format', async () => {
  const entries = await legalityOf({
    species: 'Pikachu',
    ability: 'Static',
    item: 'Not A Real Item',
    moves: ['Quick Attack'],
  });

  assert.deepEqual(entries, [
    {
      pokemon: 'Pikachu',
      legality: 'illegal',
      reason: "Item 'Not A Real Item' does not exist in this format.",
    },
  ]);
});

test('isLegalTeam flags an ability that does not exist in the format', async () => {
  const entries = await legalityOf({
    species: 'Pikachu',
    ability: 'Not A Real Ability',
    moves: [],
  });

  assert.deepEqual(entries, [
    {
      pokemon: 'Pikachu',
      legality: 'illegal',
      reason: "Ability 'Not A Real Ability' does not exist in this format.",
    },
  ]);
});

test('isLegalTeam flags a species that is not in the pokedex', async () => {
  const entries = await legalityOf({ species: 'Missingno', moves: [] });

  assert.deepEqual(entries, [
    {
      pokemon: 'Missingno',
      legality: 'illegal',
      reason: "'Missingno' is not in the format's pokedex.",
    },
  ]);
});

test('isLegalTeam flags a Pokemon with no species set', async () => {
  const entries = await legalityOf({ moves: [] });

  assert.deepEqual(entries, [
    { pokemon: 'Unknown', legality: 'illegal', reason: 'Pokemon has no species set.' },
  ]);
});

test('isLegalTeam downgrades a directly-listed Mega to non_mega_form_legal outside champions', async () => {
  const entries = await legalityOf({
    species: 'Garchomp-Mega',
    ability: 'Sand Veil',
    item: 'Leftovers',
    moves: ['Earthquake', 'Dragon Claw', 'Stealth Rock', 'Protect'],
  });

  assert.deepEqual(entries, [
    {
      pokemon: 'Garchomp-Mega',
      legality: 'non_mega_form_legal',
      reason:
        "'Garchomp-Mega' must be listed as its base form 'Garchomp' with the Mega Stone as its held item on the teamsheet.",
    },
  ]);
});

test('isLegalTeam flags a Mega set with its Mega-exclusive ability and stone outside champions', async () => {
  const entries = await legalityOf({
    species: 'Garchomp-Mega',
    ability: 'Sand Force',
    item: 'Garchompite',
    moves: ['Earthquake'],
  });

  assert.equal(entries.length, 2);
  assert.ok(entries.every((entry) => entry.legality === 'illegal'));
  assert.ok(entries.some((entry) => entry.reason?.includes("Item 'Garchompite' does not exist")));
  assert.ok(
    entries.some((entry) => entry.reason?.includes("cannot have the ability 'Sand Force'")),
  );
});

test('isLegalTeam accepts a directly-listed Mega in champions format', async () => {
  const entries = await legalityOf(
    {
      species: 'Garchomp-Mega',
      ability: 'Sand Force',
      item: 'Garchompite',
      moves: ['Draco Meteor', 'Earth Power', 'Fire Blast', 'Power Gem'],
    },
    genNum,
    'champions',
  );

  assert.deepEqual(entries, [{ pokemon: 'Garchomp-Mega', legality: 'legal' }]);
});

test('isLegalTeam returns undefined for an empty team', async () => {
  const result = await isLegalTeam({ team: [] }, genNum);
  assert.equal(result, undefined);
});

test('isLegalTeam maps each team slot to its own legality entries', async () => {
  const result = await isLegalTeam(
    {
      team: [
        pokemon({
          species: 'Pikachu',
          ability: 'Static',
          item: 'Light Ball',
          moves: ['Quick Attack'],
        }),
        pokemon({
          species: 'Pikachu',
          ability: 'Blaze',
          item: 'Light Ball',
          moves: ['Quick Attack'],
        }),
      ],
    },
    genNum,
  );

  if (!result) throw new Error('result should be defined');
  assert.equal(result.length, 2);
  assert.deepEqual(result[0], [{ pokemon: 'Pikachu', legality: 'legal' }]);

  const secondSlot = result[1];
  if (!secondSlot) throw new Error('second slot should be defined');
  assert.equal(secondSlot.length, 1);
  assert.equal(secondSlot[0]?.legality, 'illegal');
});

test('the package root exposes isLegalTeam', () => {
  assert.equal(typeof packageIsLegalTeam, 'function');
});
