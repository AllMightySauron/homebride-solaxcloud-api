import { Service, AccessoryPlugin, Logging, CharacteristicGetCallback, Characteristic } from 'homebridge';

import { SolaxCloudAPIPlatform } from './platform';

/**
 * Solax Outlet Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class SolaxOutletAccessory implements AccessoryPlugin {
  private readonly platform: SolaxCloudAPIPlatform;
  private readonly log: Logging;
  private readonly name: string;

  private readonly outletService: Service;
  private readonly informationService: Service;

  private model = 'Solax inverter';
  private serial = 'Default serial';

  // power reading in Watt
  private powerConsumption = 0;

  // energy readings in KWh
  private energyConsumption = 0.0;
  private totalEnergyConsumption = 0.0;

  constructor(platform: SolaxCloudAPIPlatform, log: Logging, name: string) {
    this.platform = platform;
    this.log = log;
    this.name = name;

    const hap = this.platform.api.hap;

    this.log.debug(`Creating outlet "${this.name}"`);

    // main outlet service
    this.outletService = new hap.Service.Outlet(name);

    // outlet on/off state
    this.outletService.getCharacteristic(hap.Characteristic.On).
      on(hap.CharacteristicEventTypes.GET, this.getState.bind(this));

    // current consumption
    this.outletService.addOptionalCharacteristic(this.platform.eve.Characteristics.CurrentConsumption);

    // information service
    this.informationService =
      new platform.api.hap.Service.AccessoryInformation()
        .setCharacteristic(hap.Characteristic.Name, this.name)
        .setCharacteristic(hap.Characteristic.Manufacturer, 'Solax');

    this.informationService.getCharacteristic(hap.Characteristic.SerialNumber).onGet(this.getSerial.bind(this));
    this.informationService.getCharacteristic(hap.Characteristic.Model).onGet(this.getModel.bind(this));

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

  /**
   * Handle requests to get the current value of the "Model" characteristic.
   * @returns {string} The model.
   */
  public getModel(): string {
    this.log.debug(`${this.name}: GET Model (model=${this.model})`);

    return this.model;
  }

  /**
   * Sets the model string for Model characteristic.
   * @param {string} model Model to set.
   */
  public setModel(model: string) {
    this.log.debug(`${this.name}: SET Model (model=${model})`);

    this.model = model;
  }

  /**
   * Handle requests to get the current value of the "SerialNumber" characteristic.
   * @returns {string} The inverter serial number.
   */
  public getSerial(): string {
    this.log.debug(`${this.name}: GET Serial (serial=${this.serial})`);

    return this.serial;
  }

  /**
   * Sets model serial information for this outlet.
   * @param {string} serial Serial number to set.
   */
  public setSerial(serial: string) {
    this.log.debug(`${this.name}: SET Serial (serial=${serial})`);

    this.serial = serial;
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
