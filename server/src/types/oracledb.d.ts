declare module 'oracledb' {
  export interface Connection {
    execute<T = any>(sql: string, binds?: any, options?: any): Promise<Result<T>>;
    commit(): Promise<void>;
    rollback(): Promise<void>;
    close(): Promise<void>;
  }

  export interface Pool {
    getConnection(): Promise<Connection>;
    close(drainTime?: number): Promise<void>;
  }

  export interface Result<T = any> {
    rows?: T[];
    outBinds?: any;
    rowsAffected?: number;
  }

  export type BindParameters = Record<string, any> | any[];
  export type ExecuteOptions = Record<string, any>;

  export const OUT_FORMAT_OBJECT: number;
  export const NUMBER: number;
  export const STRING: number;
  export const DATE: number;
  export const BIND_OUT: number;

  export function createPool(config: any): Promise<Pool>;
  export function getConnection(config?: any): Promise<Connection>;

  const oracledb: {
    outFormat: number;
    autoCommit: boolean;
    OUT_FORMAT_OBJECT: number;
    NUMBER: number;
    STRING: number;
    DATE: number;
    BIND_OUT: number;
    createPool(config: any): Promise<Pool>;
    getConnection(config?: any): Promise<Connection>;
  };

  export default oracledb;
}
