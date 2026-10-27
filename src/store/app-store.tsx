import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Trip = {
  id: string;
  countryCode: string;
  /** YYYY-MM-DD */
  startDate: string;
  /** YYYY-MM-DD */
  endDate: string;
  note?: string;
};

type AppState = {
  citizenship: string;
  visited: string[];
  trips: Trip[];
};

type AppStore = AppState & {
  loaded: boolean;
  toggleVisited: (code: string) => void;
  addTrip: (trip: Omit<Trip, 'id'>) => void;
  removeTrip: (id: string) => void;
  resetAll: () => void;
};

const STORAGE_KEY = 'travel-app/state/v1';
const initialState: AppState = { citizenship: 'RU', visited: [], trips: [] };

const AppStoreContext = createContext<AppStore | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(initialState);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setState({ ...initialState, ...JSON.parse(raw) });
      })
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, loaded]);

  const store: AppStore = {
    ...state,
    loaded,
    toggleVisited: (code) =>
      setState((s) => ({
        ...s,
        visited: s.visited.includes(code)
          ? s.visited.filter((c) => c !== code)
          : [...s.visited, code],
      })),
    addTrip: (trip) =>
      setState((s) => ({ ...s, trips: [...s.trips, { ...trip, id: String(Date.now()) }] })),
    removeTrip: (id) => setState((s) => ({ ...s, trips: s.trips.filter((t) => t.id !== id) })),
    resetAll: () => setState(initialState),
  };

  return <AppStoreContext.Provider value={store}>{children}</AppStoreContext.Provider>;
}

export function useAppStore() {
  const store = useContext(AppStoreContext);
  if (!store) throw new Error('useAppStore must be used inside AppStoreProvider');
  return store;
}
