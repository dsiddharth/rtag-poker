export type PlayerName = string;
export interface Player {
  name: PlayerName;
  chips: number;
  cards: Card[];
  currentBet: number;
  currentStatus: PlayerStatus;
}
export interface Card {
  value: CardValue;
  suit: CardSuit;
}
export enum CardValue {
  ONE,
  TWO,
  THREE,
  FOUR,
  FIVE,
  SIX,
  SEVEN,
  EIGHT,
  NINE,
  TEN,
  JACK,
  QUEEN,
  KING,
  ACE,
}
export enum CardSuit {
  CLUB,
  SPACE,
  HEART,
  DIAMOND,
}
export enum PlayerStatus {
  WAITING,
  DECIDING,
  FOLDED,
}
export interface GameState {
  players: Player[];
  dealer: PlayerName;
  activePlayer: PlayerName;
  currentPot: number;
  amountToCall: number;
}
export interface ICreateGameRequest {
}
export interface IJoinGameRequest {
}
export interface IStartGameRequest {
  startingBlind: number;
  startingChipsPerPlayer: number;
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
