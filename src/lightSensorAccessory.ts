import { AccessoryPlugin, API, CharacteristicEventTypes, CharacteristicGetCallback, Logging, Service } from 'homebridge';

import { SolaxPlatformAccessory } from './platformAccessory';

/**
 * Solax Light Sensor Accessory.
 * Virtual light sensor used to monitor and measure both power consumption from Solax devices
 * (for "Home app"-only purists).
 * Using Lux to display power comsumption.
 */
export class SolaxLightSensorAccessory extends SolaxPlatformAccessory implements AccessoryPlugin {
  private readonly lightService: Service;

  /**
   * Ambient light level.
   */
  private lux = 0;

  /**
   * Solax virtual light sensor class constructor.
   * @param {Logging} log The platform logging for homebridge.
   * @param {API} api The platform API.
   * @param {string} name The accessory name.
   * @param {string} serial "Real world" serial number for this accessory.
   * @param {string} model Accessory model.
   */
  constructor(log: Logging, api: API, name: string, serial: string, model: string) {
    super(log, api, name, serial, model);

    this.log.debug(`Creating light sensor "${this.name}"`);

    this.lightService = new this.api.hap.Service.LightSensor(name);

    this.lightService
      .getCharacteristic(this.api.hap.Characteristic.CurrentAmbientLightLevel)
      .on(CharacteristicEventTypes.GET, this.getAmbientLightLevel.bind(this));

    log.info(`Light sensor (watts reader) "${name}" created!`);
  }

  /**
   * Gets the current ambient light level (power consumpion in Watts).
   */
  public getAmbientLightLevel(callback: CharacteristicGetCallback): void {
    this.log.debug(`${this.name}: GET Ambient Light Level (lux=${this.lux})`);

    callback(null, this.lux);
  }

  /**
   * Sets the current ambient light level (power consumption in Watts).
   * @param {number} lux The lux (power consumption) value to set.
   */
  public setAmbientLightLevel(lux: number) {
    this.log.debug(`${this.name}: SET Ambient Light Level (lux=${lux})`);

    // Minimum value allowed for light sensor is 0.1
    this.lux = Math.max(0.1, lux);

    this.lightService.updateCharacteristic(this.api.hap.Characteristic.CurrentAmbientLightLevel, this.lux);
  }

  /*
   * This method is called directly after creation of this instance.
   * It should return all services which should be added to the accessory.
   */
  getServices(): Service[] {
    return [ this.informationService, this.lightService ];
  }

}
