export interface AssistantSource { id: string; title: string; href: string; read: boolean }
export interface AssistantTable {
  kind: 'table'; title: string; columns: string[]; rows: string[][];
  /** One canonical source link for each row, supplied by the data adapter. */
  links?: string[];
}
export interface AssistantChart {
  kind: 'progress'; title: string; event: string; metric: 'single' | 'average';
  points: Array<{ date: string; value: number; label: string; person: string }>;
}
export type AssistantArtifact = AssistantTable | AssistantChart;
export interface AssistantAnswer {
  answer: string; sources: AssistantSource[]; artifacts?: AssistantArtifact[];
}
export interface AssistantMessage { role: 'user' | 'assistant'; content: string }
