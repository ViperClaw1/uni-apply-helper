import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { connect, type Socket } from 'node:net';
import type { Redis } from 'ioredis';
import type { WebSocket } from 'ws';
import { REDIS_CLIENT } from './redis-client.provider.js';

const TICKET_PREFIX = 'relogin-viewer:';
const TICKET_TTL_MS = 60_000;

/**
 * Bridges an authenticated dashboard viewer to the worker's VNC port, which is only reachable
 * on Railway's private network — this service (and the WS upgrade handler in main.ts that
 * drives it) is the only path a browser has to reach it at all.
 */
@Injectable()
export class ReloginViewerService implements OnModuleDestroy {
  private readonly logger = new Logger(ReloginViewerService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async onModuleDestroy() {
    await this.redis.quit();
  }

  async mintTicket(jobId: string): Promise<string> {
    const ticket = randomBytes(32).toString('hex');

    await this.redis.set(
      `${TICKET_PREFIX}${ticket}`,
      jobId,
      'PX',
      TICKET_TTL_MS,
      'NX',
    );

    return ticket;
  }

  /** Single-use — deletes on read, so a ticket can never be replayed. */
  async consumeTicket(ticket: string): Promise<string | null> {
    return this.redis.getdel(`${TICKET_PREFIX}${ticket}`);
  }

  /** Dumb byte-shovel — this never parses VNC/RFB content, just relays it both directions. */
  proxy(ws: WebSocket, jobId: string): void {
    const host = process.env.WORKER_VNC_HOST;
    const port = Number(process.env.WORKER_VNC_PORT ?? 5900);

    if (!host) {
      this.logger.error('WORKER_VNC_HOST is not configured.');
      ws.close(1011, 'Viewer is not configured.');
      return;
    }

    const socket: Socket = connect({ host, port });
    const cleanup = () => {
      socket.destroy();
      if (ws.readyState === ws.OPEN || ws.readyState === ws.CONNECTING) {
        ws.close();
      }
    };

    socket.on('connect', () => {
      this.logger.log(
        `Relogin viewer connected for job ${jobId} → ${host}:${port}`,
      );
    });

    socket.on('data', (chunk) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(chunk);
      }
    });

    socket.on('error', (error) => {
      this.logger.warn(`VNC socket error for job ${jobId}: ${error.message}`);
      cleanup();
    });

    socket.on('close', cleanup);

    ws.on('message', (data) => {
      if (Array.isArray(data)) {
        socket.write(Buffer.concat(data));
      } else if (Buffer.isBuffer(data)) {
        socket.write(data);
      } else {
        socket.write(Buffer.from(data));
      }
    });

    ws.on('close', () => socket.destroy());
    ws.on('error', () => socket.destroy());
  }
}
