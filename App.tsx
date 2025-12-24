
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Person, AppState, EventRecord } from './types';
import { DIAS, INITIAL_PEOPLE, COSTO_FALTA, MAX_FALTAS_CONSECUTIVAS, TOTAL_SEMANAS, SEMANAS_POR_CICLO } from './constants';
import { generateSchedule, formatCurrency, getShiftDate } from './services/scheduleService';
import { StatCard } from './components/StatCard';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem('vigilancia_state_v3');
    if (saved) return JSON.parse(saved);

    const initialPeople: Person[] = INITIAL_PEOPLE.map((name, i) => ({
      id: `p-${i}`,
      nombre: name,
      faltas: 0,
      faltasConsecutivas: 0,
      cumplidos: 0,
      pagoFaltas: 0,
      pagoExtra: 0,
      eliminado: false,
      historial: []
    }));

    return {
      personas: initialPeople,
      horarios: generateSchedule(initialPeople),
      semanaActual: 1
    };
  });

  const [view, setView] = useState<'horario' | 'personas' | 'resumen'>('horario');
  const [selectedShift, setSelectedShift] = useState<{ weekIdx: number, shiftIdx: number } | null>(null);
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [showFaltaModal, setShowFaltaModal] = useState(false);
  const [editPerson, setEditPerson] = useState<Person | null>(null);
  const [resumenCiclo, setResumenCiclo] = useState(1);

  // Persistencia
  useEffect(() => {
    localStorage.setItem('vigilancia_state_v3', JSON.stringify(state));
  }, [state]);

  const handleRegenerate = useCallback(() => {
    if (window.confirm("¿REGENERAR HORARIOS? Se reasignarán todos los turnos desde el inicio (Enero 2026) basándose en el personal actual.")) {
      setState(prev => ({
        ...prev,
        horarios: generateSchedule(prev.personas)
      }));
    }
  }, []);

  const currentSchedule = useMemo(() => 
    state.horarios.find(s => s.semana === state.semanaActual),
    [state.horarios, state.semanaActual]
  );

  const updatePersonName = (id: string, newName: string) => {
    setState(prev => ({
      ...prev,
      personas: prev.personas.map(p => p.id === id ? { ...p, nombre: newName } : p)
    }));
    setEditPerson(null);
  };

  const markFulfillment = (personId: string, weekNum: number) => {
    setState(prev => ({
      ...prev,
      personas: prev.personas.map(p => {
        if (p.id === personId) {
          const newHistory: EventRecord[] = [...p.historial, { semana: weekNum, tipo: 'cumplido', monto: 0 }];
          return { ...p, cumplidos: p.cumplidos + 1, faltasConsecutivas: 0, historial: newHistory };
        }
        return p;
      })
    }));
  };

  const markFalta = (personId: string, weekNum: number) => {
    let personaName = "";
    setState(prev => {
      const newPersonas = prev.personas.map(p => {
        if (p.id === personId) {
          personaName = p.nombre;
          const newHistory: EventRecord[] = [...p.historial, { semana: weekNum, tipo: 'falta', monto: COSTO_FALTA }];
          const newFaltasConsecutivas = p.faltasConsecutivas + 1;
          const isNowEliminated = newFaltasConsecutivas >= MAX_FALTAS_CONSECUTIVAS;
          return {
            ...p,
            faltas: p.faltas + 1,
            faltasConsecutivas: newFaltasConsecutivas,
            pagoFaltas: p.pagoFaltas + COSTO_FALTA,
            eliminado: isNowEliminated,
            historial: newHistory
          };
        }
        return p;
      });
      return { ...prev, personas: newPersonas };
    });
    alert(`Falta registrada para ${personaName}.`);
  };

  const replacePerson = (originalId: string, replacementId: string, weekNum: number, weekIdx: number, shiftIdx: number) => {
    setState(prev => {
      const newPersonas = prev.personas.map(p => {
        if (p.id === originalId) {
          const h: EventRecord[] = [...p.historial, { semana: weekNum, tipo: 'falta', monto: COSTO_FALTA }];
          return { ...p, pagoFaltas: p.pagoFaltas + COSTO_FALTA, faltas: p.faltas + 1, historial: h };
        }
        if (p.id === replacementId) {
          const h: EventRecord[] = [...p.historial, { semana: weekNum, tipo: 'extra', monto: COSTO_FALTA }];
          return { ...p, pagoExtra: p.pagoExtra + COSTO_FALTA, historial: h };
        }
        return p;
      });

      const newHorarios = [...prev.horarios];
      const shift = newHorarios[weekIdx].turnos[shiftIdx];
      shift.reemplazos = { ...shift.reemplazos, [originalId]: replacementId };
      const personIdx = shift.personas.indexOf(originalId);
      if (personIdx > -1) shift.personas[personIdx] = replacementId;

      return { ...prev, personas: newPersonas, horarios: newHorarios };
    });
    setShowReplaceModal(false);
  };

  const getCycleStats = (person: Person, ciclo: number) => {
    const startWeek = (ciclo - 1) * SEMANAS_POR_CICLO + 1;
    const endWeek = ciclo * SEMANAS_POR_CICLO;
    
    return person.historial.reduce((acc, curr) => {
      if (curr.semana >= startWeek && curr.semana <= endWeek) {
        if (curr.tipo === 'falta') acc.debe += curr.monto;
        if (curr.tipo === 'extra') acc.gana += curr.monto;
      }
      return acc;
    }, { debe: 0, gana: 0 });
  };

  const globalTotals = useMemo(() => {
    return state.personas.reduce((acc, p) => ({
      faltas: acc.faltas + p.faltas,
      recaudado: acc.recaudado + p.pagoFaltas,
      cumplidos: acc.cumplidos + p.cumplidos
    }), { faltas: 0, recaudado: 0, cumplidos: 0 });
  }, [state.personas]);

  return (
    <div className="min-h-screen pb-10 bg-slate-50 text-slate-900">
      <header className="bg-slate-900 text-white p-6 shadow-lg sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <i className="fa-solid fa-user-shield text-2xl"></i>
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Vigilancia Pro</h1>
              <p className="text-slate-400 text-sm">Calendario Global 2026-2027</p>
            </div>
          </div>
          <nav className="flex space-x-1 bg-slate-800 p-1 rounded-xl overflow-x-auto no-scrollbar">
            {(['horario', 'personas', 'resumen'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                  view === v ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                {v === 'horario' ? 'Horario' : v === 'personas' ? 'Personal' : 'Cierres de Ciclo'}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-6 pt-8">
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard label="Multas Totales" value={globalTotals.faltas} icon="fa-user-xmark" color="bg-rose-500" />
          <StatCard label="Turnos Cumplidos" value={globalTotals.cumplidos} icon="fa-check-double" color="bg-emerald-500" />
          <StatCard label="Fondo Global" value={formatCurrency(globalTotals.recaudado)} icon="fa-money-bill-trend-up" color="bg-blue-500" />
        </section>

        {view === 'horario' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center space-x-4">
                <span className="font-bold text-slate-700">Semana:</span>
                <select 
                  value={state.semanaActual} 
                  onChange={(e) => setState(prev => ({ ...prev, semanaActual: Number(e.target.value) }))}
                  className="bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg p-2.5 outline-none font-medium"
                >
                  {Array.from({ length: TOTAL_SEMANAS }, (_, i) => i + 1).map(n => (
                    <option key={n} value={n}>Semana {n} {n % 3 === 0 ? '(CIERRE)' : ''}</option>
                  ))}
                </select>
              </div>
              <button 
                onClick={handleRegenerate}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 border border-slate-200"
              >
                <i className="fa-solid fa-arrows-rotate"></i> Regenerar Horario
              </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Fecha y Día</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Turno</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Personal</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {currentSchedule?.turnos.map((shift, idx) => {
                      const dayIdx = Math.floor(idx / 2);
                      const shiftDate = getShiftDate(state.semanaActual, dayIdx);
                      return (
                        <tr key={`${idx}-${state.semanaActual}`} className="hover:bg-slate-50/50 transition">
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-900">{shift.dia}</span>
                              <span className="text-xs text-slate-500 font-medium">{shiftDate}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              shift.periodo === 'Mañana' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'
                            }`}>
                              {shift.periodo === 'Mañana' ? <i className="fa-solid fa-sun mr-1.5"></i> : <i className="fa-solid fa-moon mr-1.5"></i>}
                              {shift.periodo}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="space-y-1">
                              {shift.personas.map(pId => {
                                const p = state.personas.find(x => x.id === pId);
                                const isReplaced = Object.values(shift.reemplazos).includes(pId);
                                return (
                                  <div key={pId} className={`text-sm font-semibold flex items-center gap-2 ${isReplaced ? 'text-blue-600' : 'text-slate-700'}`}>
                                    {p?.nombre}
                                    {isReplaced && <span className="bg-blue-600 text-[9px] text-white px-1.5 py-0.5 rounded font-black">REEMPLAZO</span>}
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-1 md:gap-2">
                              <button onClick={() => { setSelectedShift({ weekIdx: state.semanaActual - 1, shiftIdx: idx }); setShowFaltaModal(true); }} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition" title="Multar"><i className="fa-solid fa-user-xmark"></i></button>
                              <button onClick={() => { setSelectedShift({ weekIdx: state.semanaActual - 1, shiftIdx: idx }); setShowReplaceModal(true); }} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition" title="Reemplazar"><i className="fa-solid fa-people-arrows"></i></button>
                              <button onClick={() => { shift.personas.forEach(pid => markFulfillment(pid, state.semanaActual)); }} className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition" title="Todo OK"><i className="fa-solid fa-check"></i></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {view === 'personas' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
             <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="text-lg font-bold text-slate-800">Censo de Vigilantes</h3>
                <span className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-black uppercase">{state.personas.filter(p => !p.eliminado).length} Activos</span>
             </div>
             <div className="overflow-x-auto">
               <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Nombre</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-center">Faltas</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-center">Turnos OK</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {state.personas.map(p => (
                      <tr key={p.id} className={p.eliminado ? 'opacity-40 grayscale pointer-events-none' : ''}>
                        <td className="px-6 py-4 font-bold text-slate-800">{p.nombre}</td>
                        <td className="px-6 py-4 text-center text-rose-600 font-black">{p.faltas}</td>
                        <td className="px-6 py-4 text-center text-emerald-600 font-black">{p.cumplidos}</td>
                        <td className="px-6 py-4 text-right">
                          <button onClick={() => setEditPerson(p)} className="text-blue-600 font-black text-xs hover:text-blue-800 flex items-center justify-end gap-1">
                            <i className="fa-solid fa-pen"></i> EDITAR
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
               </table>
             </div>
          </div>
        )}

        {view === 'resumen' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-sm font-bold text-slate-500 uppercase mb-4 tracking-widest flex items-center gap-2">
                <i className="fa-solid fa-layer-group"></i> Seleccionar Ciclo (3 Semanas)
              </h3>
              <div className="grid grid-cols-5 sm:grid-cols-7 md:grid-cols-12 gap-2">
                {Array.from({ length: TOTAL_SEMANAS / 3 }, (_, i) => i + 1).map(ciclo => (
                  <button 
                    key={ciclo}
                    onClick={() => setResumenCiclo(ciclo)}
                    className={`py-3 rounded-xl text-xs font-black transition-all transform active:scale-95 ${
                      resumenCiclo === ciclo ? 'bg-blue-600 text-white shadow-xl -translate-y-1' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    C{ciclo}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
               <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50/50">
                  <div>
                    <h3 className="text-xl font-black text-slate-800">Cierre de Ciclo #{resumenCiclo}</h3>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-tight">Periodo: Semanas {(resumenCiclo-1)*3+1} a {resumenCiclo*3} (Desde 2026)</p>
                  </div>
                  <div className="bg-emerald-600 text-white px-4 py-1.5 rounded-lg text-xs font-black shadow-lg shadow-emerald-100">BALANCES DE PAGO</div>
               </div>
               <div className="overflow-x-auto">
                 <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Vigilante</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Multas</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Abonos</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Saldo Neto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {state.personas.map(p => {
                        const stats = getCycleStats(p, resumenCiclo);
                        const net = stats.gana - stats.debe;
                        return (
                          <tr key={p.id}>
                            <td className="px-6 py-4 font-bold text-slate-800">{p.nombre}</td>
                            <td className="px-6 py-4 text-rose-500 font-bold">{formatCurrency(stats.debe)}</td>
                            <td className="px-6 py-4 text-emerald-600 font-bold">{formatCurrency(stats.gana)}</td>
                            <td className={`px-6 py-4 font-black ${net < 0 ? 'text-rose-700' : net > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                              {formatCurrency(net)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                 </table>
               </div>
            </div>
          </div>
        )}
      </main>

      {/* Modal Editar Nombre */}
      {editPerson && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all">
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-black uppercase tracking-widest text-xs">Modificar Nombre</h3>
              <button onClick={() => setEditPerson(null)} className="hover:text-rose-400 transition"><i className="fa-solid fa-xmark"></i></button>
            </div>
            <div className="p-6 space-y-4">
              <input id="edit-name-inp" type="text" defaultValue={editPerson.nombre} className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-xl outline-none focus:border-blue-500 font-bold" autoFocus />
              <button onClick={() => { const v = (document.getElementById('edit-name-inp') as HTMLInputElement).value; if(v.trim()) updatePersonName(editPerson.id, v.trim()); }} className="w-full bg-blue-600 text-white font-black py-4 rounded-xl hover:bg-blue-700 transition shadow-lg">ACTUALIZAR</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Reemplazo */}
      {showReplaceModal && selectedShift && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 bg-blue-600 text-white flex justify-between items-center">
              <h3 className="text-lg font-black uppercase tracking-widest">Registrar Reemplazo</h3>
              <button onClick={() => setShowReplaceModal(false)}><i className="fa-solid fa-xmark"></i></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase mb-2">Ausente (Paga {formatCurrency(COSTO_FALTA)}):</label>
                <select id="o-id-sel" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold outline-none focus:border-blue-500 transition">
                  {state.horarios[selectedShift.weekIdx].turnos[selectedShift.shiftIdx].personas.map(pId => (
                    <option key={pId} value={pId}>{state.personas.find(x => x.id === pId)?.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase mb-2">Reemplazo (Recibe dinero):</label>
                <select id="r-id-sel" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold outline-none focus:border-blue-500 transition">
                  {state.personas.filter(p => !p.eliminado).map(p => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </select>
              </div>
              <button onClick={() => {
                const o = (document.getElementById('o-id-sel') as HTMLSelectElement).value;
                const r = (document.getElementById('r-id-sel') as HTMLSelectElement).value;
                if(o === r) return alert("Deben ser personas distintas.");
                replacePerson(o, r, selectedShift.weekIdx + 1, selectedShift.weekIdx, selectedShift.shiftIdx);
              }} className="w-full bg-blue-600 text-white font-black py-4 rounded-xl shadow-lg hover:bg-blue-700 transition">CONFIRMAR CAMBIO</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Falta */}
      {showFaltaModal && selectedShift && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6 bg-rose-600 text-white flex justify-between items-center">
              <h3 className="text-lg font-black uppercase">Multar Vigilante</h3>
              <button onClick={() => setShowFaltaModal(false)}><i className="fa-solid fa-xmark"></i></button>
            </div>
            <div className="p-6 space-y-4">
              <label className="block text-xs font-black text-slate-500 uppercase mb-2">Seleccione persona que faltó:</label>
              <select id="f-id-sel" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold outline-none focus:border-rose-500">
                {state.horarios[selectedShift.weekIdx].turnos[selectedShift.shiftIdx].personas.map(pId => (
                  <option key={pId} value={pId}>{state.personas.find(x => x.id === pId)?.nombre}</option>
                ))}
              </select>
              <button onClick={() => {
                const pid = (document.getElementById('f-id-sel') as HTMLSelectElement).value;
                markFalta(pid, selectedShift.weekIdx + 1);
                setShowFaltaModal(false);
              }} className="w-full bg-rose-600 text-white font-black py-4 rounded-xl shadow-lg hover:bg-rose-700 transition">MULTAR {formatCurrency(COSTO_FALTA)}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
