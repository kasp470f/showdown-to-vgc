import { Generations } from '@pkmn/data';
import { Dex } from '@pkmn/dex';
import { Team } from '@pkmn/sets';
import type { ShowdownTeam } from '../types/showdown-team';
import { GenerationID } from '../types/format';

/** Strip Mega form suffixes (e.g. "-Mega", "-Mega-X", "-Mega-Y", "-Mega-Z") from species names. */
function normalizeSpeciesName(name: string): string {
  return name.replace(/-Mega(?:-[XYZ])?$/, '');
}

export function getShowdownTeam(text: string, genNum: GenerationID): ShowdownTeam | undefined {
  try {
    const gens = new Generations(Dex);
    const gen = gens.get(genNum);

    const teamImport = Team.fromString(text, gen as never);
    if (!teamImport) {
      throw new Error('Failed to parse team. Please check the format and try again.');
    }

    const rawTeam = Array.isArray(teamImport)
      ? teamImport
      : (teamImport as { team?: Array<unknown> }).team ?? [];

    // Normalize species names (e.g., "Swampert-Mega" → "Swampert")
    const normalizedTeam = rawTeam.map((set) => ({
      ...set,
      species: normalizeSpeciesName((set as { species?: string }).species ?? ''),
    }));

    return { team: normalizedTeam as ShowdownTeam['team'] };
  } catch (error) {
    console.error(error);
  }
}
