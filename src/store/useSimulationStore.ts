import { create } from 'zustand';
import { runSimulation, DEFAULT_OVERRIDES, type RuleOverrides, type SimulationResult } from '@/api/simulation';

interface SavedScenario {
  id:        string;
  name:      string;
  overrides: Partial<RuleOverrides>;
  result:    SimulationResult;
  savedAt:   string;
}

interface SimulationStore {
  overrides:       Partial<RuleOverrides>;
  result:          SimulationResult | null;
  running:         boolean;
  scenarios:       SavedScenario[];
  compareId:       string | null;

  setOverride:     (key: keyof RuleOverrides, value: boolean | string) => void;
  resetOverrides:  () => void;
  runSim:          () => void;
  saveScenario:    (name: string) => void;
  deleteScenario:  (id: string) => void;
  setCompare:      (id: string | null) => void;
}

export const useSimulationStore = create<SimulationStore>((set, get) => ({
  overrides:  {},
  result:     null,
  running:    false,
  scenarios:  [],
  compareId:  null,

  setOverride: (key, value) =>
    set(s => ({ overrides: { ...s.overrides, [key]: value } })),

  resetOverrides: () => set({ overrides: {}, result: null }),

  runSim: () => {
    set({ running: true });
    // defer to next tick so React re-renders the loading state
    setTimeout(() => {
      const result = runSimulation(get().overrides);
      set({ result, running: false });
    }, 60);
  },

  saveScenario: (name) => {
    const { overrides, result } = get();
    if (!result) return;
    const scenario: SavedScenario = {
      id:      crypto.randomUUID(),
      name,
      overrides: { ...overrides },
      result,
      savedAt: new Date().toISOString(),
    };
    set(s => ({ scenarios: [...s.scenarios, scenario] }));
  },

  deleteScenario: (id) =>
    set(s => ({ scenarios: s.scenarios.filter(sc => sc.id !== id) })),

  setCompare: (id) => set({ compareId: id }),
}));
