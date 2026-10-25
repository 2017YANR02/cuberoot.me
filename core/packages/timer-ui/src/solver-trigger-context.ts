import { createContext } from 'react';

/** The single solver instance renders its trigger into the shared topbar. */
export const SolverTriggerContext = createContext<HTMLElement | null>(null);
