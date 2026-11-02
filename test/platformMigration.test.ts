import {
  API,
  APIEvent,
  Logging,
  PlatformConfig,
} from 'homebridge';
import type { MatterAccessory, MatterAPI, PlatformAccessory } from 'homebridge';
import { PlatformAccessory as RuntimePlatformAccessory } from '../node_modules/homebridge/dist/platformAccessory.js';

import assert from 'assert';

import { SolaxOutletAccessory } from '../src/outletAccessory.js';
import { SolaxCloudAPIPlatform } from '../src/platform.js';
import { SolaxCloudAPIPlatformInverter } from '../src/platformInverter.js';
import { createApi, createLog, createMatterApi } from './helpers.js';

interface MigrationHarness {
  api: API;
  finishLaunching: () => void;
  registrations: PlatformAccessory[][];
  updates: PlatformAccessory[][];
}

class MigrationTestPlatform extends SolaxCloudAPIPlatform {
  protected createPlatformInverter(
    log: Logging,
    _config: PlatformConfig,
    api: API,
    _brand: number,
    _tokenId: string,
    _sn: string,
    _name: string,
    _hasBattery: boolean,
    _smoothingWindow: number,
  ): SolaxCloudAPIPlatformInverter {
    const displayName = _config.migrationDisplayName ?? 'Renamed Outlet';
    const uuidBase = _config.migrationUuidBase ?? 'Original Outlet';
    const outlet = new SolaxOutletAccessory(
      log,
      api,
      displayName,
      'outlet-test',
      'Test Model',
      false,
      uuidBase,
      api.matter ? {
        displayName: `${displayName} sensor`,
        serialNumber: 'outlet-test',
        supportsEnergy: false,
      } : undefined,
    );

    return {
      getAccessories: () => [outlet],
      hasBattery: () => false,
    } as unknown as SolaxCloudAPIPlatformInverter;
  }

  protected async fetchDataPeriodically(): Promise<void> {
    return;
  }
}

function createMigrationHarness(matter?: MatterAPI): MigrationHarness {
  const api = createApi(matter);
  const registrations: PlatformAccessory[][] = [];
  const updates: PlatformAccessory[][] = [];
  const finishLaunchingListeners: Array<() => void> = [];

  api.platformAccessory = RuntimePlatformAccessory;
  api.on = (event, listener) => {
    if (event === APIEvent.DID_FINISH_LAUNCHING) {
      finishLaunchingListeners.push(listener);
    }
    return api;
  };
  api.registerPlatformAccessories = (
    _pluginIdentifier,
    _platformName,
    accessories,
  ) => registrations.push(accessories);
  api.updatePlatformAccessories = accessories => updates.push(accessories);

  return {
    api,
    finishLaunching: () => finishLaunchingListeners.forEach(listener => listener()),
    registrations,
    updates,
  };
}

function createConfig(overrides: Partial<PlatformConfig> = {}): PlatformConfig {
  return {
    platform: 'SolaxCloudAPI',
    pollingFrequency: 300,
    smoothMeters: false,
    enableHistory: false,
    inverters: [{
      brand: 'solax',
      tokenId: '20200722185111234567890',
      name: 'Test inverter',
      sn: 'ABCDEFGHIJ',
      hasBattery: false,
    }],
    ...overrides,
  };
}

describe('SolaxCloudAPIPlatform dynamic migration', () => {
  it('registers the first dynamic accessory with the legacy static-platform UUID', () => {
    const harness = createMigrationHarness();

    new MigrationTestPlatform(createLog(), createConfig(), harness.api);
    harness.finishLaunching();

    assert.equal(harness.registrations.length, 1);
    assert.equal(harness.registrations[0].length, 1);
    assert.equal(
      harness.registrations[0][0].UUID,
      harness.api.hap.uuid.generate('SolaxCloudAPI:Original Outlet'),
    );
    assert.equal(harness.updates.length, 0);
  });

  it('preserves a qualified legacy platform identifier in the HAP UUID seed', () => {
    const harness = createMigrationHarness();

    new MigrationTestPlatform(createLog(), createConfig({
      platform: 'homebridge-solaxcloud-api.SolaxCloudAPI',
    }), harness.api);
    harness.finishLaunching();

    assert.equal(
      harness.registrations[0][0].UUID,
      harness.api.hap.uuid.generate(
        'homebridge-solaxcloud-api.SolaxCloudAPI:Original Outlet',
      ),
    );
  });

  it('reuses and refreshes the same cached PlatformAccessory on restart', () => {
    const firstRun = createMigrationHarness();
    new MigrationTestPlatform(createLog(), createConfig(), firstRun.api);
    firstRun.finishLaunching();
    const cachedAccessory = firstRun.registrations[0][0];

    const secondRun = createMigrationHarness();
    const platform = new MigrationTestPlatform(createLog(), createConfig(), secondRun.api);
    platform.configureAccessory(cachedAccessory);
    secondRun.finishLaunching();

    assert.equal(secondRun.registrations.length, 0);
    assert.equal(secondRun.updates.length, 1);
    assert.strictEqual(secondRun.updates[0][0], cachedAccessory);
    assert.equal(cachedAccessory.displayName, 'Renamed Outlet');
    assert.ok(cachedAccessory.services.some(service => service.displayName === 'Renamed Outlet'));
  });

  it('does not unregister an unclaimed cached HAP accessory during the beta migration', () => {
    const harness = createMigrationHarness();
    const platform = new MigrationTestPlatform(createLog(), createConfig(), harness.api);
    const orphan = new RuntimePlatformAccessory(
      'Previous Accessory',
      harness.api.hap.uuid.generate('SolaxCloudAPI:Previous Accessory'),
    );

    platform.configureAccessory(orphan);
    harness.finishLaunching();

    assert.equal(harness.registrations.length, 1);
    assert.equal(harness.updates.length, 0);
    assert.equal(orphan.displayName, 'Previous Accessory');
  });

  it('re-registers the same Matter UUID after Homebridge restores it', () => {
    const matter = createMatterApi();
    const harness = createMigrationHarness(matter.api);
    const platform = new MigrationTestPlatform(createLog(), createConfig(), harness.api);
    const registered = matter.registrations[0][0];
    const restored = { ...registered } as MatterAccessory;

    platform.configureMatterAccessory(restored);
    harness.finishLaunching();

    assert.equal(matter.registrations.length, 1);
    assert.equal(registered.UUID, restored.UUID);
    assert.equal(
      registered.UUID,
      harness.api.hap.uuid.generate('outlet-test-matter-power'),
    );
  });
});
