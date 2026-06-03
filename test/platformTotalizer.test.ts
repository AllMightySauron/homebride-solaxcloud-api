import { API, Logging, PlatformConfig } from 'homebridge';

import assert = require('assert');

import { SolaxCloudAPIPlatform } from '../src/platform';
import { SolaxCloudAPIPlatformInverter } from '../src/platformInverter';
import { createApi, createLog } from './helpers';

interface InverterCreation {
  brand: number;
  tokenId: string;
  sn: string;
  name: string;
  hasBattery: boolean;
  smoothingWindow: number;
  virtual: boolean;
  brandName?: string;
}

let inverterCreations: InverterCreation[] = [];

class TestSolaxCloudAPIPlatform extends SolaxCloudAPIPlatform {
  protected createPlatformInverter(log: Logging, config: PlatformConfig, api: API,
    brand: number, tokenId: string, sn: string,
    name: string, hasBattery: boolean,
    smoothingWindow: number,
    virtual = false,
    brandName?: string): SolaxCloudAPIPlatformInverter {
    inverterCreations.push({ brand, tokenId, sn, name, hasBattery, smoothingWindow, virtual, brandName });

    return {
      getAccessories: () => [],
      hasBattery: () => hasBattery,
    } as unknown as SolaxCloudAPIPlatformInverter;
  }

  protected async fetchDataPeriodically(): Promise<void> {
    return;
  }
}

function createConfig(brands: string[]): PlatformConfig {
  return {
    platform: 'SolaxCloudAPI',
    pollingFrequency: 300,
    inverters: brands.map((brand, index) => ({
      brand,
      tokenId: `2020072218511123456789${index}`,
      name: `Test inverter ${index}`,
      sn: `ABCDEFGHI${index}`,
      hasBattery: index === 0,
    })),
  };
}

function createPlatform(config: PlatformConfig): void {
  inverterCreations = [];

  new TestSolaxCloudAPIPlatform(createLog(), config, createApi());
}

describe('SolaxCloudAPIPlatform totalizer inverter creation', () => {
  it('creates a virtual totalizer without cloud credentials when all inverters use Solax', () => {
    createPlatform(createConfig(['solax', 'solax']));

    const totalizer = inverterCreations[2];

    assert.equal(inverterCreations.length, 3);
    assert.equal(totalizer.name, 'All inverters');
    assert.equal(totalizer.tokenId, '');
    assert.equal(totalizer.virtual, true);
    assert.equal(totalizer.brandName, 'Solax');
    assert.equal(totalizer.hasBattery, true);
  });

  it('creates a virtual totalizer with QCells as brand when all inverters use QCells', () => {
    createPlatform(createConfig(['qcells', 'qcells']));

    const totalizer = inverterCreations[2];

    assert.equal(totalizer.name, 'All inverters');
    assert.equal(totalizer.tokenId, '');
    assert.equal(totalizer.virtual, true);
    assert.equal(totalizer.brandName, 'QCells');
  });

  it('creates a virtual totalizer with mixed brand name when inverter brands differ', () => {
    createPlatform(createConfig(['solax', 'qcells']));

    const totalizer = inverterCreations[2];

    assert.equal(totalizer.name, 'All inverters');
    assert.equal(totalizer.tokenId, '');
    assert.equal(totalizer.virtual, true);
    assert.equal(totalizer.brandName, 'Solax/QCells');
  });
});
