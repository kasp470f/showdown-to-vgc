import { Generation, Generations, PokemonSet, toID } from '@pkmn/data';
import { Dex, ID, ModData } from '@pkmn/dex';
import type { Species } from '@pkmn/dex-types';
import { Format, GenerationID, LegalLogEntry, ShowdownTeam } from '../types';
import { baseSpeciesId } from './vgc-team-parser';

export async function isLegalTeam(
  team: ShowdownTeam,
  genNum: GenerationID,
  format: Format = undefined,
): Promise<Array<LegalLogEntry[]> | undefined> {
  if (!team || !team.team || team.team.length === 0) {
    return undefined;
  }

  const isChampionsFormat = format === 'champions';
  const generation = await getGeneration(genNum, isChampionsFormat);

  const log = await Promise.all(
    team.team.map((pokemon) => isLegalPokemon(pokemon, genNum, generation, isChampionsFormat)),
  );

  return log.some((entries) => entries.length > 0) ? log : undefined;
}

async function getGeneration(
  genNum: GenerationID,
  isChampionsFormat: boolean,
): Promise<Generation | undefined> {
  if (!isChampionsFormat) {
    return new Generations(Dex).get(genNum);
  }

  // Generations.get() resolves its dex through forGen(), which returns the cached standard dex and
  // drops the mod data, so the champions Generation has to be built from the modded dex directly.
  const championsMod = (await import('@pkmn/mods/champions')) as ModData;
  return new Generation(Dex.mod('champions' as ID, championsMod), Generations.DEFAULT_EXISTS);
}

async function isLegalPokemon(
  pokemon: Partial<PokemonSet<string>>,
  genNum: GenerationID,
  generation: Generation | undefined,
  isChampionsFormat: boolean,
): Promise<LegalLogEntry[]> {
  const speciesName = pokemon.species;
  if (!speciesName) {
    return [illegalEntry(pokemon, 'Pokemon has no species set.')];
  }

  if (!generation) {
    return [illegalEntry(pokemon, `Unable to load dex data for generation ${genNum}.`)];
  }

  const entries: LegalLogEntry[] = [];

  const itemEntry = checkItem(pokemon, generation);
  if (itemEntry) entries.push(itemEntry);

  // Mega/Primal formes only exist as their own pokedex entry in the champions format; elsewhere
  // they're filtered out by the dex's default exists rules, so fall back to the base species.
  let species = generation.species.get(speciesName);
  let listedAsMega = false;

  if (!species && !isChampionsFormat) {
    const baseId = baseSpeciesId(speciesName);
    if (baseId !== speciesName) {
      species = generation.species.get(baseId);
      listedAsMega = !!species;
    }
  }

  if (!species) {
    entries.push(illegalEntry(pokemon, `'${speciesName}' is not in the format's pokedex.`));
    return entries;
  }

  const abilityEntry = checkAbility(pokemon, species, generation);
  if (abilityEntry) entries.push(abilityEntry);

  entries.push(...(await checkMoves(pokemon, species, generation)));

  const hasIssues = entries.length > 0;
  if (!hasIssues) {
    entries.push(
      listedAsMega
        ? {
            pokemon: speciesName,
            legality: 'non_mega_form_legal',
            reason: `'${speciesName}' must be listed as its base form '${species.name}' with the Mega Stone as its held item on the teamsheet.`,
          }
        : { pokemon: speciesName, legality: 'legal' },
    );
  }

  return entries;
}

function checkAbility(
  pokemon: Partial<PokemonSet<string>>,
  species: Species,
  generation: Generation,
): LegalLogEntry | undefined {
  if (!pokemon.ability) return undefined;

  const ability = generation.abilities.get(pokemon.ability);
  if (!ability) {
    return illegalEntry(pokemon, `Ability '${pokemon.ability}' does not exist in this format.`);
  }

  const legalAbilities = Object.values(species.abilities)
    .filter((name): name is string => !!name)
    .map((name) => toID(name));

  if (!legalAbilities.includes(ability.id)) {
    return illegalEntry(
      pokemon,
      `${species.name} cannot have the ability '${ability.name}' in this format.`,
    );
  }

  return undefined;
}

function checkItem(
  pokemon: Partial<PokemonSet<string>>,
  generation: Generation,
): LegalLogEntry | undefined {
  if (!pokemon.item) return undefined;

  const item = generation.items.get(pokemon.item);
  if (!item) {
    return illegalEntry(pokemon, `Item '${pokemon.item}' does not exist in this format.`);
  }

  return undefined;
}

async function checkMoves(
  pokemon: Partial<PokemonSet<string>>,
  species: Species,
  generation: Generation,
): Promise<LegalLogEntry[]> {
  const moves = pokemon.moves ?? [];

  const results = await Promise.all(
    moves.map(async (moveName): Promise<LegalLogEntry | undefined> => {
      const move = generation.moves.get(moveName);
      if (!move) {
        return illegalEntry(pokemon, `Move '${moveName}' does not exist in this format.`);
      }

      const canLearn = await generation.learnsets.canLearn(species.id, move);
      if (!canLearn) {
        return illegalEntry(pokemon, `${species.name} cannot learn '${move.name}' in this format.`);
      }

      return undefined;
    }),
  );

  return results.filter((entry): entry is LegalLogEntry => !!entry);
}

function illegalEntry(pokemon: Partial<PokemonSet<string>>, reason: string): LegalLogEntry {
  return { pokemon: pokemon.species ?? 'Unknown', legality: 'illegal', reason };
}
