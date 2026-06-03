import { API, Logging } from 'homebridge';
import { Characteristic, Service } from 'hap-nodejs';
import os from 'os';
import path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { CharacteristicEventTypes, Formats, Perms } = require('hap-nodejs');

export function createLog(): Logging {
  const noop = () => undefined;

  return Object.assign(noop, {
    debug: noop,
    error: noop,
    info: noop,
    warn: noop,
    log: noop,
    prefix: '',
  }) as unknown as Logging;
}

export function createApi(): API {
  return {
    hap: {
      Characteristic,
      CharacteristicEventTypes,
      Formats,
      Perms,
      Service,
    },
    on: () => undefined,
    user: {
      storagePath: () => path.join(os.tmpdir(), 'homebridge-solaxcloud-api-test'),
    },
  } as unknown as API;
}
