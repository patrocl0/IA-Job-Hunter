import type { Tracking } from './TrackingEditor';
export type Result = {
  mode: 'demo' | 'openai';
  score: number | null;
  summary: string;
  matches: string[];
  gaps: string[];
  nextSteps: string[];
  tailoredSummary: string;
  recruiterMessage: string;
};
export type Analysis = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  result: Result;
  tracking?: Tracking;
};
export type Stats = {
  total: number;
  applied: number;
  interviews: number;
  offers: number;
  due: number;
};
export type AnalysisPage = {
  items: Analysis[];
  total: number;
  page: number;
  pages: number;
  stats: Stats;
};
export const statuses = ['Guardada', 'Postulada', 'Entrevista', 'Oferta', 'Descartada'];
