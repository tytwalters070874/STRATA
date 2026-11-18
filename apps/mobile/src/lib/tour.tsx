import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

const TOUR_KEY = 'strata-tour-seen';

interface TourState {
  /** null until the saved flag has been read. */
  seen: boolean | null;
  /** Shows the tour again (from the map's help button). */
  show: () => void;
  /** Marks the tour finished or skipped. */
  finish: () => void;
}

const TourContext = createContext<TourState | null>(null);

/** The first-launch tour: shown once, then only when asked for. */
export function TourProvider({ children }: { children: ReactNode }) {
  const [seen, setSeen] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(TOUR_KEY)
      .then((value) => setSeen(value === '1'))
      .catch(() => setSeen(false));
  }, []);

  const show = useCallback(() => setSeen(false), []);
  const finish = useCallback(() => {
    setSeen(true);
    AsyncStorage.setItem(TOUR_KEY, '1').catch(() => undefined);
  }, []);

  return <TourContext.Provider value={{ seen, show, finish }}>{children}</TourContext.Provider>;
}

export function useTour(): TourState {
  const value = useContext(TourContext);
  if (!value) throw new Error('useTour must be used inside <TourProvider>');
  return value;
}
