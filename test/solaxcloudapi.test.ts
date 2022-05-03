import { SolaxCloudAPI, SolaxCloudAPIResponse } from '../src/solaxcloudapi';

import assert from 'assert';

describe('SolaxCloudAPI: Static methods', () => {

  const sampleReply: SolaxCloudAPIResponse = {
    success: true,
    exception: 'Query success!',
    result: {
      inverterSN: 'HUE512H3456789',
      sn: 'ABCDEFGHIJ',
      acpower: 1214,
      yieldtoday: 1.1,
      yieldtotal: 121.1,
      feedinpower: 37,
      feedinenergy: 24.65,
      consumeenergy: 433.09,
      feedinpowerM2: 0,
      soc: 25,
      peps1: 0,
      peps2: null,
      peps3: null,
      inverterType: '3',
      inverterStatus: '102',
      uploadTime: '2021-12-06 10:16:59',
      batPower: -21,
      powerdc1: 0,
      powerdc2: 1258,
      powerdc3: null,
      powerdc4: null,
    },
  };

  it('PV Power', () => {
    assert.strictEqual(1258, SolaxCloudAPI.getPVPower(sampleReply.result));
  });

  it('Battery SoC', () => {
    assert.strictEqual(25, SolaxCloudAPI.getBatterySoC(sampleReply.result));
  });

  it('From Battery', () => {
    assert.strictEqual(21, SolaxCloudAPI.getInverterPowerFromBattery(sampleReply.result));
  });

  it('To Battery', () => {
    assert.strictEqual(0, SolaxCloudAPI.getInverterPowerToBattery(sampleReply.result));
  });

  it('Inverter AC Power', () => {
    assert.strictEqual(1214, SolaxCloudAPI.getInverterACPower(sampleReply.result));
  });

  it('Yield Today', () => {
    assert.strictEqual(1.1, SolaxCloudAPI.getYieldToday(sampleReply.result));
  });


  it('Yield Total', () => {
    assert.strictEqual(121.1, SolaxCloudAPI.getYieldTotal(sampleReply.result));
  });

  it('Inverter power to grid', () => {
    assert.strictEqual(37, SolaxCloudAPI.getInverterPowerToGrid(sampleReply.result));
  });

  it('Grid power to house', () => {
    assert.strictEqual(0, SolaxCloudAPI.getGridPowerToHouse(sampleReply.result));
  });

});

describe('SolaxCloudAPI: Multiple inverters', () => {

  const inverter1Data: SolaxCloudAPIResponse = {
    success: true,
    exception: 'Query success!',
    result: {
      inverterSN: 'XPTO1',
      sn: 'ABC123',
      acpower: -522.0,
      yieldtoday: 0.3,
      yieldtotal: 6726.6,
      feedinpower: -48.0,
      feedinenergy: 4820.32,
      consumeenergy: 4743.47,
      feedinpowerM2: 0.0,
      soc: 22.0,
      peps1: 0.0,
      peps2: 0.0,
      peps3 : 0.0,
      inverterType: '5',
      inverterStatus: '102',
      uploadTime: '2022-04-05 10:10:27',
      batPower: 2326.0,
      powerdc1: 1182.0,
      powerdc2: 698.0,
      powerdc3: null,
      powerdc4: null,
    },
  };
  const inverter2Data: SolaxCloudAPIResponse = {
    success: true,
    exception: 'Query success !',
    result: {
      inverterSN: 'XPTO2',
      sn: 'ABC123',
      acpower: 1056.0,
      yieldtoday: 1.3,
      yieldtotal: 3989.1,
      feedinpower: 0.0,
      feedinenergy: 0.0,
      consumeenergy: 0.0,
      feedinpowerM2: 0.0,
      soc: 0.0,
      peps1: 0.0,
      peps2: 0.0,
      peps3 : 0.0,
      inverterType: '7',
      inverterStatus: '102',
      uploadTime: '2022-04-05 10:10:13',
      batPower: 0.0,
      powerdc1: 479.0,
      powerdc2: 683.0,
      powerdc3: null,
      powerdc4: null,
    },
  };

  it('PV Power', () => {
    assert.strictEqual(3042, SolaxCloudAPI.getPVPower(inverter1Data.result) + SolaxCloudAPI.getPVPower(inverter2Data.result));
  });

  it('Battery SoC', () => {
    assert.strictEqual(22, SolaxCloudAPI.getBatterySoC(inverter1Data.result) + SolaxCloudAPI.getBatterySoC(inverter2Data.result));
  });

  it('From Battery', () => {
    assert.strictEqual(0, SolaxCloudAPI.getInverterPowerFromBattery(inverter1Data.result) +
                          SolaxCloudAPI.getInverterPowerFromBattery(inverter2Data.result));
  });

  it('To Battery', () => {
    assert.strictEqual(2326, SolaxCloudAPI.getInverterPowerToBattery(inverter1Data.result) +
                             SolaxCloudAPI.getInverterPowerToBattery(inverter2Data.result));
  });

  it('Inverter AC Power', () => {
    assert.strictEqual(534, SolaxCloudAPI.getInverterACPower(inverter1Data.result) +
                           SolaxCloudAPI.getInverterACPower(inverter2Data.result));
  });

  it('Inverter power to grid', () => {
    assert.strictEqual(0, SolaxCloudAPI.getInverterPowerToGrid(inverter1Data.result) +
                          SolaxCloudAPI.getInverterPowerToGrid(inverter2Data.result));
  });

  it('Grid power to house', () => {
    assert.strictEqual(48, SolaxCloudAPI.getGridPowerToHouse(inverter1Data.result) +
                           SolaxCloudAPI.getGridPowerToHouse(inverter2Data.result));
  });

});