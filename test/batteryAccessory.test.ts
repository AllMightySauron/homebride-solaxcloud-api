import assert = require('assert');

import { BATTERY_CHARGING_STATE, SolaxBatteryAccessory } from '../src/batteryAccessory';
import { createApi, createLog } from './helpers';

describe('SolaxBatteryAccessory', () => {
  it('keeps charge state getter in sync after updates', () => {
    const battery = new SolaxBatteryAccessory(createLog(), createApi(), 'Battery', 'bat-test', 'Test Model');

    battery.setChargeState(BATTERY_CHARGING_STATE.CHARGING);
    assert.equal(battery.getChargeStateValue(), BATTERY_CHARGING_STATE.CHARGING);

    battery.setChargeState(BATTERY_CHARGING_STATE.NOT_CHARGEABLE);
    assert.equal(battery.getChargeStateValue(), BATTERY_CHARGING_STATE.NOT_CHARGEABLE);
  });
});
