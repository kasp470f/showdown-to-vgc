export interface LegalLogEntry {
  pokemon: string;
  legality: 'legal' | 'illegal' | 'non_mega_form_legal';
  reason?: string;
}
