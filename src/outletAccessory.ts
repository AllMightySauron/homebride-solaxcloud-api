import { Service, AccessoryPlugin, Logging, CharacteristicGetCallback, Characteristic } from 'homebridge';

import { SolaxCloudAPIPlatform } from './platform';
import { SolaxPlatformAccessory } from './platformAccessory';

import { FakeGatoHistoryService } from 'fakegato-history';

/**
 * Solax Outlet Accessory.
 * Virtual outlet used to monitor and measure both power and total energy consumption from Solax devices.
 * Outlet use is inferred from a positive power comsumption.
 */
export class SolaxOutletAccessory extends SolaxPlatformAccessory implements AccessoryPlugin {

  /**
   * Outlet service with power meter.
   */
  private readonly outletService: Service;

  /**
   * Current power reading in Watt.
   */
  private powerConsumption = 0;

  /**
   * Total energy readings in KWh.
   */
  private totalEnergyConsumption = 0.0;

  /**
   * Elgato Eve fake history service for energy and status.
   */
  private readonly loggingService: FakeGatoHistoryService;

  /**
   * Solax virtual outlet class constructor.
   * @param {SolaxCloudApiPlatform} platform The API Platform for Solax Cloud.
   * @param {Logging} log The platform logging for homebridge.
   * @param {string} name The accessory name.
   * @param {string} serial "Real world" serial number for this accessory.
   * @param {string} model Accessory model.
   */
  constructor(platform: SolaxCloudAPIPlatform, log: Logging, name: string, serial: string, model: string) {
    super(platform, log, name, serial, model);

    const hap = this.platform.api.hap;

    this.log.debug(`Creating outlet "${this.name}"`);

    // create power meter service
    this.outletService = new this.platform.eve.Services.Outlet(this.name);

    // outlet on/off state
    this.outletService.getCharacteristic(hap.Characteristic.On).on(hap.CharacteristicEventTypes.GET, this.getState.bind(this));

    // in use
    //this.outletService.getCharacteristic(hap.Characteristic.OutletInUse).on(hap.CharacteristicEventTypes.GET, this.getState.bind(this));

    // current consumption
    this.outletService.getCharacteristic(this.platform.eve.Characteristics.CurrentConsumption)
      .on(hap.CharacteristicEventTypes.GET, this.getPowerConsumption.bind(this));

    // total consumption
    this.outletService.getCharacteristic(this.platform.eve.Characteristics.TotalConsumption)
      .on(hap.CharacteristicEventTypes.GET, this.getTotalEnergyConsumption.bind(this));

    // history logging services
    this.loggingService = new this.platform.eveService('energy', this, { storage: 'fs', log: this.log } );

    log.info(`Outlet "${name}" created!`);
  }

  /**
   * Sets a characteristic value for a sepecific characteristic.
   * @param {string} charName The characteristic name.
   * @param {number} value The characteristic value to set.
   */
  public setCharacteristicValue(charName: string, value: number) {
    // set up characteristic
    const char: Characteristic | undefined = this.outletService.getCharacteristic(charName);

    if (char) {
      char.updateValue(value);
    }
  }

  /**
   * Gets the current power consumpion.
   */
  public getPowerConsumption(callback: CharacteristicGetCallback): void {
    this.log.debug(`${this.name}: GET Power (power=${this.powerConsumption}W)`);

    callback(null, this.powerConsumption);
  }

  /**
   * Sets the current power consumption.
   * @param {number} powerConsumption The power consumption to set. */
  public setPowerConsumption(powerConsumption: number) {
    this.log.debug(`${this.name}: SET Power (power=${powerConsumption}W)`);

    this.powerConsumption = powerConsumption >= 0 ? powerConsumption: 0;

    this.setCharacteristicValue(this.platform.eve.Characteristics.CurrentConsumption, this.powerConsumption);

    // add entries to history
    this.loggingService.
      addEntry({time: Math.round(new Date().valueOf() / 1000), power: this.powerConsumption });
  }

  /**
   * Gets the total energy consumpion.
   */
  public getTotalEnergyConsumption(callback: CharacteristicGetCallback): void {
    this.log.debug(`${this.name}: GET Total Energy (energy=${this.totalEnergyConsumption}kWh)`);

    callback(null, this.totalEnergyConsumption);
  }

  /**
   * Sets the total energy consumption.
   * @param {number} totalEnergyConsumption The total energy consumption to set.
   */
  public setTotalEnergyConsumption(totalEnergyConsumption: number) {
    this.log.debug(`${this.name}: SET Total Energy (energy=${totalEnergyConsumption}kWh)`);

    this.totalEnergyConsumption = totalEnergyConsumption;

    this.setCharacteristicValue(this.platform.eve.Characteristics.TotalConsumption, this.totalEnergyConsumption);
  }

  /**
   * Gets the outlet state Characteristic based on its consumed power.
   * @param {CharacteristicGetCallback} callback The callback.
   */
  public getState(callback: CharacteristicGetCallback): void {
    this.log.debug(`${this.name}: GET State (power=${this.powerConsumption}W)`);

    callback(null, this.powerConsumption > 0);
  }

  /*
   * This method is called directly after creation of this instance.
   * It should return all services which should be added to the accessory.
   */
  getServices(): Service[] {
    return [
      this.informationService,
      this.outletService,
      this.loggingService,
    ];
  }

}
