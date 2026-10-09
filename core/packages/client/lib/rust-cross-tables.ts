import { BASE, TABLES_BASE, configureStageSolverTables } from '@cuberoot/timer-ui/stage-solver/rust-cross-tables';

configureStageSolverTables(process.env.NODE_ENV === 'development' ? `${BASE}/tables` : TABLES_BASE);

export * from "@cuberoot/timer-ui/stage-solver/rust-cross-tables";
