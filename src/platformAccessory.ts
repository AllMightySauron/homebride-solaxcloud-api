import { Service, AccessoryPlugin, Logging } from 'homebridge';

import { SolaxCloudAPIPlatform } from './platform';

/**
 * Platform Accessory.
 * Generic platform accessory to store accessory name, manufacturer (Solax), inverter model and serial number.
 */
export class SolaxPlatformAccessory implements AccessoryPlugin {
  protected readonly platform: SolaxCloudAPIPlatform;
  protected readonly log: Logging;
  protected readonly name: string;

  protected readonly informationService: Service;

  protected model = 'Solax inverter';
  protected serial = 'Default serial';

  constructor(platform: SolaxCloudAPIPlatform, log: Logging, name: string) {
    this.platform = platform;
    this.log = log;
    this.name = name;

    const hap = this.platform.api.hap;

    // information service
    this.informationService =
      new hap.Service.AccessoryInformation()
        .setCharacteristic(hap.Characteristic.Name, this.name)
        .setCharacteristic(hap.Characteristic.Manufacturer, 'Solax');

    this.informationService.getCharacteristic(hap.Characteristic.SerialNumber).onGet(this.getSerial.bind(this));
    this.informationService.getCharacteristic(hap.Characteristic.Model).onGet(this.getModel.bind(this));
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
    ];
  }

}
