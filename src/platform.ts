import { AccessoryPlugin, API, StaticPlatformPlugin, Logging, PlatformConfig, APIEvent } from 'homebridge';

import { Util } from './util';
import { SolaxCloudAPIPlatformInverter, ACCESSORY_KEYS } from './platformInverter';

/**
 * Valid smoothing methods (Simple Moving Average, Exponential Moving Average).
 */
const VALID_SMOOTHING_METHODS = [ 'sma', 'ema' ];

/**
 * Default smoothing method (simple moving average).
 */
const DEFAULT_SMOOTHING_METHOD = 'sma';

/**
 * Default polling frequency from Solax Cloud (in seconds).
 */
const DEFAULT_POLLING_FREQUENCY = 300;

/**
 * Max polls / min (obtain frequency need to be lower than 10 times/min).
 */
const MAX_POLLS_MIN = 10;

/**
 * Max polls / day (obtain frequency need to be lower than 10,000 times/day).
 */
const MAX_POLLS_DAY = 10000;

/**
 * Maximum polling frequency (in seconds).
 */
const MAX_POLLING_FREQUENCY = Math.max(60 / MAX_POLLS_MIN, (24 * 60 * 60) / MAX_POLLS_DAY);

/**
 * Type definition for inverter in configuration file.
 */
interface InverterConfig {
  name: string;
  sn: string;
}

/**
 * SolaxCloudAPIPlatform.
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class SolaxCloudAPIPlatform implements StaticPlatformPlugin {
  private readonly log: Logging;
  private readonly config: PlatformConfig;
  private readonly api: API;

  /**
   * Number of periods to use for data smoothing.
   */
  private smoothingWindow = 1;

  /**
   * Array of inverters.
   */
  private inverters: SolaxCloudAPIPlatformInverter[] = [];

  /**
   * Inverter totalizer.
   **/
  private allInverters!: SolaxCloudAPIPlatformInverter;

  /**
   * Platform constructor.
   * @param log
   * @param config
   * @param api
   * @returns
   */
  constructor (log: Logging, config: PlatformConfig, api: API) {
    // store values in properties
    this.log = log;
    this.config = config;
    this.api = api;

    // sanity check
    if (!api || !config) {
      return;
    }

    // check for valid config
    if (!this.checkConfig(this.config)) {
      return;
    }

    // window for smoothing (aim for a 15 minute window)
    this.smoothingWindow = Math.floor(15 * 60 / this.config.pollingFrequency);
    this.log.info(`Window for smoothing series is ${this.smoothingWindow} periods.`);

    try {
      // loop over configured inverters
      this.config.inverters.forEach(inverter => {
        // setup new inverter
        const platformInverter: SolaxCloudAPIPlatformInverter =
          new SolaxCloudAPIPlatformInverter(log, config, api,
            this.config.tokenId, inverter.sn, inverter.name, inverter.hasBattery,
            this.smoothingWindow);

        // add new inverter to list
        this.inverters.push(platformInverter);
      });

      // create inverter totalizers
      if (this.inverters.length > 1) {
        this.allInverters = new SolaxCloudAPIPlatformInverter(log, config, api,
          this.config.tokenId, 'total', 'All inverters',
          this.inverters.map(inverter => + inverter.hasBattery()).reduce((a, b) => a + b, 0) > 0,
          this.smoothingWindow);
      }

      // start data fetching
      this.fetchDataPeriodically();

      this.log.debug('Finished initializing platform.');
    } catch (error) {
      this.log.error(`Unexpected error: ${error}`);
    }

    // When this event is fired it means Homebridge has created all accessories.
    this.api.on(APIEvent.DID_FINISH_LAUNCHING, () => {
      this.log.debug('Executed didFinishLaunching callback');
    });
  }

  /**
   * Check whether object implements interface InverterConfig.
   * @param obj Any object.
   * @returns Whether object implements interface InverterConfig.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static isInverterConfig(obj: any): obj is InverterConfig {
    return 'name' in obj && 'sn' in obj;
  }

  /**
   * Update data for virtual inverter totalizer based on individual inverter data.
   */
  private updateAllInvertersData() {
    this.allInverters.setRawPower(ACCESSORY_KEYS.pv,
      this.inverters.map(inverter => inverter.getRawPower(ACCESSORY_KEYS.pv)).reduce((a, b) => a + b, 0));
    this.allInverters.setRawPower(ACCESSORY_KEYS.inverterAC,
      this.inverters.map(inverter => inverter.getRawPower(ACCESSORY_KEYS.inverterAC)).reduce((a, b) => a + b, 0));
    this.allInverters.setRawEnergy(ACCESSORY_KEYS.inverterAC,
      this.inverters.map(inverter => inverter.getRawEnergy(ACCESSORY_KEYS.inverterAC)).reduce((a, b) => a + b, 0));
    this.allInverters.setRawPower(ACCESSORY_KEYS.inverterToGrid,
      this.inverters.map(inverter => inverter.getRawPower(ACCESSORY_KEYS.inverterToGrid)).reduce((a, b) => a + b, 0));
    this.allInverters.setRawPower(ACCESSORY_KEYS.inverterToHouse,
      this.inverters.map(inverter => inverter.getRawPower(ACCESSORY_KEYS.inverterToHouse)).reduce((a, b) => a + b, 0));
    this.allInverters.setRawPower(ACCESSORY_KEYS.gridToHouse,
      this.inverters.map(inverter => inverter.getRawPower(ACCESSORY_KEYS.gridToHouse)).reduce((a, b) => a + b, 0));

    if (this.allInverters.hasBattery()) {
      // get array of inverters with battery
      const invertersWithBattery = this.inverters.filter(inverter => inverter.hasBattery());

      // battery charge / discharge power
      this.allInverters.setRawPower(ACCESSORY_KEYS.inverterFromBattery,
        invertersWithBattery.map(inverter => inverter.getRawPower(ACCESSORY_KEYS.inverterFromBattery)).reduce((a, b) => a + b, 0));
      this.allInverters.setRawPower(ACCESSORY_KEYS.inverterToBattery,
        invertersWithBattery.map(inverter => inverter.getRawPower(ACCESSORY_KEYS.inverterToBattery)).reduce((a, b) => a + b, 0));

      // battery SoC
      this.allInverters.setBatteryChargeState(Math.max(...invertersWithBattery.map(inverter => inverter.getBatteryChargeState())));

      const levelSums = invertersWithBattery.map(inverter => inverter.getBatteryLevel()).reduce((a, b) => a + b, 0);
      this.allInverters.setBatteryLevel(levelSums / invertersWithBattery.length); // average levels
    }

    // notify update with motion
    this.allInverters.setMotionUpdate();
  }

  /**
   * Sleeps for a number of milliseconds.
   * @param millis {number} The number of milliseconds to sleep.
   */
  private async sleep(millis: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, millis));
  }

  /**
   * Periodically retrieves inverter data from Solax Cloud API using configured tokenID and SN.
   */
  private async fetchDataPeriodically(): Promise<void> {
    // loop forever
    for (;;) {
      // update data for all configured inverters
      this.inverters.forEach(inverter => inverter.updateInverterDataFromCloud());

      this.log.info(`Updated data from Solax Cloud API, sleeping for ${this.config.pollingFrequency} seconds.`);

      // update inverter totalizers if needed
      if (this.inverters.length > 1) {
        this.log.info ('Computing inverter totals...');

        this.updateAllInvertersData();
      }

      // sleep until next data poll
      await this.sleep(this.config.pollingFrequency * 1000);
    }
  }

  /**
   * Checks platform config validity and sets defaults whenever needed.
   * @returns {boolean} Whether the config is valid.
   */
  private checkConfig(config: PlatformConfig): boolean {
    let result = true;

    this.log.debug(`Config read: ${JSON.stringify(config)}`);

    // check for configuration conversion to new format if needed
    if (!config.inverters) {
      // check for "old" configuration settings
      if (config.name && config.sn) {
        this.log.info('Converting config file to new format (with multiple inverters support)...');

        // setup new configuration settings (supporting multiple inverters) with single entry
        config.inverters = [
          {
            name: config.name,
            sn: config.sn,
          },
        ];

        // delete old configuration settings
        delete config.name;
        delete config.sn;
      }
    }

    // check for mandatory parameters
    if (!config.tokenId) {
      this.log.error('Config check: Can\'t find mandatory parameter "tokenId" parameter in config file, aborting!');
      result = false;

      return result;
    }
    if (!config.inverters) {
      this.log.error('Config check: Can\'t find mandatory parameter "inverters" parameter in config file, aborting!');
      result = false;

      return result;
    }

    // check for inverters type
    if (Array.isArray(config.inverters)) {
      // loop over inverters and check config type
      config.inverters.forEach(inverter => {
        if (!SolaxCloudAPIPlatform.isInverterConfig(inverter)) {
          this.log.error('Config check: Invalid type for inverter under "inverters" in config file, aborting!');
          result = false;

          return result;
        }
      });
    } else {
      this.log.error('Config check: Incorrect type for mandatory parameter "inverters" in config file, aborting!');
      result = false;

      return result;
    }

    // check for duplicates
    if (Util.arrayHasDuplicates(config.inverters.map(inverter => inverter.name))) {
      this.log.error('Config check: Duplicate inverter names in config file, aborting!');
      result = false;

      return result;
    } else if (Util.arrayHasDuplicates(config.inverters.map(inverter => inverter.sn))) {
      this.log.error('Config check: Duplicate inverter SNs in config file, aborting!');
      result = false;

      return result;
    }

    // check for polling frequency
    if (config.pollingFrequency === undefined) {
      this.log.info(`Config check: No polling frequency provided, defaulting to ${DEFAULT_POLLING_FREQUENCY} seconds.`);
      config.pollingFrequency = DEFAULT_POLLING_FREQUENCY;
    } else {
      if (Number.isInteger(config.pollingFrequency) && config.pollingFrequency > 0) {
        // all good?
        if (config.pollingFrequency < MAX_POLLING_FREQUENCY) {
          this.log.info(
            `Config check: Polling frequency cannot be higher than ${MAX_POLLS_MIN} times/min and ${MAX_POLLS_DAY} ` +
            `times/day, defaulting to ${DEFAULT_POLLING_FREQUENCY} seconds.`);
          config.pollingFrequency = DEFAULT_POLLING_FREQUENCY;
        }
      } else {
        this.log.info('Config check: Invalid polling frequency (must be a positive integer number), defaulting to ' +
                      `${DEFAULT_POLLING_FREQUENCY} seconds.`);
        config.pollingFrequency = DEFAULT_POLLING_FREQUENCY;
      }
    }

    // check for smooth meters
    if (config.smoothMeters === undefined) {
      config.smoothMeters = true;
      this.log.info(`Config check: No config for smooth meters, defaulting to ${config.smoothMeters}.`);
    } else {
      if (typeof config.smoothMeters !== 'boolean') {
        config.smoothMeters = true;
        this.log.info(`Config check: Invalid setting for smooth meters, defaulting to ${config.smoothMeters}.`);
      }
    }

    // check for smoothing method
    if (config.smoothingMethod === undefined) {
      this.log.info(`Config check: No smoothing method provided, defaulting to "${DEFAULT_SMOOTHING_METHOD}".`);
      config.smoothingMethod = DEFAULT_SMOOTHING_METHOD;
    } else {
      if (!VALID_SMOOTHING_METHODS.includes(config.smoothingMethod)) {
        this.log.info(`Config check: Invalid smoothing method, defaulting to "${DEFAULT_SMOOTHING_METHOD}".`);
        config.smoothingMethod = DEFAULT_SMOOTHING_METHOD;
      }
    }

    // check for Home app accessories
    if (config.pureHomeApp === undefined) {
      config.pureHomeApp = false;
      this.log.info(`Config check: No config for using pure Home app accessories, defaulting to ${config.pureHomeApp}.`);
    } else {
      if (typeof config.pureHomeApp !== 'boolean') {
        config.pureHomeApp = false;
        this.log.info(`Config check: Invalid setting for using pure Home app accessories, defaulting to ${config.pureHomeApp}.`);
      }
    }

    this.log.info(`Config check: final config is ${JSON.stringify(config)}`);

    return result;
  }

  /*
   * This method is called once at startup.
   * The Platform should pass all accessories which need to be created to the callback in form of a AccessoryPlugin.
   * The Platform must respond in a timely manner as otherwise the startup of the bridge would be unnecessarily delayed.
   */
  accessories(callback: (foundAccessories: AccessoryPlugin[]) => void): void {
    const accessories: AccessoryPlugin[] = [];

    // loop over inverters and add accessories
    this.inverters.forEach(inverter => accessories.push(...inverter.getAccessories()));

    // add inverter totalizer accessories if needed
    if (this.inverters.length > 1) {
      accessories.push(...this.allInverters.getAccessories());
    }

    callback(accessories);
  }
}
