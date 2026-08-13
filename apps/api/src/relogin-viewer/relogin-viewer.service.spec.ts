import type { Redis } from 'ioredis';
import type { WebSocket } from 'ws';
import { ReloginViewerService } from './relogin-viewer.service';

function makeWebSocket(overrides: { close?: jest.Mock } = {}) {
  return {
    close: overrides.close ?? jest.fn(),
    readyState: 1,
    OPEN: 1,
    CONNECTING: 0,
    on: jest.fn(),
    send: jest.fn(),
  } as unknown as WebSocket;
}

function makeRedis(overrides: { set?: jest.Mock; getdel?: jest.Mock } = {}) {
  return {
    set: overrides.set ?? jest.fn().mockResolvedValue('OK'),
    getdel: overrides.getdel ?? jest.fn().mockResolvedValue(null),
    quit: jest.fn().mockResolvedValue('OK'),
  } as unknown as Redis;
}

describe('ReloginViewerService#mintTicket', () => {
  it('stores the ticket in Redis with a single-use, short-TTL, NX write and returns it', async () => {
    const set = jest.fn().mockResolvedValue('OK');
    const service = new ReloginViewerService(makeRedis({ set }));

    const ticket = await service.mintTicket('job-1');

    expect(ticket).toMatch(/^[0-9a-f]{64}$/);
    expect(set).toHaveBeenCalledWith(
      `relogin-viewer:${ticket}`,
      'job-1',
      'PX',
      60_000,
      'NX',
    );
  });

  it('mints a different ticket on every call', async () => {
    const service = new ReloginViewerService(makeRedis());

    const first = await service.mintTicket('job-1');
    const second = await service.mintTicket('job-1');

    expect(first).not.toBe(second);
  });
});

describe('ReloginViewerService#consumeTicket', () => {
  it('deletes on read (via GETDEL) so a ticket can never be replayed', async () => {
    const getdel = jest.fn().mockResolvedValue('job-1');
    const service = new ReloginViewerService(makeRedis({ getdel }));

    const jobId = await service.consumeTicket('abc');

    expect(jobId).toBe('job-1');
    expect(getdel).toHaveBeenCalledWith('relogin-viewer:abc');
  });

  it('returns null for an unknown or already-consumed ticket', async () => {
    const service = new ReloginViewerService(
      makeRedis({ getdel: jest.fn().mockResolvedValue(null) }),
    );

    expect(await service.consumeTicket('missing')).toBeNull();
  });
});

describe('ReloginViewerService#proxy', () => {
  const originalHost = process.env.WORKER_VNC_HOST;

  afterEach(() => {
    if (originalHost === undefined) {
      delete process.env.WORKER_VNC_HOST;
    } else {
      process.env.WORKER_VNC_HOST = originalHost;
    }
  });

  it('closes the connection with an error code instead of connecting when unconfigured', () => {
    delete process.env.WORKER_VNC_HOST;
    const service = new ReloginViewerService(makeRedis());
    const close = jest.fn();
    const ws = makeWebSocket({ close });

    service.proxy(ws, 'job-1');

    expect(close).toHaveBeenCalledWith(1011, 'Viewer is not configured.');
  });
});
