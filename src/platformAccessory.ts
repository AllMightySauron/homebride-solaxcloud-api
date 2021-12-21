import { Service, AccessoryPlugin, Logging } from 'homebridge';

import { SolaxCloudAPIPlatform } from './platform';
import { Util } from './util';

import os from 'os';
import hash from 'string-hash-64';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const plugin = require('../package.json');

/**
 * Solax Cloud generic platform accessory.
 * Handles basic info: accessory name, manufacturer (Solax), inverter model and serial number.
 */
export class SolaxPlatformAccessory implements AccessoryPlugin {
  /**
   * Accessory platform.
   */
  protected readonly platform: SolaxCloudAPIPlatform;

  /**
   * Accessory logging.
   */
  protected readonly log: Logging;

  /**
   * Accessory name.
   */
  protected readonly name: string;

  /**
   * Acessory display name.
   */
  protected readonly displayName: string;

  /**
   * Accessory serial number (string from 64 bit hash)
   */
  protected serialNumber: string;

  /**
   * Accessory model.
   */
  protected model = 'Solax inverter';

  /**
   * Accessory HomeKit information service.
   */
  protected readonly informationService: Service;

  /**
   * Virtual accessory main class constructor.
   * @param {SolaxCloudApiPlatform} platform The API Platform for Solax Cloud.
   * @param {Logging} log The platform logging for homebridge.
   * @param {string} name The accessory name.
   * @param {string} serial "Real-world" serial number for this accessory.
   * @param {string} model Accessory model.
   */
  constructor(platform: SolaxCloudAPIPlatform, log: Logging, name: string, serialNumber: string, model: string) {
    this.platform = platform;
    this.log = log;

    // name
    this.name = name;

    // display name
    this.displayName = name;

    // hash "real-world" serial and hostname to 64 bit hex string
    this.serialNumber = hash(`${serialNumber}-${os.hostname()}`).toString(16);

    // remove non-standard chars from model name
    this.model = Util.normalizeName(model);

    const hap = this.platform.api.hap;

    // information service
    this.informationService =
      new hap.Service.AccessoryInformation()
        .setCharacteristic(hap.Characteristic.Name, this.name)
        .setCharacteristic(hap.Characteristic.Manufacturer, 'Solax')
        .setCharacteristic(hap.Characteristic.FirmwareRevision, plugin.version)
        .setCharacteristic(hap.Characteristic.SerialNumber, this.serialNumber)
        .setCharacteristic(hap.Characteristic.Model, this.model);

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
    this.informationService.setCharacteristic(this.platform.api.hap.Characteristic.Model, model);
  }

  /**
   * Handle requests to get the current value of the "SerialNumber" characteristic.
   * @returns {string} The inverter serial number.
   */
  public getSerial(): string {
    this.log.debug(`${this.name}: GET Serial (serial=${this.serialNumber})`);

    return this.serialNumber;
  }

  /**
   * Sets model serial information for this outlet.
   * @param {string} serial Serial number to set.
   */
  public setSerial(serial: string) {
    this.log.debug(`${this.name}: SET Serial (serial=${serial})`);

    this.serialNumber = serial;
    this.informationService.setCharacteristic(this.platform.api.hap.Characteristic.SerialNumber, serial);
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
