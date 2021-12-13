import { Service, AccessoryPlugin, Logging, CharacteristicGetCallback, Characteristic } from 'homebridge';

import { SolaxCloudAPIPlatform } from './platform';
import { SolaxPlatformAccessory } from './platformAccessory';

/**
 * Solax Outlet Accessory.
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class SolaxOutletAccessory extends SolaxPlatformAccessory implements AccessoryPlugin {

  private readonly outletService: Service;

  // power reading in Watt
  private powerConsumption = 0;

  // energy readings in KWh
  private energyConsumption = 0.0;
  private totalEnergyConsumption = 0.0;

  constructor(platform: SolaxCloudAPIPlatform, log: Logging, name: string) {
    super(platform, log, name);

    const hap = this.platform.api.hap;

    this.log.debug(`Creating outlet "${this.name}"`);

    // main outlet service
    this.outletService = new hap.Service.Outlet(name);

    // outlet on/off state
    this.outletService.getCharacteristic(hap.Characteristic.On).
      on(hap.CharacteristicEventTypes.GET, this.getState.bind(this));

    // current consumption
    this.outletService.addOptionalCharacteristic(this.platform.eve.Characteristics.CurrentConsumption);

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
      char.setValue(value);
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

    this.powerConsumption = powerConsumption;

    this.setCharacteristicValue(this.platform.eve.Characteristics.CurrentConsumption, this.powerConsumption);
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
    ];
  }

}
