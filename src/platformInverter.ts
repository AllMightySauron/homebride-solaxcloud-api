import { AccessoryPlugin, API, Logging, PlatformConfig } from 'homebridge';

import { SolaxCloudAPI, SolaxCloudAPIResponse } from './solaxcloudapi';

import { SolaxOutletAccessory } from './outletAccessory';
import { SolaxLightSensorAccessory } from './lightSensorAccessory';

import { PlatformLightSensorMeters, PlatformOutletMeters } from './platformMeters';

import { SolaxMotionAccessory } from './motionAccessory';
import { BATTERY_CHARGING_STATE, SolaxBatteryAccessory } from './batteryAccessory';

/**
 * Standard names for accessories.
 */
export const ACCESSORY_KEYS = {
  pv: 'pv',
  inverterToBattery: 'inverterToBattery',
  inverterFromBattery: 'inverterFromBattery',
  inverterAC: 'inverterAC',
  inverterToGrid: 'inverterToGrid',
  inverterToHouse: 'inverterToHouse',
  gridToHouse: 'gridToHouse',
};

/**
 * Standard names for accessories.
 */
const ACCESSORY_NAMES = {
  pv: 'PV',
  inverterToBattery: 'To Battery',
  inverterFromBattery: 'From Battery',
  inverterAC: 'AC',
  inverterToGrid: 'To Grid',
  inverterToHouse: 'To House',
  gridToHouse: 'From Grid',
};

/**
 * Standar prefixes for accessory serials.
 */
const ACCESSORY_SERIAL_PREFIXES = {
  pv: 'pv',
  inverterToBattery: 'inv-tobat',
  inverterFromBattery: 'inv-frombat',
  inverterAC: 'inv-ac',
  inverterToGrid: 'inv-grid',
  inverterToHouse: 'inv-house',
  gridToHouse: 'grid-house',
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
   * Whether this inverter has a battery.
   **/
  private batteryInstalled: boolean;

  /**
   * Size of window for statistical smoothing operations.
   */
  private smoothingWindow: number;

  /**
   * API for retrieving data from Solax cloud.
   */
  private solaxCloudAPI: SolaxCloudAPI;

  /**
   * Virtual motion sensor triggered by data updates from Solax Cloud.
   */
  private motionUpdate!: SolaxMotionAccessory;

  /**
   * Battery information for this inverter gathered from Solax Cloud.
   */
  private battery!: SolaxBatteryAccessory;

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
  constructor (log: Logging, config: PlatformConfig, api: API,
    tokenId: string, sn: string, name: string, hasBattery: boolean,
    smoothingWindow: number) {
    // store values in properties
    this.log = log;
    this.config = config;
    this.api = api;

    // setup inverter data
    this.sn = sn.toLowerCase();
    this.name = name;

    this.smoothingWindow = smoothingWindow;
    this.batteryInstalled = hasBattery;

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
      pv:
        new SolaxOutletAccessory(this.log, this.api, `${this.name} ${ACCESSORY_NAMES.pv}`,
          `${ACCESSORY_SERIAL_PREFIXES.pv}-${this.sn}`, inverterModel),
      inverterFromBattery:
        new SolaxOutletAccessory(this.log, this.api, `${this.name} ${ACCESSORY_NAMES.inverterFromBattery}`,
          `${ACCESSORY_SERIAL_PREFIXES.inverterFromBattery}-${this.sn}`, inverterModel),
      inverterToBattery:
        new SolaxOutletAccessory(this.log, this.api, `${this.name} ${ACCESSORY_NAMES.inverterToBattery}`,
          `${ACCESSORY_SERIAL_PREFIXES.inverterToBattery}-${this.sn}`, inverterModel),
      inverterAC:
        new SolaxOutletAccessory(this.log, this.api, `${this.name} ${ACCESSORY_NAMES.inverterAC}`,
          `${ACCESSORY_SERIAL_PREFIXES.inverterAC}-${this.sn}`, inverterModel),
      inverterToGrid:
        new SolaxOutletAccessory(this.log, this.api, `${this.name} ${ACCESSORY_NAMES.inverterToGrid}`,
          `${ACCESSORY_SERIAL_PREFIXES.inverterToGrid}-${this.sn}`, inverterModel),
      inverterToHouse:
        new SolaxOutletAccessory(this.log, this.api, `${this.name} ${ACCESSORY_NAMES.inverterToHouse}`,
          `${ACCESSORY_SERIAL_PREFIXES.inverterToHouse}-${this.sn}`, inverterModel),
      gridToHouse:
        new SolaxOutletAccessory(this.log, this.api, `${this.name} ${ACCESSORY_NAMES.gridToHouse}`,
          `${ACCESSORY_SERIAL_PREFIXES.gridToHouse}-${this.sn}`, inverterModel),
    };

    // setup update motion sensor
    this.motionUpdate =
        new SolaxMotionAccessory(this.log, this.api, `${this.name} Update`, `update-${this.sn}`, inverterModel);

    // create array with all valid base accessories
    this.solaxAccessories =
        [ this.rawOutlets.pv, this.rawOutlets.inverterAC, this.rawOutlets.inverterToGrid,
          this.rawOutlets.inverterToHouse, this.rawOutlets.gridToHouse, this.motionUpdate ];

    if (this.hasBattery()) {
      this.battery = new SolaxBatteryAccessory(this.log, this.api, `${this.name} Battery`, `bat-${this.sn}`, inverterModel);

      this.solaxAccessories.push(this.battery, this.rawOutlets.inverterFromBattery, this.rawOutlets.inverterToBattery);
    }

    // check if "pure" Home App accessories are needed
    if (this.config.pureHomeApp) {
      // add raw light sensors
      this.rawLightSensors = {
        pv: new SolaxLightSensorAccessory(this.log, this.api, `${this.name} ${ACCESSORY_NAMES.pv} sensor`,
          `${ACCESSORY_SERIAL_PREFIXES.pv}-light-${this.sn}`, inverterModel),
        inverterFromBattery:
          new SolaxLightSensorAccessory(this.log, this.api, `${this.name} ${ACCESSORY_NAMES.inverterFromBattery} sensor`,
            `${ACCESSORY_SERIAL_PREFIXES.inverterFromBattery}-light-${this.sn}`, inverterModel),
        inverterToBattery:
          new SolaxLightSensorAccessory(this.log, this.api, `${this.name} ${ACCESSORY_NAMES.inverterToBattery} sensor`,
            `${ACCESSORY_SERIAL_PREFIXES.inverterToBattery}-light-${this.sn}`, inverterModel),
        inverterAC:
          new SolaxLightSensorAccessory(this.log, this.api, `${this.name} ${ACCESSORY_NAMES.inverterAC} sensor`,
            `${ACCESSORY_SERIAL_PREFIXES.inverterAC}-light-${this.sn}`, inverterModel),
        inverterToGrid:
          new SolaxLightSensorAccessory(this.log, this.api, `${this.name} ${ACCESSORY_NAMES.inverterToGrid} sensor`,
            `${ACCESSORY_SERIAL_PREFIXES.inverterToGrid}-light-${this.sn}`, inverterModel),
        inverterToHouse:
          new SolaxLightSensorAccessory(this.log, this.api, `${this.name} ${ACCESSORY_NAMES.inverterToHouse} sensor`,
            `${ACCESSORY_SERIAL_PREFIXES.inverterToHouse}-light-${this.sn}`, inverterModel),
        gridToHouse:
          new SolaxLightSensorAccessory(this.log, this.api, `${this.name} ${ACCESSORY_NAMES.gridToHouse} sensor`,
            `${ACCESSORY_SERIAL_PREFIXES.gridToHouse}-light-${this.sn}`, inverterModel),
      };

      this.solaxAccessories.push(this.rawLightSensors.pv, this.rawLightSensors.inverterAC, this.rawLightSensors.inverterToGrid,
        this.rawLightSensors.inverterToHouse, this.rawLightSensors.gridToHouse);

      if (this.batteryInstalled) {
        this.solaxAccessories.push(this.rawLightSensors.inverterFromBattery, this.rawLightSensors.inverterToBattery);
      }

      if (this.config.smoothMeters) {
        // add smooth light sensors
        this.smoothLightSensors = {
          pv:
            new SolaxLightSensorAccessory(this.log, this.api, `${this.name} ${ACCESSORY_NAMES.pv} sensor (smooth)`,
              `${ACCESSORY_SERIAL_PREFIXES.pv}-light-smooth-${this.sn}`, inverterModel),
          inverterFromBattery:
            new SolaxLightSensorAccessory(this.log, this.api, `${this.name} ${ACCESSORY_NAMES.inverterFromBattery} sensor (smooth)`,
              `${ACCESSORY_SERIAL_PREFIXES.inverterFromBattery}-light-smooth-${this.sn}`, inverterModel),
          inverterToBattery:
            new SolaxLightSensorAccessory(this.log, this.api, `${this.name} ${ACCESSORY_NAMES.inverterToBattery} sensor (smooth)`,
              `${ACCESSORY_SERIAL_PREFIXES.inverterToBattery}-light-smooth-${this.sn}`, inverterModel),
          inverterAC:
            new SolaxLightSensorAccessory(this.log, this.api, `${this.name} ${ACCESSORY_NAMES.inverterAC} sensor (smooth)`,
              `${ACCESSORY_SERIAL_PREFIXES.inverterAC}-light-smooth-${this.sn}`, inverterModel),
          inverterToGrid:
            new SolaxLightSensorAccessory(this.log, this.api, `${this.name} ${ACCESSORY_NAMES.inverterToGrid} sensor (smooth)`,
              `${ACCESSORY_SERIAL_PREFIXES.inverterToGrid}-light-smooth-${this.sn}`, inverterModel),
          inverterToHouse:
            new SolaxLightSensorAccessory(this.log, this.api, `${this.name} ${ACCESSORY_NAMES.inverterToHouse} sensor (smooth)`,
              `${ACCESSORY_SERIAL_PREFIXES.inverterToHouse}-light-smooth-${this.sn}`, inverterModel),
          gridToHouse:
            new SolaxLightSensorAccessory(this.log, this.api, `${this.name} ${ACCESSORY_NAMES.gridToHouse} sensor (smooth)`,
              `${ACCESSORY_SERIAL_PREFIXES.gridToHouse}-light-smooth-${this.sn}`, inverterModel),
        };

        this.solaxAccessories.push(this.smoothLightSensors.pv, this.smoothLightSensors.inverterAC, this.smoothLightSensors.inverterToGrid,
          this.smoothLightSensors.inverterToHouse, this.smoothLightSensors.gridToHouse);

        if (this.batteryInstalled) {
          this.solaxAccessories.push(this.smoothLightSensors.inverterFromBattery, this.smoothLightSensors.inverterToBattery);
        }
      }
    } else {
      if (this.config.smoothMeters) {
        // setup smooth outlet accessories
        this.smoothOutlets = {
          pv:
            new SolaxOutletAccessory(this.log, this.api, `${this.name} ${ACCESSORY_NAMES.pv} (smooth)`,
              `${ACCESSORY_SERIAL_PREFIXES.pv}-smooth-${this.sn}`, inverterModel),
          inverterFromBattery:
            new SolaxOutletAccessory(this.log, this.api, `${this.name} ${ACCESSORY_NAMES.inverterFromBattery} (smooth)`,
              `${ACCESSORY_SERIAL_PREFIXES.inverterFromBattery}-smooth-${this.sn}`, inverterModel),
          inverterToBattery:
            new SolaxOutletAccessory(this.log, this.api, `${this.name} ${ACCESSORY_NAMES.inverterToBattery} (smooth)`,
              `${ACCESSORY_SERIAL_PREFIXES.inverterToBattery}-smooth-${this.sn}`, inverterModel),
          inverterAC:
            new SolaxOutletAccessory(this.log, this.api, `${this.name} ${ACCESSORY_NAMES.inverterAC} (smooth)`,
              `${ACCESSORY_SERIAL_PREFIXES.inverterAC}-smooth-${this.sn}`, inverterModel),
          inverterToGrid:
              new SolaxOutletAccessory(this.log, this.api, `${this.name} ${ACCESSORY_NAMES.inverterToGrid} (smooth)`,
                `${ACCESSORY_SERIAL_PREFIXES.inverterToGrid}-smooth-${this.sn}`, inverterModel),
          inverterToHouse:
              new SolaxOutletAccessory(this.log, this.api, `${this.name} ${ACCESSORY_NAMES.inverterToHouse} (smooth)`,
                `${ACCESSORY_SERIAL_PREFIXES.inverterToHouse}-smooth-${this.sn}`, inverterModel),
          gridToHouse:
              new SolaxOutletAccessory(this.log, this.api, `${this.name} ${ACCESSORY_NAMES.gridToHouse} (smooth)`,
                `${ACCESSORY_SERIAL_PREFIXES.gridToHouse}-smooth-${this.sn}`, inverterModel),
        };

        this.solaxAccessories.push(this.smoothOutlets.pv, this.smoothOutlets.inverterAC, this.smoothOutlets.inverterToGrid,
          this.smoothOutlets.inverterToHouse, this.smoothOutlets.gridToHouse);

        if (this.batteryInstalled) {
          this.solaxAccessories.push(this.smoothOutlets.inverterFromBattery, this.smoothOutlets.inverterToBattery);
        }
      }
    }

  }

  /**
    * Update all platform accessory status based on the values read from the API.
    * @param {SolaxCloudAPIResponse} apiData API data from Solax Cloud.
    */
  private updateAccessories(apiData: SolaxCloudAPIResponse) {
    // update raw sensors
    this.setRawPower(ACCESSORY_KEYS.pv, SolaxCloudAPI.getPVPower(apiData.result));
    this.setRawPower(ACCESSORY_KEYS.inverterFromBattery, SolaxCloudAPI.getInverterPowerFromBattery(apiData.result));
    this.setRawPower(ACCESSORY_KEYS.inverterToBattery, SolaxCloudAPI.getInverterPowerToBattery(apiData.result));
    this.setRawPower(ACCESSORY_KEYS.inverterAC, SolaxCloudAPI.getInverterACPower(apiData.result));
    this.setRawEnergy(ACCESSORY_KEYS.inverterAC, SolaxCloudAPI.getYieldTotal(apiData.result));
    this.setRawPower(ACCESSORY_KEYS.inverterToGrid, SolaxCloudAPI.getInverterPowerToGrid(apiData.result));
    this.setRawPower(ACCESSORY_KEYS.inverterToHouse, SolaxCloudAPI.getInverterPowerToHouse(apiData.result));
    this.setRawPower(ACCESSORY_KEYS.gridToHouse, SolaxCloudAPI.getGridPowerToHouse(apiData.result));

    if (this.config.smoothMeters) {
      // update smooth light sensors from raw outlets by applying smoothing function to power consumption
      this.setSmoothPower(ACCESSORY_KEYS.pv);
      this.setSmoothPower(ACCESSORY_KEYS.inverterFromBattery);
      this.setSmoothPower(ACCESSORY_KEYS.inverterToBattery);
      this.setSmoothPower(ACCESSORY_KEYS.inverterAC);
      this.setSmoothPower(ACCESSORY_KEYS.inverterToGrid);
      this.setSmoothPower(ACCESSORY_KEYS.inverterToHouse);
      this.setSmoothPower(ACCESSORY_KEYS.gridToHouse);
    }

    // check for battery
    if (this.hasBattery()) {
      this.setBatteryLevel(SolaxCloudAPI.getBatterySoC(apiData.result));

      if (this.getRawPower(ACCESSORY_KEYS.inverterToBattery) > 0) {
        this.setBatteryChargeState(BATTERY_CHARGING_STATE.CHARGING);
      } else if (this.getRawPower(ACCESSORY_KEYS.inverterFromBattery) > 0) {
        this.setBatteryChargeState(BATTERY_CHARGING_STATE.NOT_CHARGING);
      } else {
        this.setBatteryChargeState(BATTERY_CHARGING_STATE.NOT_CHARGEABLE);
      }
    }

    // notify update with motion sensor
    this.setMotionUpdate();
  }

  /**
   * Sets the battery charge state for this inverter.
   * @param {number} state The desired battery charge state.
   */
  public setBatteryChargeState(state: number) {
    this.battery.setChargeState(state);
  }

  /**
   * Gets the battery charge state for this inverter.
   * @returns {number} Battery charge state.
   */
  public getBatteryChargeState(): number {
    return this.battery.getChargeStateValue();
  }

  /**
   * Sets the current battery level for this inverter.
   * @param {number} percentage Battery level to set (percentage).
   */
  public setBatteryLevel(percentage: number) {
    this.battery.setLevel(percentage);
  }

  /**
   * Gets the current battery level for this inverter.
   * @returns {number} The current battery level (percentage).
   */
  public getBatteryLevel(): number {
    return this.battery.getLevelValue();
  }

  /**
   * Sets virtual update motion detector to true to notify of new data update.
   */
  public setMotionUpdate() {
    this.motionUpdate.setState(true);
  }

  /**
   * Gets raw accessory power for this inverter.
   * @param {string} key Accessory key.
   * @returns {number} Power consumptions for this accessory.
   */
  public getRawPower(key: string): number {
    return this.rawOutlets[key].getPowerConsumptionValue();
  }

  /**
   * Sets raw accessory power for this inverter.
   * @param {string} key Accessory key.
   * @param {number} power Power to set (in Watt).
   */
  public setRawPower(key: string, power: number) {
    this.rawOutlets[key].setPowerConsumption(power);

    if (this.config.pureHomeApp) {
      this.rawLightSensors[key].setAmbientLightLevel(power);
    }
  }

  /**
   * Gets raw accessory energy for this inverter.
   * @param {string} key Accessory key.
   * @returns {number} The energy consumption for the desired acessory (in Wh).
   */
  public getRawEnergy(key: string): number {
    return this.rawOutlets[key].getTotalEnergyConsumptionValue();
  }

  /**
   * Sets raw accessory energy for this inverter.
   * @param {string} key Accessory key.
   * @param {number} energy Energy consumption to set (in Wh).
   */
  public setRawEnergy(key: string, energy: number) {
    this.rawOutlets[key].setTotalEnergyConsumption(energy);
  }

  /**
   * Sets smooth accessory power from raw accessory power for this inverter.
   * @param {string} key Accessory key.
   */
  public setSmoothPower(key: string) {
    const smoothPower = this.rawOutlets[key].getSmoothPowerConsumption(this.config.smoothingMethod, this.smoothingWindow);

    if (this.config.pureHomeApp) {
      this.smoothLightSensors[key].setAmbientLightLevel(smoothPower);
    } else {
      this.smoothOutlets[key].setPowerConsumption(smoothPower);
    }
  }

  /**
   * Update data from this inverter by using the Solax Cloud API
   */
  public updateInverterDataFromCloud() {
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
   * Returns whether this inverter has a battery installed.
   * @returns {boolean} Whether this inverter battery has a battery installed.
   */
  public hasBattery(): boolean {
    return this.batteryInstalled;
  }

  /**
   * Get array with full list of accessories for this inverter.
   * @returns {AccessoryPlugin[]} Array of accessories for this inverter.
   */
  public getAccessories(): AccessoryPlugin[] {
    return this.solaxAccessories;
  }

}