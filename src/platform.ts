import { AccessoryPlugin, API, StaticPlatformPlugin, Logging, PlatformConfig, APIEvent } from 'homebridge';

import { EveHomeKitTypes } from 'homebridge-lib';

import { SolaxOutletAccessory } from './outletAccessory';

import util from 'util';

import { SolaxCloudAPIResponse, SolaxCloudAPI } from './solaxcloudapi';
import { SolaxMotionAccessory } from './motionAccessory';

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class SolaxCloudAPIPlatform implements StaticPlatformPlugin {
  private readonly log: Logging;
  private readonly config: PlatformConfig;
  public readonly api: API;

  public eve: EveHomeKitTypes;

  private readonly solaxCloudAPI!: SolaxCloudAPI;
  public apiData!: SolaxCloudAPIResponse;

  // outlets
  private outletPV!: SolaxOutletAccessory;
  private outletInverterAC!: SolaxOutletAccessory;
  private outletInverterToGrid!: SolaxOutletAccessory;
  private outletInverterToHouse!: SolaxOutletAccessory;
  private outletGridToHouse!: SolaxOutletAccessory;

  // motion sensor
  private motionUpdate!: SolaxMotionAccessory;

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

    this.eve = new EveHomeKitTypes(api);

    this.log.debug(`Config: \n${JSON.stringify(config, null, '  ')}`);

    // setup outlet accessories
    this.outletPV = new SolaxOutletAccessory(this, this.log, `${this.config.name} PV`);
    this.outletInverterAC = new SolaxOutletAccessory(this, this.log, `${this.config.name} Inverter AC`);
    this.outletInverterToGrid = new SolaxOutletAccessory(this, this.log, `${this.config.name} Inverter to Grid`);
    this.outletInverterToHouse = new SolaxOutletAccessory(this, this.log, `${this.config.name} Inverter to House`);
    this.outletGridToHouse = new SolaxOutletAccessory(this, this.log, `${this.config.name} Grid to House`);

    // setup update motion sensor
    this.motionUpdate = new SolaxMotionAccessory(this, this.log, `${this.config.name} Update`);

    // init new Solax Cloud API object with give tokenID and sn
    this.solaxCloudAPI = new SolaxCloudAPI(this.config.tokenId, this.config.sn);

    this.getAPIData();

    this.log.debug('Finished initializing platform.'),

    // When this event is fired it means Homebridge has created all accessories.
    this.api.on(APIEvent.DID_FINISH_LAUNCHING, () => {
      this.log.debug('Executed didFinishLaunching callback');
    });
  }

  sleep = util.promisify(setTimeout);

  /**
   * Periodically retrieves inverter data from Solax Cloud API using configured tokenID and SN.
   */
  private async getDataPeriodically() {
    try {
      this.log.debug('Retrieving data from Solax Cloud API.');

      this.apiData = await this.solaxCloudAPI.getAPIData();

      if (this.apiData.success) {
        this.log.debug(`Retrieved inverter status: ${JSON.stringify(this.apiData.result)}`);

        // set outlet status
        this.outletPV.setPowerConsumption(SolaxCloudAPI.getPVPower(this.apiData.result));
        this.outletPV.setSerial(`pv-${this.apiData.result.inverterSN}`);
        this.outletPV.setModel(SolaxCloudAPI.getInverterType(this.apiData.result.inverterType));

        this.outletInverterAC.setPowerConsumption(SolaxCloudAPI.getInverterACPower(this.apiData.result));
        this.outletInverterAC.setSerial(`inv-ac-${this.apiData.result.inverterSN}`);
        this.outletInverterAC.setModel(SolaxCloudAPI.getInverterType(this.apiData.result.inverterType));

        this.outletInverterToGrid.setPowerConsumption(SolaxCloudAPI.getInverterPowerToGrid(this.apiData.result));
        this.outletInverterToGrid.setSerial(`inv-grid-${this.apiData.result.inverterSN}`);
        this.outletInverterToGrid.setModel(SolaxCloudAPI.getInverterType(this.apiData.result.inverterType));

        this.outletInverterToHouse.setPowerConsumption(SolaxCloudAPI.getInverterPowerToHouse(this.apiData.result));
        this.outletInverterToHouse.setSerial(`inv-house-${this.apiData.result.inverterSN}`);
        this.outletInverterToHouse.setModel(SolaxCloudAPI.getInverterType(this.apiData.result.inverterType));

        this.outletGridToHouse.setPowerConsumption(SolaxCloudAPI.getGridPowerToHouse(this.apiData.result));
        this.outletGridToHouse.setSerial(`grid-house-${this.apiData.result.inverterSN}`);
        this.outletGridToHouse.setModel(SolaxCloudAPI.getInverterType(this.apiData.result.inverterType));

        // update motion sensor
        this.motionUpdate.setState(true);
        this.motionUpdate.setSerial(`update-${this.apiData.result.inverterSN}`);
        this.motionUpdate.setModel(SolaxCloudAPI.getInverterType(this.apiData.result.inverterType));
      } else {
        throw new Error(this.apiData.exception);
      }
    } catch (error) {
      this.log.error(`Failed to read from Solax Cloud API. Error: ${error}`);
    } finally {
      this.log.debug(`Delaying for ${this.config.pollingFrequency} seconds.`);

      this.sleep(this.config.pollingFrequency * 1000).then(async () => await this.getDataPeriodically());
    }
  }

  /**
   * Gets the latest API data available.
   * @returns
   */
  public getAPIData(): SolaxCloudAPIResponse {
    if (this.apiData) {
      return this.apiData;
    } else {
      this.getDataPeriodically().then(() => {
        return this.getAPIData();
      });
    }

    return this.apiData;
  }

  /*
   * This method is called once at startup.
   * The Platform should pass all accessories which need to be created to the callback in form of a AccessoryPlugin.
   * The Platform must respond in a timely manner as otherwise the startup of the bridge would be unnecessarily delayed.
   */
  accessories(callback: (foundAccessories: AccessoryPlugin[]) => void): void {
    callback([ this.outletPV, this.outletInverterAC,
      this.outletInverterToGrid, this.outletInverterToHouse, this.outletGridToHouse,
      this.motionUpdate ]);
  }
}
