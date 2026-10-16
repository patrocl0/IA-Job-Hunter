import { LayoutDashboard, Compass, BriefcaseBusiness, UserRound, Sparkles } from 'lucide-react';
export const navigation = [
  { id: 'overview', title: 'Resumen', icon: LayoutDashboard },
  { id: 'vacancies', title: 'Explorar vacantes', icon: Compass },
  { id: 'applications', title: 'Mis oportunidades', icon: BriefcaseBusiness },
  { id: 'profile', title: 'Mi perfil', icon: UserRound },
  { id: 'analysis', title: 'Nuevo análisis', icon: Sparkles },
] as const;
export type Page = (typeof navigation)[number]['id'];
