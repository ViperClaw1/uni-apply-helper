import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'express';
import { WebSocketServer } from 'ws';
import { AppModule } from './app.module';
import { assertApiRailwayService } from './assert-railway-service';
import { ReloginViewerService } from './relogin-viewer/relogin-viewer.service.js';

async function bootstrap() {
  assertApiRailwayService();

  const app = await NestFactory.create(AppModule, { bodyParser: false });

  const dashboardOrigins = process.env.DASHBOARD_ORIGIN?.split(',');

  app.enableCors({
    origin: dashboardOrigins ?? true,
    credentials: false,
  });

  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));
  // text() убран — он ломает multipart/form-data

  // Raw WS upgrade for the relogin viewer — deliberately not a Nest gateway/socket.io: this is
  // a single dumb byte-pipe to the worker's private VNC port (see ReloginViewerService.proxy),
  // ticket-authenticated rather than cookie-authenticated because a WS upgrade can't ride
  // SessionAuthGuard the way a normal request does.
  await app.init();

  const reloginViewerService = app.get(ReloginViewerService);
  const wss = new WebSocketServer({ noServer: true });
  const httpServer = app.getHttpServer() as Server;

  httpServer.on(
    'upgrade',
    (request: IncomingMessage, socket: Duplex, head: Buffer) => {
      const url = new URL(request.url ?? '', 'http://internal');

      if (url.pathname !== '/ws/relogin-viewer') {
        return;
      }

      if (
        dashboardOrigins &&
        !dashboardOrigins.includes(request.headers.origin ?? '')
      ) {
        socket.destroy();
        return;
      }

      const ticket = url.searchParams.get('ticket');

      if (!ticket) {
        socket.destroy();
        return;
      }

      reloginViewerService
        .consumeTicket(ticket)
        .then((jobId) => {
          if (!jobId) {
            socket.destroy();
            return;
          }

          wss.handleUpgrade(request, socket, head, (ws) => {
            reloginViewerService.proxy(ws, jobId);
          });
        })
        .catch(() => socket.destroy());
    },
  );

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
