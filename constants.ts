
import { ShiftPeriod } from './types';

export const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
export const PERIODOS: ShiftPeriod[] = ["Mañana", "Tarde"];
export const COSTO_FALTA = 50000;
export const MAX_FALTAS_CONSECUTIVAS = 3;
export const PERSONAS_POR_TURNO = 2;
export const SEMANAS_POR_CICLO = 3;
export const TOTAL_SEMANAS = 105; // 35 ciclos de 3 semanas (Cubre 2026 y 2027 completo)

export const START_DATE_APP = new Date(2026, 0, 1); // 1 de Enero de 2026

export const INITIAL_PEOPLE = Array.from({ length: 18 }, (_, i) => `Persona ${i + 1}`);
