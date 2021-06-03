export type PlayerName = string;
export interface Player {
  name: PlayerName;
  chips: number;
  cards: Card[];
  currentBet: number;
  currentStatus: PlayerStatus;
}
export type Card = string;
export enum PlayerStatus {
  WAITING,
  PLAYED,
  FOLDED,
}
export enum RoundStatus {
  WAITING,
  PRE_FLOP,
  FLOP,
  TURN,
  RIVER,
  DONE,
}
export interface GameState {
  players: Player[];
  dealer: PlayerName;
  activePlayer: PlayerName;
  currentPot: number;
  amountToCall: number;
  roundStatus: RoundStatus;
  revealedCards: Card[];
}
export interface ICreateGameRequest {
}
export interface IJoinGameRequest {
}
export interface IStartGameRequest {
  startingBlind: number;
  startingChipsPerPlayer: number;
}
export interface IStartRoundRequest {
}
export interface ICallRequest {
}
export interface IRaiseRequest {
  raiseAmount: number;
}
export interface IFoldRequest {
}
export interface AnonymousUserData {
  type: "anonymous";
  id: string;
  name: string;
}
export type UserData = AnonymousUserData;
