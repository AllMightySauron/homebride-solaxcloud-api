import { SolaxCloudAPI, SolaxCloudAPIResponse } from '../src/solaxcloudapi';

import assert = require('assert');

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
      soc: 0,
      peps1: 0,
      peps2: null,
      peps3: null,
      inverterType: '3',
      inverterStatus: '102',
      uploadTime: '2021-12-06 10:16:59',
      batPower: 0,
      powerdc1: 0,
      powerdc2: 1258,
      powerdc3: null,
      powerdc4: null,
    },
  };

  it('PV Power', () => {
    assert.strictEqual(1258, SolaxCloudAPI.getPVPower(sampleReply.result));
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