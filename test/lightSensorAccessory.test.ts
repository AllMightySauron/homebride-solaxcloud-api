import assert = require('assert');

import { SolaxLightSensorAccessory } from '../src/lightSensorAccessory';
import { createApi, createLog } from './helpers';

describe('SolaxLightSensorAccessory', () => {
  it('stores ambient light values and applies the HomeKit minimum', () => {
    const sensor = new SolaxLightSensorAccessory(createLog(), createApi(), 'Light sensor', 'light-1', 'Model');

    sensor.setAmbientLightLevel(0);
    sensor.getAmbientLightLevel((error, value) => {
      assert.equal(error, null);
      assert.equal(value, 0.1);
    });

    sensor.setAmbientLightLevel(123);
    sensor.getAmbientLightLevel((error, value) => {
      assert.equal(error, null);
      assert.equal(value, 123);
    });
  });

  it('exposes information and light services', () => {
    const sensor = new SolaxLightSensorAccessory(createLog(), createApi(), 'Light sensor', 'light-1', 'Model');

    assert.equal(sensor.getServices().length, 2);
  });
});
