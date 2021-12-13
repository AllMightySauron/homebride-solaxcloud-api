import { Service, AccessoryPlugin, Logging, CharacteristicGetCallback } from 'homebridge';

import util from 'util';

import { SolaxCloudAPIPlatform } from './platform';
import { SolaxPlatformAccessory } from './platformAccessory';

/** Motion timeout in seconds */
const MOTION_TIMEOUT = 5;

/**
 * Solax Motion Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class SolaxMotionAccessory extends SolaxPlatformAccessory implements AccessoryPlugin {

  private readonly motionService: Service;

  /** Whether motion is detected (data udpated) */
  private motion = false;

  /** Update interval to turn motion back off (in seconds) */
  private motionTimeout: number = MOTION_TIMEOUT;

  constructor(platform: SolaxCloudAPIPlatform, log: Logging, name: string) {
    super(platform, log, name);

    const hap = this.platform.api.hap;

    this.log.debug(`Creating motion sensor "${this.name}"`);

    this.motionService = new hap.Service.MotionSensor(this.name);
    this.motionService
      .getCharacteristic(hap.Characteristic.MotionDetected)
      .on(hap.CharacteristicEventTypes.GET, this.getState.bind(this));

    log.info(`Motion sensor "${name}" created!`);
  }

  sleep = util.promisify(setTimeout);

  /**
   * Gets the motion sensor state Characteristic.
   * @param {CharacteristicGetCallback} callback The callback.
   */
  public getState(callback: CharacteristicGetCallback): void {
    this.log.debug(`${this.name}: GET State (motion=${this.motion})`);

    callback(null, this.motion);
  }

  /**
   * Sets the motion sensor state.
   * @param {boolean} motion Whether motion was detected.
   */
  public setState(motion: boolean) {
    this.log.debug(`${this.name}: SET State (motion=${motion})`);

    this.motionService
      .getCharacteristic(this.platform.api.hap.Characteristic.MotionDetected)
      .updateValue(motion);

    this.motion = motion;

    if (this.motion) {
      // turn it off after timeout
      this.sleep(this.motionTimeout * 1000).then(() => this.setState(false));
    }
  }

  /*
   * This method is called directly after creation of this instance.
   * It should return all services which should be added to the accessory.
   */
  getServices(): Service[] {
    return [
      this.informationService,
      this.motionService,
    ];
  }

}
