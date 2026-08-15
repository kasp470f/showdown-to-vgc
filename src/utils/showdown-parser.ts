import { Generations } from '@pkmn/data';
import { Dex } from '@pkmn/dex';
import { Team } from '@pkmn/sets';
import type { ShowdownTeam } from '../types/showdown-team';
import { GenerationID } from '../types/format';

export function getShowdownTeam(text: string, genNum: GenerationID): ShowdownTeam | undefined {
  try {
    const gens = new Generations(Dex);
    const gen = gens.get(genNum);

    const teamImport = Team.fromString(text, gen as never);
    if (!teamImport) {
      throw new Error('Failed to parse team. Please check the format and try again.');
    }

    const normalizedTeam = Array.isArray(teamImport)
      ? teamImport
      : (teamImport as { team?: Array<unknown> }).team ?? [];

    return { team: normalizedTeam as ShowdownTeam['team'] };
  } catch (error) {
    console.error(error);
  }
}
