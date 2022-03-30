import { AccessoryPlugin, API, Logging, PlatformConfig } from 'homebridge';

import { SolaxCloudAPI, SolaxCloudAPIResponse } from './solaxcloudapi';

import { SolaxOutletAccessory } from './outletAccessory';
import { SolaxLightSensorAccessory } from './lightSensorAccessory';

import { PlatformLightSensorMeters, PlatformOutletMeters } from './platformMeters';

import { SolaxMotionAccessory } from './motionAccessory';

/**
 * Standard names for accessories.
 */
const ACCESSORY_NAMES = {
  pv: 'PV',
  inverterAC: 'AC',
  inverterToGrid: 'To Grid',
  inverterToHouse: 'To House',
  gridToHouse: 'From Grid',
};

/**
 * SolaxCloudAPIPlatformInverter.
 * This class is the main constructor for your inverter accessories
 * to be used by Homebridge.
 */
export class SolaxCloudAPIPlatformInverter {
  private readonly log: Logging;
  private readonly config: PlatformConfig;
  private readonly api: API;

  /**
   * Inverter name.
   */
  private name: string;

  /**
   * Inverter serial number.
   **/
  private sn: string;

  /**
   * Size of window for statistical smoothing operations.
   */
  private smoothingWindow: number;

  /**
   * API for retrieving data from Solax cloud.
   */
  private solaxCloudAPI: SolaxCloudAPI;

  /**
   * Outlets with raw data gathered from Solax Cloud.
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
    * Ambient light sensors for Power Consumption (pure Home App config).
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
    * Platform inverter constructor.
    * @param log
    * @param config
    * @param api
    * @param tokenId
    * @param inverterSN
    * @param smoothingWindow
    * @returns
    */
  constructor (log: Logging, config: PlatformConfig, api: API, tokenId: string, sn: string, name: string, smoothingWindow: number) {
    // store values in properties
    this.log = log;
    this.config = config;
    this.api = api;

    // setup inverter data
    this.sn = sn.toLowerCase();
    this.name = name;

    this.smoothingWindow = smoothingWindow;

    this.log.info(`Initialing acessories for inverter "${name}" (SN="${sn}")...`);

    // init new Solax Cloud API object with give tokenID and sn
    this.solaxCloudAPI = new SolaxCloudAPI(tokenId, sn);

    // initial data set
    const apiData = this.solaxCloudAPI.getAPIData();

    this.log.debug(`apiData = ${JSON.stringify(apiData)}`);

    let inverterModel: string;

    if (apiData.success) {
      inverterModel = SolaxCloudAPI.getInverterType(apiData.result.inverterType);
    } else {
      this.log.info('Could not retrieve initial values from Solax Cloud, accessory Serial Number and Model properties deferred...');
      inverterModel = 'Unknown';
    }

    // setup raw outlet accessories
    this.rawOutlets = {
      pv: new SolaxOutletAccessory(this.log, this.api, `${this.name} ${ACCESSORY_NAMES.pv}`, `pv-${this.sn}`, inverterModel),
      inverterAC:
          new SolaxOutletAccessory(this.log, this.api, `${this.name} ${ACCESSORY_NAMES.inverterAC}`,
            `inv-ac-${this.sn}`, inverterModel),
      inverterToGrid:
          new SolaxOutletAccessory(this.log, this.api, `${this.name} ${ACCESSORY_NAMES.inverterToGrid}`,
            `inv-grid-${this.sn}`, inverterModel),
      inverterToHouse:
          new SolaxOutletAccessory(this.log, this.api, `${this.name} ${ACCESSORY_NAMES.inverterToHouse}`,
            `inv-house-${this.sn}`, inverterModel),
      gridToHouse:
          new SolaxOutletAccessory(this.log, this.api, `${this.name} ${ACCESSORY_NAMES.gridToHouse}`,
            `grid-house-${this.sn}`, inverterModel),
    };

    // setup update motion sensor
    this.motionUpdate =
        new SolaxMotionAccessory(this.log, this.api, `${this.name} Update`, `update-${this.sn}`, inverterModel);

    // create array with all base accessories
    this.solaxAccessories =
        [ this.rawOutlets.pv, this.rawOutlets.inverterAC, this.rawOutlets.inverterToGrid,
          this.rawOutlets.inverterToHouse, this.rawOutlets.gridToHouse, this.motionUpdate ];

    // check if "pure" Home App accessories are needed
    if (this.config.pureHomeApp) {
      // add raw light sensors
      this.rawLightSensors = {
        pv: new SolaxLightSensorAccessory(this.log, this.api, `${this.name} ${ACCESSORY_NAMES.pv} sensor`,
          `pv-light-${this.sn}`, inverterModel),
        inverterAC:
            new SolaxLightSensorAccessory(this.log, this.api, `${this.name} ${ACCESSORY_NAMES.inverterAC} sensor`,
              `inv-ac-light-${this.sn}`, inverterModel),
        inverterToGrid:
            new SolaxLightSensorAccessory(this.log, this.api,
              `${this.name} ${ACCESSORY_NAMES.inverterToGrid} sensor`, `inv-grid-light-${this.sn}`, inverterModel),
        inverterToHouse:
            new SolaxLightSensorAccessory(this.log, this.api,
              `${this.name} ${ACCESSORY_NAMES.inverterToHouse} sensor`, `inv-house-light-${this.sn}`, inverterModel),
        gridToHouse:
            new SolaxLightSensorAccessory(this.log, this.api,
              `${this.name} ${ACCESSORY_NAMES.gridToHouse} sensor`, `grid-house-light-${this.sn}`, inverterModel),
      };

      this.solaxAccessories.push(this.rawLightSensors.pv, this.rawLightSensors.inverterAC, this.rawLightSensors.inverterToGrid,
        this.rawLightSensors.inverterToHouse, this.rawLightSensors.gridToHouse);

      if (this.config.smoothMeters) {
        // add smooth light sensors
        this.smoothLightSensors = {
          pv:
              new SolaxLightSensorAccessory(this.log, this.api, `${this.name} ${ACCESSORY_NAMES.pv} sensor (smooth)`,
                `pv-light-${this.sn}`, inverterModel),
          inverterAC:
              new SolaxLightSensorAccessory(this.log, this.api, `${this.name} ${ACCESSORY_NAMES.inverterAC} sensor (smooth)`,
                `inv-ac-light-smooth-${this.sn}`, inverterModel),
          inverterToGrid:
              new SolaxLightSensorAccessory(this.log, this.api, `${this.name} ${ACCESSORY_NAMES.inverterToGrid} sensor (smooth)`,
                `inv-grid-light-smooth-${this.sn}`, inverterModel),
          inverterToHouse:
              new SolaxLightSensorAccessory(this.log, this.api, `${this.name} ${ACCESSORY_NAMES.inverterToHouse} sensor (smooth)`,
                `inv-house-light-smooth-${this.sn}`, inverterModel),
          gridToHouse:
              new SolaxLightSensorAccessory(this.log, this.api, `${this.name} ${ACCESSORY_NAMES.gridToHouse} sensor (smooth)`,
                `grid-house-light-smooth-${this.sn}`, inverterModel),
        };

        this.solaxAccessories.push(this.smoothLightSensors.pv, this.smoothLightSensors.inverterAC, this.smoothLightSensors.inverterToGrid,
          this.smoothLightSensors.inverterToHouse, this.smoothLightSensors.gridToHouse);
      }
    } else {
      if (this.config.smoothMeters) {
        // setup smooth outlet accessories
        this.smoothOutlets = {
          pv:
              new SolaxOutletAccessory(this.log, this.api, `${this.name} ${ACCESSORY_NAMES.pv} (smooth)`,
                `pv-smooth-${this.sn}`, inverterModel),
          inverterAC:
              new SolaxOutletAccessory(this.log, this.api, `${this.name} ${ACCESSORY_NAMES.inverterAC} (smooth)`,
                `inv-ac-smooth-${this.sn}`, inverterModel),
          inverterToGrid:
              new SolaxOutletAccessory(this.log, this.api, `${this.name} ${ACCESSORY_NAMES.inverterToGrid} (smooth)`,
                `inv-grid-smooth-${this.sn}`, inverterModel),
          inverterToHouse:
              new SolaxOutletAccessory(this.log, this.api, `${this.name} ${ACCESSORY_NAMES.inverterToHouse} (smooth)`,
                `inv-house-smooth-${this.sn}`, inverterModel),
          gridToHouse:
              new SolaxOutletAccessory(this.log, this.api, `${this.name} ${ACCESSORY_NAMES.gridToHouse} (smooth)`,
                `grid-house-smooth-${this.sn}`, inverterModel),
        };

        this.solaxAccessories.push(this.smoothOutlets.pv, this.smoothOutlets.inverterAC, this.smoothOutlets.inverterToGrid,
          this.smoothOutlets.inverterToHouse, this.smoothOutlets.gridToHouse);
      }
    }

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
    */
  private updateRawOutlets(apiData: SolaxCloudAPIResponse) {
    this.rawOutlets.pv.setPowerConsumption(SolaxCloudAPI.getPVPower(apiData.result));
    this.rawOutlets.inverterAC.setPowerConsumption(SolaxCloudAPI.getInverterACPower(apiData.result));
    this.rawOutlets.inverterAC.setTotalEnergyConsumption(SolaxCloudAPI.getYieldTotal(apiData.result));
    this.rawOutlets.inverterToGrid.setPowerConsumption(SolaxCloudAPI.getInverterPowerToGrid(apiData.result));
    this.rawOutlets.inverterToHouse.setPowerConsumption(SolaxCloudAPI.getInverterPowerToHouse(apiData.result));
    this.rawOutlets.gridToHouse.setPowerConsumption(SolaxCloudAPI.getGridPowerToHouse(apiData.result));
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
   * Update data from this inverter by using the Solax Cloud API
   */
  public updateInverterData() {
    try {
      this.log.info(`Retrieving data from Solax Cloud API for inverter "${this.name}" (SN="${this.sn}")`);

      const apiData = this.solaxCloudAPI.getAPIData();

      if (apiData.success) {
        this.log.debug(`Retrieved inverter status: ${JSON.stringify(apiData.result)}`);

        this.updateAccessories(apiData);
      } else {
        throw new Error(apiData.exception);
      }
    } catch (error) {
      this.log.error(`Failed to read from Solax Cloud API for inverter "${this.name}" (SN="${this.sn})". Error: ${error}`);
    }
  }

  /**
   * Get array with full list of accessories for this inverter.
   * @returns {AccessoryPlugin[]} Array of accessories for this inverter.
   */
  public getAccessories(): AccessoryPlugin[] {
    return this.solaxAccessories;
  }

}