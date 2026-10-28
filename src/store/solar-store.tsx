import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from 'react';

import { StorageBoundary } from '@/components/storage-boundary';
import { createDemoSolarState } from '@/data/demo/solar-seed';
import { getTripView } from '@/domain/trip-finance';
import { createAsyncSolarRepository } from '@/repositories/solar-repository';

import { createSolarStorage } from './solar-storage';

export type SolarStorage = ReturnType<typeof createSolarStorage>;
const storage = createSolarStorage(createAsyncSolarRepository(AsyncStorage), createDemoSolarState);
const Context = createContext<SolarStorage | null>(null);

export function SolarTripProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(storage.subscribe, storage.getSnapshot, storage.getServerSnapshot);
  useEffect(() => { void storage.load(); }, []);
  return (
    <Context.Provider value={storage}>
      <StorageBoundary status={snapshot.status} error={snapshot.error} onRetry={() => { void storage.retry(); }}>
        {snapshot.data ? children : null}
      </StorageBoundary>
    </Context.Provider>
  );
}

export function useSolarTrip() {
  const store = useContext(Context);
  if (!store) throw new Error('useSolarTrip requires SolarTripProvider');
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const trip = snapshot.data?.trips.find((trip) => trip.id === snapshot.data?.activeTripId);
  if (!trip) throw new Error('Поездка Solar ещё не загружена');
  return { ...getTripView(trip), dispatch: store.dispatch };
}
