import module from "module";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { existsSync, mkdirSync } from "fs";
import dependencyTree from "dependency-tree";
import chokidar from "chokidar";
import seedrandom from "seedrandom";
import { decode, decodeMulti, encode } from "@msgpack/msgpack";
import { onNewUserState } from "./proxy";
import LogStore from "./logstore";
import { Context } from "./methods";
import { UserData, ICreateGameRequest } from "./types";

const deps = dependencyTree.toList({
  directory: ".",
  filename: module.createRequire(import.meta.url).resolve("../impl"),
  filter: (path) => !path.includes(".rtag") && !path.includes("node_modules"),
});
let impl = new (await import("../impl")).Impl();
chokidar.watch(deps).on("change", async () => {
  impl = new (await import(`../impl.ts#${Math.random()}`)).Impl();
});

type StateId = string;
type State = ReturnType<typeof impl.createGame>;
interface UpdateRequest {
  method: string;
  msgId: string;
  args: any;
}

const dataDir = join(dirname(fileURLToPath(import.meta.url)), "data");
if (!existsSync(dataDir)) {
  mkdirSync(dataDir);
}
const log = new LogStore(dataDir);
const states: Map<StateId, State & { _rng: ReturnType<seedrandom> }> = new Map();
const changedStates: Set<StateId> = new Set();
const userResponses: Map<StateId, Map<string, Record<string, string | null>>> = new Map();
const subscriptions: Map<StateId, Set<UserData>> = new Map();

export default class Store {
  constructor() {
    setInterval(() => {
      changedStates.forEach((stateId) => {
        const responses = userResponses.get(stateId);
        subscriptions.get(stateId)!.forEach((user) => {
          sendUpdate(stateId, user, responses?.get(user.id) ?? {});
        });
        userResponses.delete(stateId);
      });
      userResponses.forEach((responses, stateId) => {
        subscriptions.get(stateId)!.forEach((user) => {
          if (responses.has(user.id)) {
            sendUpdate(stateId, user, responses.get(user.id)!);
          }
        });
      });
      changedStates.clear();
      userResponses.clear();
    }, 100);
  }
  newState(stateId: StateId, user: UserData, data: Buffer) {
    const args = decodeMulti(data).next().value as ICreateGameRequest;
    const seed = Math.random().toString();
    const rng = seedrandom(seed);
    const time = Date.now();
    const state = impl.createGame(user, ctx(rng, time), args);
    states.set(stateId, Object.assign(state, { _rng: rng }));
    log.append(stateId, time, encode({ seed, user, args }));
  }
  handleUpdate(stateId: StateId, user: UserData, data: Buffer) {
    const state = states.get(stateId);
    if (state === undefined) {
      return;
    }
    const { method, args, msgId } = decode(data) as UpdateRequest;
    const time = Date.now();
    const result = getResult(state, user, method, ctx(state._rng, time), args);
    if (result !== undefined) {
      if (result.type === "modified") {
        changedStates.add(stateId);
        log.append(stateId, time, encode({ method, user, args }));
      }
      const response = result.type === "modified" ? null : result.error ?? null;
      if (!userResponses.has(stateId)) {
        userResponses.set(stateId, new Map([[user.id, { [msgId]: response }]]));
      } else {
        if (!userResponses.get(stateId)!.has(user.id)) {
          userResponses.get(stateId)!.set(user.id, { [msgId]: response });
        } else {
          userResponses.get(stateId)!.get(user.id)![msgId] = response;
        }
      }
    }
  }
  subscribeUser(stateId: StateId, user: UserData) {
    if (!states.has(stateId)) {
      states.set(stateId, loadState(stateId));
    }
    if (!subscriptions.has(stateId)) {
      subscriptions.set(stateId, new Set([user]));
    } else {
      subscriptions.get(stateId)!.add(user);
    }
    sendUpdate(stateId, user, {});
  }
  unsubscribeUser(stateId: StateId, user: UserData) {
    if (!states.has(stateId)) {
      return;
    }
    const users = subscriptions.get(stateId)!;
    if (users.size > 1) {
      users.delete(user);
    } else {
      subscriptions.delete(stateId);
    }
  }
}

function getResult(state: State, user: UserData, method: string, ctx: Context, args: any) {
  switch (method) {
    case "joinGame":
      return impl.joinGame(state, user, ctx, args);
    case "startGame":
      return impl.startGame(state, user, ctx, args);
    case "startRound":
      return impl.startRound(state, user, ctx, args);
    case "call":
      return impl.call(state, user, ctx, args);
    case "raise":
      return impl.raise(state, user, ctx, args);
    case "fold":
      return impl.fold(state, user, ctx, args);
    default:
      return undefined;
  }
}

function loadState(stateId: StateId) {
  const rows = log.load(stateId);

  const { time, record } = rows[0];
  const { seed, user, args } = decode(record) as { seed: string; user: UserData; args: ICreateGameRequest };
  const rng = seedrandom(seed);
  const state = impl.createGame(user, ctx(rng, time), args);

  for (let i = 1; i < rows.length; i++) {
    const { time, record } = rows[i];
    const data = decode(record) as object;
    const { method, user, args } = data as { method: string; user: UserData; args: any };
    getResult(state, user, method, ctx(rng, time), args);
  }

  return Object.assign(state, { _rng: rng });
}

function sendUpdate(stateId: StateId, user: UserData, responses: Record<string, string | null>) {
  const state = impl.getUserState(states.get(stateId)!, user);
  return onNewUserState(stateId, user, encode({ state, responses }, { ignoreUndefined: true }));
}

function ctx(rng: ReturnType<seedrandom>, time: number) {
  return {
    rand: () => rng(),
    randInt: (limit?: number) => (limit === undefined ? rng.int32() : Math.floor(rng() * limit)),
    time: () => time,
  };
}
