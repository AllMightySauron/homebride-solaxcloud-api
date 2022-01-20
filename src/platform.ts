import { AccessoryPlugin, API, StaticPlatformPlugin, Logging, PlatformConfig, APIEvent } from 'homebridge';

import { EveHomeKitTypes } from 'homebridge-lib';
import fakegato from 'fakegato-history';

import util from 'util';

import { SolaxCloudAPI, SolaxCloudAPIResponse } from './solaxcloudapi';
import { PlatformLightSensorMeters, PlatformOutletMeters } from './platformMeters';
import { SolaxOutletAccessory } from './outletAccessory';
import { SolaxMotionAccessory } from './motionAccessory';
import { SolaxLightSensorAccessory } from './lightSensorAccessory';

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
 * Accessory names.
 */
const ACCESSORY_NAMES = {
  pv: 'PV',
  inverterAC: 'AC',
  inverterToGrid: 'To Grid',
  inverterToHouse: 'To House',
  gridToHouse: 'From Grid',
};

/**
 * SolaxCloudAPIPlatform.
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class SolaxCloudAPIPlatform implements StaticPlatformPlugin {
  private readonly log: Logging;
  private readonly config: PlatformConfig;
  public readonly api: API;

  public readonly eve: EveHomeKitTypes;
  public eveService: fakegato;

  private readonly solaxCloudAPI!: SolaxCloudAPI;

  /**
   * Numeber of periods to use for data smoothing.
   */
  private smoothingWindow = 1;

  /**
   * Outlets with raw data gather.
   */
  private rawOutlets!: PlatformOutletMeters;

  /**
   * Smooth data outlets.
   * These outlets present smoothed values based on the raw data figures to
   * prevent events like the temporary passage of a cloud to directly affect values.
   */
  private smoothOutlets!: PlatformOutletMeters;

  /**
   * Virtual motion sensor triggered by data updates from Solax Cloud.
   */
  private motionUpdate!: SolaxMotionAccessory;

  /**
   * Ambient light sensors for Power Consumption (pure Home App config)
   */
  private rawLightSensors!: PlatformLightSensorMeters;

  /**
   * Ambient light sensors for smooth power consumption lights.
   * These lights present smoothed values based on the raw data figures to
   * prevent events like the temporary passage of a cloud to directly affect values.
   */
  private smoothLightSensors!: PlatformLightSensorMeters;

  /** Array with all accessories */
  private solaxAccessories: AccessoryPlugin[] = [];

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
      this.eve = new EveHomeKitTypes(this.api);
      this.eveService = fakegato(this.api);

      // init new Solax Cloud API object with give tokenID and sn
      this.solaxCloudAPI = new SolaxCloudAPI(this.config.tokenId, this.config.sn);

      // initial data set
      const apiData = this.solaxCloudAPI.getAPIData();

      this.log.debug(`apiData = ${JSON.stringify(apiData)}`);

      let inverterSN: string;
      let inverterModel: string;

      if (apiData.success) {
        inverterSN = apiData.result.inverterSN.toLowerCase();
        inverterModel = SolaxCloudAPI.getInverterType(apiData.result.inverterType);
      } else {
        this.log.info('Could not retrieve initial values from Solax Cloud, accessory Serial Number and Model properties deferred...');

        inverterSN = String(this.config.name);
        inverterModel = 'Unknown';
      }

      // setup raw outlet accessories
      this.rawOutlets = {
        pv: new SolaxOutletAccessory(this, this.log, `${this.config.name} ${ACCESSORY_NAMES.pv}`, `pv-${inverterSN}`, inverterModel),
        inverterAC:
          new SolaxOutletAccessory(this, this.log, `${this.config.name} ${ACCESSORY_NAMES.inverterAC}`,
            `inv-ac-${inverterSN}`, inverterModel),
        inverterToGrid:
          new SolaxOutletAccessory(this, this.log, `${this.config.name} ${ACCESSORY_NAMES.inverterToGrid}`,
            `inv-grid-${inverterSN}`, inverterModel),
        inverterToHouse:
          new SolaxOutletAccessory(this, this.log, `${this.config.name} ${ACCESSORY_NAMES.inverterToHouse}`,
            `inv-house-${inverterSN}`, inverterModel),
        gridToHouse:
          new SolaxOutletAccessory(this, this.log, `${this.config.name} ${ACCESSORY_NAMES.gridToHouse}`,
            `grid-house-${inverterSN}`, inverterModel),
      };

      // setup update motion sensor
      this.motionUpdate = new SolaxMotionAccessory(this, this.log, `${this.config.name} Update`, `update-${inverterSN}`, inverterModel);

      // create array with all base accessories
      this.solaxAccessories =
        [ this.rawOutlets.pv, this.rawOutlets.inverterAC, this.rawOutlets.inverterToGrid,
          this.rawOutlets.inverterToHouse, this.rawOutlets.gridToHouse, this.motionUpdate ];

      // check if "pure" Home App accessories are needed
      if (this.config.pureHomeApp) {
        // add raw light sensors
        this.rawLightSensors = {
          pv: new SolaxLightSensorAccessory(this, this.log, `${this.config.name} ${ACCESSORY_NAMES.pv} sensor`,
            `pv-light-${inverterSN}`, inverterModel),
          inverterAC:
            new SolaxLightSensorAccessory(this, this.log, `${this.config.name} ${ACCESSORY_NAMES.inverterAC} sensor`,
              `inv-ac-light-${inverterSN}`, inverterModel),
          inverterToGrid:
            new SolaxLightSensorAccessory(this, this.log,
              `${this.config.name} ${ACCESSORY_NAMES.inverterToGrid} sensor`, `inv-grid-light-${inverterSN}`, inverterModel),
          inverterToHouse:
            new SolaxLightSensorAccessory(this, this.log,
              `${this.config.name} ${ACCESSORY_NAMES.inverterToHouse} sensor`, `inv-house-light-${inverterSN}`, inverterModel),
          gridToHouse:
            new SolaxLightSensorAccessory(this, this.log,
              `${this.config.name} ${ACCESSORY_NAMES.gridToHouse} sensor`, `grid-house-light-${inverterSN}`, inverterModel),
        };

        this.solaxAccessories.push(this.rawLightSensors.pv, this.rawLightSensors.inverterAC, this.rawLightSensors.inverterToGrid,
          this.rawLightSensors.inverterToHouse, this.rawLightSensors.gridToHouse);

        if (this.config.smoothMeters) {
          // add smooth light sensors
          this.smoothLightSensors = {
            pv:
              new SolaxLightSensorAccessory(this, this.log, `${this.config.name} ${ACCESSORY_NAMES.pv} sensor (smooth)`,
                `pv-light-${inverterSN}`, inverterModel),
            inverterAC:
              new SolaxLightSensorAccessory(this, this.log, `${this.config.name} ${ACCESSORY_NAMES.inverterAC} sensor (smooth)`,
                `inv-ac-light-smooth-${inverterSN}`, inverterModel),
            inverterToGrid:
              new SolaxLightSensorAccessory(this, this.log, `${this.config.name} ${ACCESSORY_NAMES.inverterToGrid} sensor (smooth)`,
                `inv-grid-light-smooth-${inverterSN}`, inverterModel),
            inverterToHouse:
              new SolaxLightSensorAccessory(this, this.log, `${this.config.name} ${ACCESSORY_NAMES.inverterToHouse} sensor (smooth)`,
                `inv-house-light-smooth-${inverterSN}`, inverterModel),
            gridToHouse:
              new SolaxLightSensorAccessory(this, this.log, `${this.config.name} ${ACCESSORY_NAMES.gridToHouse} sensor (smooth)`,
                `grid-house-light-smooth-${inverterSN}`, inverterModel),
          };

          this.solaxAccessories.push(this.smoothLightSensors.pv, this.smoothLightSensors.inverterAC, this.smoothLightSensors.inverterToGrid,
            this.smoothLightSensors.inverterToHouse, this.smoothLightSensors.gridToHouse);
        }
      } else {
        if (this.config.smoothMeters) {
          // setup smooth outlet accessories
          this.smoothOutlets = {
            pv:
              new SolaxOutletAccessory(this, this.log, `${this.config.name} ${ACCESSORY_NAMES.pv} (smooth)`,
                `pv-smooth-${inverterSN}`, inverterModel),
            inverterAC:
              new SolaxOutletAccessory(this, this.log, `${this.config.name} ${ACCESSORY_NAMES.inverterAC} (smooth)`,
                `inv-ac-smooth-${inverterSN}`, inverterModel),
            inverterToGrid:
              new SolaxOutletAccessory(this, this.log, `${this.config.name} ${ACCESSORY_NAMES.inverterToGrid} (smooth)`,
                `inv-grid-smooth-${inverterSN}`, inverterModel),
            inverterToHouse:
              new SolaxOutletAccessory(this, this.log, `${this.config.name} ${ACCESSORY_NAMES.inverterToHouse} (smooth)`,
                `inv-house-smooth-${inverterSN}`, inverterModel),
            gridToHouse:
              new SolaxOutletAccessory(this, this.log, `${this.config.name} ${ACCESSORY_NAMES.gridToHouse} (smooth)`,
                `grid-house-smooth-${inverterSN}`, inverterModel),
          };

          this.solaxAccessories.push(this.smoothOutlets.pv, this.smoothOutlets.inverterAC, this.smoothOutlets.inverterToGrid,
            this.smoothOutlets.inverterToHouse, this.smoothOutlets.gridToHouse);
        }
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

  sleep = util.promisify(setTimeout);

  /**
   * Periodically retrieves inverter data from Solax Cloud API using configured tokenID and SN.
   */
  private async fetchDataPeriodically(): Promise<void> {
    try {
      this.log.debug('Retrieving data from Solax Cloud API.');

      const apiData = this.solaxCloudAPI.getAPIData();

      if (apiData.success) {
        this.log.debug(`Retrieved inverter status: ${JSON.stringify(apiData.result)}`);

        this.updateAccessories(apiData);
      } else {
        throw new Error(apiData.exception);
      }
    } catch (error) {
      this.log.error(`Failed to read from Solax Cloud API. Error: ${error}`);
    } finally {
      this.log.info(`Updated data from Solax Cloud API, sleeping for ${this.config.pollingFrequency} seconds.`);

      this.sleep(this.config.pollingFrequency * 1000)
        .then(async () => await this.fetchDataPeriodically());
    }
  }

  /**
   * Update all platform accessory status based on the values read from the API.
   * @param {SolaxCloudAPIResponse} apiData API data from Solax Cloud.
   */
  private updateAccessories(apiData: SolaxCloudAPIResponse) {
    // update raw outlets on/off, power & energy settings
    this.updateRawOutlets(apiData);

    if (this.config.pureHomeApp) {
      // update raw light sensors with power consumption
      this.updateRawLightSensors(apiData);

      if (this.config.smoothMeters) {
        // update smooth light sensors from raw outlets by applying smoothing function to power consumption
        this.updateSmoothLightSensors();
      }
    } else {
      if (this.config.smoothMeters) {
        // update smooth outlets data from raw outlets by applying smoothing function to power consumption
        this.updateSmoothOutlets();
      }
    }

    // update motion sensor
    this.motionUpdate.setState(true);
  }

  /**
   * Updates smooth ambient light sensors data from raw outlet data by applying configured smoothing function.
   */
  private updateSmoothLightSensors() {
    this.smoothLightSensors.pv.setAmbientLightLevel(
      this.rawOutlets.pv.getSmoothPowerConsumption(this.config.smoothingMethod, this.smoothingWindow),
    );
    this.smoothLightSensors.inverterAC.setAmbientLightLevel(
      this.rawOutlets.inverterAC.getSmoothPowerConsumption(this.config.smoothingMethod, this.smoothingWindow),
    );
    this.smoothLightSensors.inverterToGrid.setAmbientLightLevel(
      this.rawOutlets.inverterToGrid.getSmoothPowerConsumption(this.config.smoothingMethod, this.smoothingWindow),
    );
    this.smoothLightSensors.inverterToHouse.setAmbientLightLevel(
      this.rawOutlets.inverterToHouse.getSmoothPowerConsumption(this.config.smoothingMethod, this.smoothingWindow),
    );
    this.smoothLightSensors.gridToHouse.setAmbientLightLevel(
      this.rawOutlets.gridToHouse.getSmoothPowerConsumption(this.config.smoothingMethod, this.smoothingWindow),
    );
  }

  /**
   * Update raw ambient light sensors with power consumption data from Solax Cloud API.
   * @param {SolaxCloudAPIResponse} apiData API data retrieved from Solax Cloud.
   */
  private updateRawLightSensors(apiData: SolaxCloudAPIResponse) {
    this.rawLightSensors.pv.setAmbientLightLevel(SolaxCloudAPI.getPVPower(apiData.result));
    this.rawLightSensors.inverterAC.setAmbientLightLevel(SolaxCloudAPI.getInverterACPower(apiData.result));
    this.rawLightSensors.inverterToGrid.setAmbientLightLevel(SolaxCloudAPI.getInverterPowerToGrid(apiData.result));
    this.rawLightSensors.inverterToHouse.setAmbientLightLevel(SolaxCloudAPI.getInverterPowerToHouse(apiData.result));
    this.rawLightSensors.gridToHouse.setAmbientLightLevel(SolaxCloudAPI.getGridPowerToHouse(apiData.result));
  }

  /**
   * Updates smooth outlet data from raw outlet data by applying configured smoothing function.
   */
  private updateSmoothOutlets() {
    this.smoothOutlets.pv.setPowerConsumption(
      this.rawOutlets.pv.getSmoothPowerConsumption(this.config.smoothingMethod, this.smoothingWindow),
    );
    this.smoothOutlets.inverterAC.setPowerConsumption(
      this.rawOutlets.inverterAC.getSmoothPowerConsumption(this.config.smoothingMethod, this.smoothingWindow),
    );
    this.smoothOutlets.inverterToGrid.setPowerConsumption(
      this.rawOutlets.inverterToGrid.getSmoothPowerConsumption(this.config.smoothingMethod, this.smoothingWindow),
    );
    this.smoothOutlets.inverterToHouse.setPowerConsumption(
      this.rawOutlets.inverterToHouse.getSmoothPowerConsumption(this.config.smoothingMethod, this.smoothingWindow),
    );
    this.smoothOutlets.gridToHouse.setPowerConsumption(
      this.rawOutlets.gridToHouse.getSmoothPowerConsumption(this.config.smoothingMethod, this.smoothingWindow),
    );
  }

  /**
   * Update raw outlet data from API data read from Solax Cloud.
   * @param {SolaxCloudAPIResponse} apiData Solax Cloud API data.
   * */
  private updateRawOutlets(apiData: SolaxCloudAPIResponse) {
    this.rawOutlets.pv.setPowerConsumption(SolaxCloudAPI.getPVPower(apiData.result));
    this.rawOutlets.inverterAC.setPowerConsumption(SolaxCloudAPI.getInverterACPower(apiData.result));
    this.rawOutlets.inverterAC.setTotalEnergyConsumption(SolaxCloudAPI.getYieldTotal(apiData.result));
    this.rawOutlets.inverterToGrid.setPowerConsumption(SolaxCloudAPI.getInverterPowerToGrid(apiData.result));
    this.rawOutlets.inverterToHouse.setPowerConsumption(SolaxCloudAPI.getInverterPowerToHouse(apiData.result));
    this.rawOutlets.gridToHouse.setPowerConsumption(SolaxCloudAPI.getGridPowerToHouse(apiData.result));
  }

  /**
   * Checks platform config validity and sets defaults whenever needed.
   * @returns {boolean} Whether the config is valid.
   */
  private checkConfig(config: PlatformConfig): boolean {
    let result = true;

    this.log.debug(`Config read: ${JSON.stringify(config)}`);

    // check for mandatory parameters
    if (!config.name) {
      this.log.error('Config check: Can\'t find mandatory parameter "name" parameter in config file, aborting!');
      result = false;
    } else if (!config.tokenId) {
      this.log.error('Config check: Can\'t find mandatory parameter "tokenId" parameter in config file, aborting!');
      result = false;
    } else if (!config.sn) {
      this.log.error('Config check: Can\'t find mandatory parameter "sn" parameter in config file, aborting!');
      result = false;
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
    if (this.config.smoothMeters === undefined) {
      this.config.smoothMeters = true;
      this.log.info(`Config check: No config for smooth meters, defaulting to ${this.config.smoothMeters}.`);
    } else {
      if (typeof this.config.smoothMeters !== 'boolean') {
        this.config.smoothMeters = true;
        this.log.info(`Config check: Invalid setting for smooth meters, defaulting to ${this.config.smoothMeters}.`);
      }
    }

    // check for smoothing method
    if (this.config.smoothingMethod === undefined) {
      this.log.info(`Config check: No smoothing method provided, defaulting to "${DEFAULT_SMOOTHING_METHOD}".`);
      config.smoothingMethod = DEFAULT_SMOOTHING_METHOD;
    } else {
      if (!VALID_SMOOTHING_METHODS.find(this.config.smoothingMethod)) {
        this.log.info(`Config check: Invalid smoothing method, defaulting to "${DEFAULT_SMOOTHING_METHOD}".`);
        config.smoothingMethod = DEFAULT_SMOOTHING_METHOD;
      }
    }

    // check for Home app accessories
    if (this.config.pureHomeApp === undefined) {
      this.config.pureHomeApp = false;
      this.log.info(`Config check: No config for using pure Home app accessories, defaulting to ${this.config.pureHomeApp}.`);
    } else {
      if (typeof this.config.pureHomeApp !== 'boolean') {
        this.config.pureHomeApp = false;
        this.log
          .info(`Config check: Invalid setting for using pure Home app accessories, defaulting to ${this.config.pureHomeApp}.`);
      }
    }

    this.log.info(`Config check: final config is ${JSON.stringify(this.config)}`);

    return result;
  }

  /*
   * This method is called once at startup.
   * The Platform should pass all accessories which need to be created to the callback in form of a AccessoryPlugin.
   * The Platform must respond in a timely manner as otherwise the startup of the bridge would be unnecessarily delayed.
   */
  accessories(callback: (foundAccessories: AccessoryPlugin[]) => void): void {
    callback(this.solaxAccessories);
  }
}
