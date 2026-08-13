import { BadRequestException } from '@nestjs/common';
import { ReloginViewerController } from './relogin-viewer.controller';

function makeController(
  overrides: { reloginViewerService?: any; queueService?: any } = {},
) {
  return new ReloginViewerController(
    overrides.reloginViewerService ?? {},
    overrides.queueService ?? {},
  );
}

describe('ReloginViewerController#mintTicket', () => {
  it('rejects when jobId is missing', async () => {
    const controller = makeController();

    await expect(controller.mintTicket(undefined)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects when jobId is blank', async () => {
    const controller = makeController();

    await expect(controller.mintTicket('   ')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects when the relogin job is not currently running', async () => {
    const controller = makeController({
      queueService: {
        getJobDetails: jest.fn().mockResolvedValue({ status: 'completed' }),
      },
    });

    await expect(controller.mintTicket('job-1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects when the relogin job is unknown', async () => {
    const controller = makeController({
      queueService: {
        getJobDetails: jest.fn().mockResolvedValue({ status: 'unknown' }),
      },
    });

    await expect(controller.mintTicket('job-1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it.each(['active', 'waiting', 'delayed'])(
    'mints a ticket when the job status is "%s"',
    async (status) => {
      const mintTicket = jest.fn().mockResolvedValue('ticket-abc');
      const controller = makeController({
        queueService: {
          getJobDetails: jest.fn().mockResolvedValue({ status }),
        },
        reloginViewerService: { mintTicket },
      });

      const result = await controller.mintTicket('job-1');

      expect(mintTicket).toHaveBeenCalledWith('job-1');
      expect(result).toEqual({ ticket: 'ticket-abc', expiresInMs: 60_000 });
    },
  );
});
