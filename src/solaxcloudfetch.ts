/* eslint-disable no-console */
import { SolaxCloudAPI } from './solaxcloudapi';

import fs from 'fs';

const config = JSON.parse(fs.readFileSync('config.json').toString());
const api = new SolaxCloudAPI(config.platforms[0].brand, config.platforms[0].tokenId, config.platforms[0].inverters[0].sn);

const result = api.getAPIData();

console.log(`PV Power: ${SolaxCloudAPI.getPVPower(result.result)}W`);

console.log(`Battery SoC: ${SolaxCloudAPI.getBatterySoC(result.result)}%`);
console.log(`Inverter Power To Battery: ${SolaxCloudAPI.getInverterPowerToBattery(result.result)}W`);
console.log(`Inverter Power From Battery: ${SolaxCloudAPI.getInverterPowerFromBattery(result.result)}W`);

console.log(`Inverter AC Power: ${SolaxCloudAPI.getInverterACPower(result.result)}W`);
console.log(`Grid Power to House: ${SolaxCloudAPI.getGridPowerToHouse(result.result)}W`);
console.log(`Inverter Power to Grid: ${SolaxCloudAPI.getInverterPowerToGrid(result.result)}W`);
console.log(`Inverter Power to House: ${SolaxCloudAPI.getInverterPowerToHouse(result.result)}W`);

console.log(`Yield Today: ${SolaxCloudAPI.getYieldToday(result.result)}KWh`);
console.log(`Yield Total: ${SolaxCloudAPI.getYieldTotal(result.result)}KWh`);