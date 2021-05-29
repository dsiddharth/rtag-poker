import { Methods, Context, Result } from "./.rtag/methods";
import {
  UserData,
  GameState,
  ICreateGameRequest,
  IJoinGameRequest,
  IStartGameRequest,
  ICallRequest,
  IRaiseRequest,
  IFoldRequest,
} from "./.rtag/types";

interface InternalState {}

export class Impl implements Methods<InternalState> {
  createGame(user: UserData, ctx: Context, request: ICreateGameRequest): InternalState {
    return {};
  }
  joinGame(state: InternalState, user: UserData, ctx: Context, request: IJoinGameRequest): Result {
    return Result.unmodified("Not implemented");
  }
  startGame(state: InternalState, user: UserData, ctx: Context, request: IStartGameRequest): Result {
    return Result.unmodified("Not implemented");
  }
  call(state: InternalState, user: UserData, ctx: Context, request: ICallRequest): Result {
    return Result.unmodified("Not implemented");
  }
  raise(state: InternalState, user: UserData, ctx: Context, request: IRaiseRequest): Result {
    return Result.unmodified("Not implemented");
  }
  fold(state: InternalState, user: UserData, ctx: Context, request: IFoldRequest): Result {
    return Result.unmodified("Not implemented");
  }
  getUserState(state: InternalState, user: UserData): GameState {
    return {
      players: [],
      dealer: "",
      activePlayer: "",
      currentPot: 0,
      amountToCall: 0,
    };
  }
}
