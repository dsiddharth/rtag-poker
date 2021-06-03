import jwt from "jsonwebtoken";
import express from "express";
import { uniqueNamesGenerator, adjectives, colors, animals } from "unique-names-generator";
import { UserData } from "./types";

const JWT_SECRET = "secret";

export function authMiddleware() {
  const router = express.Router();
  router.post("/login/anonymous", (_, res) => {
    const id = Math.random().toString(36).substring(2);
    const name = uniqueNamesGenerator({ dictionaries: [adjectives, colors, animals], separator: "-" });
    const user: UserData = { type: "anonymous", id, name };
    res.json({ token: jwt.sign(user, JWT_SECRET) });
  });
  return router;
}

export function getUserFromToken(token: string): UserData {
  return jwt.verify(token, JWT_SECRET) as UserData;
}
