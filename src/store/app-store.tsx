import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from 'react';

import { StorageBoundary } from '@/components/storage-boundary';

import { createAppStorage, type AppState, type StorageError, type StorageStatus, type Trip } from './app-storage';

export type { Trip } from './app-storage';

type AppStore = AppState & {
  loaded: boolean;
  status: StorageStatus;
  storageError: StorageError | null;
  saving: boolean;
  retryStorage: () => Promise<boolean>;
  toggleVisited: (code: string) => boolean;
  addTrip: (trip: Omit<Trip, 'id'>) => boolean;
  removeTrip: (id: string) => boolean;
  resetAll: () => boolean;
};

// One coordinator per app runtime: Strict Mode/remounts cannot start competing IO.
// Construction performs no IO; hydration starts only in the client effect.
const storage = createAppStorage(AsyncStorage);
const AppStoreContext = createContext<AppStore | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(storage.subscribe, storage.getSnapshot, storage.getServerSnapshot);

  useEffect(() => {
    void storage.load();
  }, []);

  const store: AppStore = {
    ...snapshot.data,
    loaded: snapshot.status === 'ready',
    status: snapshot.status,
    storageError: snapshot.error,
    saving: snapshot.saving,
    retryStorage: storage.retry,
    toggleVisited: storage.toggleVisited,
    addTrip: storage.addTrip,
    removeTrip: storage.removeTrip,
    resetAll: storage.resetAll,
  };

  return (
    <AppStoreContext.Provider value={store}>
      <StorageBoundary status={snapshot.status} error={snapshot.error} onRetry={() => { void storage.retry(); }}>
        {children}
      </StorageBoundary>
    </AppStoreContext.Provider>
  );
}

export function useAppStore() {
  const store = useContext(AppStoreContext);
  if (!store) throw new Error('useAppStore must be used inside AppStoreProvider');
  return store;
}
