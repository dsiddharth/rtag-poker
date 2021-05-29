import {
  UserData,
  GameState as UserState,
  ICreateGameRequest,
  IJoinGameRequest,
  IStartGameRequest,
  ICallRequest,
  IRaiseRequest,
  IFoldRequest,
} from "./types";

export interface Context {
  rand(): number;
  randInt(limit?: number): number;
  time(): number;
}

export interface ModifiedResult {
  type: "modified";
}
export interface UnmodifiedResult {
  type: "unmodified";
  error?: string;
}
export type Result = ModifiedResult | UnmodifiedResult;
export const Result: { modified: () => ModifiedResult; unmodified: (error?: string) => UnmodifiedResult } = {
  modified: () => ({
    type: "modified",
  }),
  unmodified: (error?: string) => ({
    type: "unmodified",
    error,
  }),
};

export interface Methods<T> {
  createGame(user: UserData, ctx: Context, request: ICreateGameRequest): T;
  joinGame(state: T, user: UserData, ctx: Context, request: IJoinGameRequest): Result;
  startGame(state: T, user: UserData, ctx: Context, request: IStartGameRequest): Result;
  call(state: T, user: UserData, ctx: Context, request: ICallRequest): Result;
  raise(state: T, user: UserData, ctx: Context, request: IRaiseRequest): Result;
  fold(state: T, user: UserData, ctx: Context, request: IFoldRequest): Result;
  getUserState(state: T, user: UserData): UserState;
}
