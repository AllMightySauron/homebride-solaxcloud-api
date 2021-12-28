import { AccessoryPlugin, API, StaticPlatformPlugin, Logging, PlatformConfig, APIEvent } from 'homebridge';

import { EveHomeKitTypes } from 'homebridge-lib';
import fakegato from 'fakegato-history';

import { SolaxOutletAccessory } from './outletAccessory';

import util from 'util';

import { SolaxCloudAPIResponse, SolaxCloudAPI } from './solaxcloudapi';
import { SolaxMotionAccessory } from './motionAccessory';

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
  private apiData!: SolaxCloudAPIResponse;

  /**
   * Virtual outlet used to detect and measure photovoltaic production.
  */
  private outletPV!: SolaxOutletAccessory;

  /**
   * Virtual outlet used to detect and measure inverter AC production.
   */
  private outletInverterAC!: SolaxOutletAccessory;

  /**
   * Virtual outlet used to detect and measure inverter excess production injected in the grid.
   */
  private outletInverterToGrid!: SolaxOutletAccessory;

  /**
   * Virtual outlet used to detect and measure inverter production directly fed into the house (self-consumption).
   */
  private outletInverterToHouse!: SolaxOutletAccessory;

  /**
   * Virtual outlet used to detect and measure grid power fed into the house.
   */
  private outletGridToHouse!: SolaxOutletAccessory;

  /**
   * Virtual motion sensor triggered by data updates from Solax Cloud.
   */
  private motionUpdate!: SolaxMotionAccessory;

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

    this.log.debug(`Config: ${JSON.stringify(config)}`);

    // check for mandatory parameters
    if (!this.config.name) {
      this.log.error('Can\'t find mandatory parameter "name" parameter in config file, aborting!');
      return;
    }
    if (!this.config.tokenId) {
      this.log.error('Can\'t find mandatory parameter "tokenId" parameter in config file, aborting!');
      return;
    }
    if (!this.config.sn) {
      this.log.error('Can\'t find mandatory parameter "sn" parameter in config file, aborting!');
      return;
    }

    // setup default polling frequency
    if (this.config.pollingFrequency) {
      if (Number.isInteger(this.config.pollingFrequency) && this.config.pollingFrequency > 0) {
        // all good?
        if (this.config.pollingFrequency < MAX_POLLING_FREQUENCY) {
          this.log.info(
            `Polling frequency cannot be higher than ${MAX_POLLS_MIN} times/min and ${MAX_POLLS_DAY} ` +
            `times/day, defaulting to ${DEFAULT_POLLING_FREQUENCY} seconds.`);
          this.config.pollingFrequency = DEFAULT_POLLING_FREQUENCY;
        }
      } else {
        log.info(`Invalid polling frequency (must be a positive integer number), defaulting to ${DEFAULT_POLLING_FREQUENCY} seconds.`);
        this.config.pollingFrequency = DEFAULT_POLLING_FREQUENCY;
      }
    } else {
      log.info(`No polling frequency provided, defaulting to ${DEFAULT_POLLING_FREQUENCY} seconds.`);
      this.config.pollingFrequency = DEFAULT_POLLING_FREQUENCY;
    }

    try {
      this.eve = new EveHomeKitTypes(this.api);
      this.eveService = fakegato(this.api);

      // init new Solax Cloud API object with give tokenID and sn
      this.solaxCloudAPI = new SolaxCloudAPI(this.config.tokenId, this.config.sn);

      // initial data set
      this.apiData = this.solaxCloudAPI.getAPIData();

      this.log.debug(`apiData = ${JSON.stringify(this.apiData)}`);

      let inverterSN: string;
      let inverterModel: string;

      if (this.apiData.success) {
        inverterSN = this.apiData.result.inverterSN.toLowerCase();
        inverterModel = SolaxCloudAPI.getInverterType(this.apiData.result.inverterType);
      } else {
        this.log.info('Could not retrieve initial values from Solax Cloud, accessory Serial Number and Model properties deferred...');

        inverterSN = this.config.name;
        inverterModel = 'Unknown';
      }

      // setup outlet accessories
      this.outletPV =
          new SolaxOutletAccessory(this, this.log, `${this.config.name} PV`, `pv-${inverterSN}`, inverterModel);
      this.outletInverterAC =
          new SolaxOutletAccessory(this, this.log, `${this.config.name} Inverter AC`, `inv-ac-${inverterSN}`, inverterModel);
      this.outletInverterToGrid =
          new SolaxOutletAccessory(this, this.log, `${this.config.name} Inverter to Grid`, `inv-grid-${inverterSN}`, inverterModel);
      this.outletInverterToHouse =
          new SolaxOutletAccessory(this, this.log, `${this.config.name} Inverter to House`, `inv-house-${inverterSN}`, inverterModel);
      this.outletGridToHouse =
          new SolaxOutletAccessory(this, this.log, `${this.config.name} Grid to House`, `grid-house-${inverterSN}`, inverterModel);

      // setup update motion sensor
      this.motionUpdate =
          new SolaxMotionAccessory(this, this.log, `${this.config.name} Update`, `update-${inverterSN}`, inverterModel);

      // create array with all accessories
      this.solaxAccessories =
        [ this.outletPV, this.outletInverterAC, this.outletInverterToGrid,
          this.outletInverterToHouse, this.outletGridToHouse, this.motionUpdate ];

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

      this.apiData = this.solaxCloudAPI.getAPIData();

      if (this.apiData.success) {
        this.log.debug(`Retrieved inverter status: ${JSON.stringify(this.apiData.result)}`);

        // update outlets
        this.outletPV.setPowerConsumption(SolaxCloudAPI.getPVPower(this.apiData.result));

        this.outletInverterAC.setPowerConsumption(SolaxCloudAPI.getInverterACPower(this.apiData.result));
        this.outletInverterAC.setTotalEnergyConsumption(SolaxCloudAPI.getYieldTotal(this.apiData.result));

        this.outletInverterToGrid.setPowerConsumption(SolaxCloudAPI.getInverterPowerToGrid(this.apiData.result));

        this.outletInverterToHouse.setPowerConsumption(SolaxCloudAPI.getInverterPowerToHouse(this.apiData.result));

        this.outletGridToHouse.setPowerConsumption(SolaxCloudAPI.getGridPowerToHouse(this.apiData.result));

        // update motion sensor
        this.motionUpdate.setState(true);
      } else {
        throw new Error(this.apiData.exception);
      }
    } catch (error) {
      this.log.error(`Failed to read from Solax Cloud API. Error: ${error}`);
    } finally {
      this.log.info(`Updated data from Solax Cloud API, sleeping for ${this.config.pollingFrequency} seconds.`);

      this.sleep(this.config.pollingFrequency * 1000)
        .then(async () => await this.fetchDataPeriodically());
    }
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
