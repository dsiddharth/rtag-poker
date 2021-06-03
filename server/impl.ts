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
  Player,
  PlayerStatus,
  PlayerName,
  RoundStatus,
  Card,
  AnonymousUserData,
  IStartRoundRequest
} from "./.rtag/types";
// @ts-ignore
import Cards from "cards";

interface InternalState {
  players: Player[];
  roundStatus: RoundStatus;
  deck: any;
  dealerIndex: number;
  activePlayerIndex: number;
  revealedCards: Card[]
  currentBlind: number;
  currentPot: number;
  amountToCall: number;
}

export class Impl implements Methods<InternalState> {
  createGame(user: UserData, ctx: Context, request: ICreateGameRequest): InternalState {
    return {
      players: [createPlayer(user.name)],
      dealerIndex: 0,
      activePlayerIndex: 0,
      roundStatus: RoundStatus.WAITING,
      deck: new Cards.decks.StandardDeck(),
      revealedCards: [],
      currentBlind: 0,
      currentPot: 0,
      amountToCall: 0,
    };
  }
  joinGame(state: InternalState, user: UserData, ctx: Context, request: IJoinGameRequest): Result {
    if (state.players.find(p => p.name == user.name) != undefined) {
      return Result.unmodified("User already joined");
    }
    state.players.push(createPlayer(user.name));
    return Result.modified();
  }
  startGame(state: InternalState, user: UserData, ctx: Context, request: IStartGameRequest): Result {
    if (RoundStatus.WAITING != state.roundStatus) {
      return Result.unmodified("Game already in-progress.")
    }
    if (state.players.length < 2) {
      return Result.unmodified("Must have 2 players to start.")
    }
    state.players.forEach(player => player.chips = request.startingChipsPerPlayer);
    state.currentBlind = request.startingBlind;
    state.deck.shuffleAll();
    return Result.modified();
  }
  startRound(state: InternalState, user: AnonymousUserData, ctx: Context, request: IStartRoundRequest): Result {
    if (![RoundStatus.WAITING, RoundStatus.DONE].includes(state.roundStatus)) {
      return Result.unmodified("Round in-progress.")
    }
    state.dealerIndex += 1;
    state.activePlayerIndex = state.dealerIndex + 1;
    state.currentPot = 0;
    state.players.forEach(player => {
      player.currentBet = 0
      player.currentStatus = PlayerStatus.WAITING
      player.cards = drawCard(state.deck, 2);
    });

    raiseBet(state, state.currentBlind);
    raiseBet(state, state.currentBlind * 2);

    state.roundStatus = RoundStatus.PRE_FLOP;
    return Result.modified();
  }
  call(state: InternalState, user: UserData, ctx: Context, request: ICallRequest): Result {
    if (state.roundStatus == RoundStatus.DONE) {
      return Result.unmodified("Game is over")
    }
    const currentActiveUser = state.players[state.activePlayerIndex % state.players.length];
    if (currentActiveUser.name != user.name) {
      return Result.unmodified("Not your turn");
    }

    makeBet(state, state.amountToCall - currentActiveUser.currentBet);
    maybeNextRound(state);
    return Result.modified();
  }
  raise(state: InternalState, user: UserData, ctx: Context, request: IRaiseRequest): Result {
    if (state.roundStatus == RoundStatus.DONE) {
      return Result.unmodified("Game is over")
    }
    const currentActiveUser = state.players[state.activePlayerIndex % state.players.length];
    if (currentActiveUser.name != user.name) {
      return Result.unmodified("Not your turn");
    }

    raiseBet(state, request.raiseAmount);
    maybeNextRound(state);
    return Result.modified();
  }
  fold(state: InternalState, user: UserData, ctx: Context, request: IFoldRequest): Result {
    if (state.roundStatus == RoundStatus.DONE) {
      return Result.unmodified("Game is over")
    }
    const currentActiveUser = state.players[state.activePlayerIndex % state.players.length];
    if (currentActiveUser.name != user.name) {
      return Result.unmodified("Not your turn");
    }

    currentActiveUser.currentStatus = PlayerStatus.FOLDED

    maybeNextRound(state);
    return Result.modified();
  }
  getUserState(state: InternalState, user: UserData): GameState {
    return {
      players: state.players.map(p => sanitizePlayer(p, user.name, state.roundStatus)),
      dealer: state.players[state.dealerIndex % state.players.length].name,
      activePlayer: state.players[state.activePlayerIndex % state.players.length].name,
      currentPot: state.currentPot,
      amountToCall: state.amountToCall,
      roundStatus: state.roundStatus,
      revealedCards: state.revealedCards,
    };
  }
}

function drawCard(deck: any, amount: number) {
  if (amount == 1) {
    const rawCard = deck.draw(1);
    return rawCard.rank.shortName + rawCard.suit.name[0]
  } else {
    return deck.draw(amount).map((rawCard: any) => {
      return rawCard.rank.shortName + rawCard.suit.name[0]
    })
  }
}

function raiseBet(state: InternalState, betAmount: number) {
  const player = state.players[state.activePlayerIndex % state.players.length];
  makeBet(state, betAmount);
  state.players.forEach(p => {
    if (player.name != p.name && p.currentStatus != PlayerStatus.FOLDED) {
      p.currentStatus = PlayerStatus.WAITING;
    }
  })
}

function makeBet(state: InternalState, betAmount: number) {
  const player = state.players[state.activePlayerIndex % state.players.length];
  player.currentBet += betAmount;
  player.chips -= betAmount;
  state.currentPot += betAmount;
  state.amountToCall = player.currentBet;

  state.activePlayerIndex += 1;
  player.currentStatus = PlayerStatus.PLAYED;
}

function sanitizePlayer(player: Player, user: PlayerName, roundStatus: RoundStatus): Player {
  if (player.name == user || (roundStatus == RoundStatus.DONE && player.currentStatus != PlayerStatus.FOLDED)) {
    return player;
  }
  return { ...player, cards: [] }
}

function createPlayer(playerName: PlayerName) {
  return {
    name: playerName,
    chips: 0,
    cards: [],
    currentBet: 0,
    currentStatus: PlayerStatus.WAITING
  };
}

function maybeNextRound(state: InternalState) {
  const remainingPlayers = state.players.filter(p => p.currentStatus != PlayerStatus.FOLDED);
  if (remainingPlayers.length == 1) {
    const winner = remainingPlayers[0];
    winner.chips += state.currentPot;
    state.roundStatus = RoundStatus.DONE;
    return
  }

  if (remainingPlayers.filter(p => p.currentStatus != PlayerStatus.PLAYED).length != 0) {
    return
  }

  if (state.roundStatus == RoundStatus.RIVER) {
    // const winner = identifyWinner(state);
    // winner.chips += state.currentPot;
    // state.roundStatus = RoundStatus.DONE;
    // return
  }

  for (let i = 0; i < state.players.length; i++) {
    const player = state.players[(state.dealerIndex + i) % state.players.length];
    if (player.currentStatus !== PlayerStatus.FOLDED) {
      state.activePlayerIndex = state.dealerIndex + i;
      break;
    }
  }
  state.players.forEach(p => {
    p.currentBet = 0;
    if (p.currentStatus != PlayerStatus.FOLDED) {
      p.currentStatus = PlayerStatus.WAITING;
    }
  })
  state.amountToCall = 0;
  if (state.roundStatus == RoundStatus.PRE_FLOP) {
    state.revealedCards = drawCard(state.deck, 3);
  } else if (state.roundStatus == RoundStatus.FLOP || state.roundStatus == RoundStatus.TURN) {
    state.revealedCards.push(drawCard(state.deck, 1));
  }
  state.roundStatus++;
}