import type { Server as HttpServer } from 'node:http';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import type { Env } from './config/env.js';
import { ChatThread, User } from './db/models.js';
import type { Role } from './resources/types.js';
import { CHAT_ROLES, isStaffOnline, setIo, tokenMatches } from './services/chat.js';
import { setNotifyIo } from './services/notify.js';

const OBJECT_ID = /^[a-f0-9]{24}$/i;

/** Socket tokens use their own signing key so one can never be replayed as a login cookie. */
const socketSecret = (env: Env): string => `${env.jwtSecret}:chat-socket`;

export function signChatSocketToken(env: Env, userId: string, tokenVersion: number): string {
  return jwt.sign({ sub: userId, tv: tokenVersion }, socketSecret(env), { expiresIn: '2m' });
}

interface SocketData {
  kind: 'staff' | 'visitor';
  threadId?: string;
  name?: string;
  userId?: string;
  role?: string;
}

/**
 * Real-time layer. Messages are SENT over normal HTTP requests (see routes/chat.ts) and PUSHED to people here:
 *  - staff sockets (token from POST /api/admin/chat/socket-token) join the "staff" room and hear every chat;
 *  - visitor sockets (the secret returned when the chat started) join only their own thread's room.
 */
export function attachRealtime(server: HttpServer, env: Env) {
  const io = new Server(server, {
    cors: { origin: env.clientOrigins, credentials: false },
    maxHttpBufferSize: 20_000,
  });
  setIo(io);
  setNotifyIo(io);

  io.use(async (socket, next) => {
    try {
      const auth = (socket.handshake.auth ?? {}) as { role?: string; token?: string; threadId?: string };
      const token = typeof auth.token === 'string' ? auth.token : '';
      if (auth.role === 'staff') {
        const payload = jwt.verify(token, socketSecret(env)) as { sub?: string; tv?: number };
        const user = payload.sub ? await User.findById(payload.sub) : null;
        if (!user || !user.isActive || user.tokenVersion !== payload.tv) return next(new Error('unauthorized'));
        socket.data = { kind: 'staff', name: user.name, userId: String(user._id), role: user.role } satisfies SocketData;
        return next();
      }
      if (auth.role === 'visitor' && typeof auth.threadId === 'string' && OBJECT_ID.test(auth.threadId)) {
        const thread = await ChatThread.findById(auth.threadId).select('+tokenHash');
        if (!thread || !tokenMatches(thread.tokenHash, token)) return next(new Error('unauthorized'));
        socket.data = { kind: 'visitor', threadId: String(thread._id) } satisfies SocketData;
        return next();
      }
      next(new Error('unauthorized'));
    } catch {
      next(new Error('unauthorized'));
    }
  });

  const broadcastPresence = () => io.to('visitors').emit('chat:presence', { online: isStaffOnline() });

  io.on('connection', (socket) => {
    const data = socket.data as SocketData;
    if (data.kind === 'staff') {
      // Every staff member hears notifications for their role; only chat staff join the chat room (and count as "online" for visitors).
      socket.join(`role:${data.role}`);
      socket.join(`user:${data.userId}`);
      if (CHAT_ROLES.includes(data.role as Role)) {
        socket.join('staff');
        broadcastPresence();
      }
    } else {
      socket.join(`thread:${data.threadId}`);
      socket.join('visitors');
      socket.emit('chat:presence', { online: isStaffOnline() });
    }

    // "is typing…" relay. Nothing is stored.
    socket.on('chat:typing', (payload: { threadId?: string; typing?: boolean } | undefined) => {
      const typing = Boolean(payload?.typing);
      if (data.kind === 'staff') {
        if (!CHAT_ROLES.includes(data.role as Role)) return;
        const threadId = payload?.threadId;
        if (typeof threadId === 'string' && OBJECT_ID.test(threadId)) socket.to(`thread:${threadId}`).emit('chat:typing', { threadId, from: 'staff', name: data.name, typing });
      } else {
        io.to('staff').emit('chat:typing', { threadId: data.threadId, from: 'visitor', typing });
      }
    });

    socket.on('disconnect', () => {
      if (data.kind === 'staff' && CHAT_ROLES.includes(data.role as Role)) broadcastPresence();
    });
  });

  return io;
}
