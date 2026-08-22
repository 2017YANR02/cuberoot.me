declare module 'sql.js/dist/sql-asm-memory-growth.js' {
  import type { SqlJsStatic } from 'sql.js';

  const initSqlJs: () => Promise<SqlJsStatic>;
  export default initSqlJs;
}
