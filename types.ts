
export type ShiftPeriod = 'Mañana' | 'Tarde';

export interface EventRecord {
  semana: number;
  tipo: 'falta' | 'extra' | 'cumplido';
  monto: number;
}

export interface Person {
  id: string;
  nombre: string;
  faltas: number;
  faltasConsecutivas: number;
  cumplidos: number;
  pagoFaltas: number;
  pagoExtra: number;
  eliminado: boolean;
  historial: EventRecord[]; // Registro histórico para cierres de ciclo
}

export interface Shift {
  dia: string;
  periodo: ShiftPeriod;
  personas: string[]; 
  reemplazos: Record<string, string>; 
}

export interface WeeklySchedule {
  semana: number;
  turnos: Shift[];
}

export interface AppState {
  personas: Person[];
  horarios: WeeklySchedule[];
  semanaActual: number;
}
