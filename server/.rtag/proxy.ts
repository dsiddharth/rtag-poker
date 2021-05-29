import WebSocket from "ws";
import { Socket } from "net";
import express from "express";
import { createServer } from "vite";
import * as http from "http";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import Store from "./store";
import { authMiddleware, getUserFromToken } from "./auth";
import { UserData } from "./types";

type StateId = string;
type Connection = WebSocket & { isAlive: boolean };

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });
const vite = await createServer({
  server: { middlewareMode: true },
  root: "../client",
  clearScreen: false,
  alias: { vue: "vue/dist/vue.esm.js" },
});

const connections: Map<string, Set<Connection>> = new Map();
const store = new Store();

app.use(express.json());
app.use(express.raw());
app.post("/new", (req, res) => {
  const token = req.headers.authorization!.split(" ")[1];
  const user = getUserFromToken(token);
  const stateId = Math.random().toString(36).substring(2);
  store.newState(stateId, user, req.body);
  res.json({ stateId });
});
app.use(authMiddleware());
app.use(vite.middlewares);
app.get("/*", (_, res) => {
  res.sendFile(join(__dirname, "../../client/.rtag/index.html"));
});

server.on("upgrade", (req: http.IncomingMessage, socket: Socket, head: Buffer) => {
  wss.handleUpgrade(req, socket, head, (ws) => {
    ws.once("message", (token) => {
      const stateId = req.url!.substring(1);
      const user = getUserFromToken(token as string);
      handleConnection(stateId, user, Object.assign(ws, { isAlive: true }));
    });
  });
});

server.listen(3000, () => {
  console.log("listening on *:3000");
});

setInterval(() => {
  connections.forEach((sockets) => {
    sockets.forEach((socket) => {
      if (!socket.isAlive) {
        socket.terminate();
      } else {
        socket.isAlive = false;
        socket.ping(() => {});
      }
    });
  });
}, 30000);

function handleConnection(stateId: StateId, user: UserData, socket: Connection) {
  addConnection(stateId, user, socket);
  socket.on("close", () => {
    deleteConnection(stateId, user, socket);
  });
  socket.on("pong", () => {
    socket.isAlive = true;
  });
  socket.on("message", (data) => {
    store.handleUpdate(stateId, user, data as Buffer);
  });
}

function addConnection(stateId: StateId, user: UserData, socket: Connection) {
  const client = stateId + user.id;
  if (!connections.has(client)) {
    connections.set(client, new Set([socket]));
    store.subscribeUser(stateId, user);
  } else {
    connections.get(client)!.add(socket);
  }
}

function deleteConnection(stateId: StateId, user: UserData, socket: Connection) {
  const client = stateId + user.id;
  connections.get(client)!.delete(socket);
  if (connections.get(client)!.size === 0) {
    connections.delete(client);
    store.unsubscribeUser(stateId, user);
  }
}

export function onNewUserState(stateId: StateId, user: UserData, data: Uint8Array) {
  const client = stateId + user.id;
  connections.get(client)!.forEach((socket) => {
    socket.send(data);
  });
}
