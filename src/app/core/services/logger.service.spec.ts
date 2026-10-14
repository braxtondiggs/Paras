import { environment } from '@environments/environment';
import { createServiceFactory, type SpectatorService } from '@ngneat/spectator/jest';

import { LoggerService } from './logger.service';

describe('LoggerService', () => {
  let spectator: SpectatorService<LoggerService>;
  const createService = createServiceFactory(LoggerService);
  const originalProduction = environment.production;

  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    errorSpy = jest.spyOn(console, 'error').mockImplementation();
    spectator = createService();
  });

  afterEach(() => {
    environment.production = originalProduction;
    jest.restoreAllMocks();
  });

  describe('when production is false', () => {
    beforeEach(() => {
      environment.production = false;
    });

    it('log forwards the message and args to console.log', () => {
      const err = new Error('boom');
      spectator.service.log('Loaded', 3, err);

      expect(logSpy).toHaveBeenCalledWith('Loaded', 3, err);
    });

    it('warn forwards the message and args to console.warn', () => {
      spectator.service.warn('Careful', { id: 1 });

      expect(warnSpy).toHaveBeenCalledWith('Careful', { id: 1 });
    });

    it('error forwards the message and args to console.error', () => {
      const err = new Error('boom');
      spectator.service.error('Failed:', err);

      expect(errorSpy).toHaveBeenCalledWith('Failed:', err);
    });
  });

  describe('when production is true', () => {
    beforeEach(() => {
      environment.production = true;
    });

    it('log is a no-op', () => {
      spectator.service.log('Loaded');

      expect(logSpy).not.toHaveBeenCalled();
    });

    it('warn is a no-op', () => {
      spectator.service.warn('Careful');

      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('error still forwards to console.error', () => {
      const err = new Error('boom');
      spectator.service.error('Failed:', err);

      expect(errorSpy).toHaveBeenCalledWith('Failed:', err);
    });
  });
});
