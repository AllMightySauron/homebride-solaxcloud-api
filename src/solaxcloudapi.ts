import fetch from 'sync-fetch';

/**
 * SolaxCloudAPIResult interface for Solax Cloud API Result.
 * */
export interface SolaxCloudAPIResult {
    /** Unique identifier of inverter (Serial No) */
    inverterSN: string;
    /** Unique identifier of communication module (Registration No) */
    sn: string;
    /** Inverter AC power total (W) */
    acpower: number;
    /** Inverter AC energy out daily (KWh) */
    yieldtoday: number;
    /** Inverter AC energy out total (KWh) */
    yieldtotal: number;
    /** GCP power total (W) */
    feedinpower: number;
    /** GCP energy to grid total (KWh) */
    feedinenergy: number;
    /** GCP energy from grid total (KWh) */
    consumeenergy: number;
    /** Address 2 meter AC power total (W) */
    feedinpowerM2: number;
    /** Inverter DC battery energy SOC (%) */
    soc: number | null;
    /** Inverter AC EPS power R (W) */
    peps1: number | null;
    /** Inverter AC EPS power S (W) */
    peps2: number | null;
    /** Inverter AC EPS power T (W) */
    peps3: number | null;
    /** Inverter type code */
    inverterType: string;
    /** Inverter status code */
    inverterStatus: string;
    /** Update time */
    uploadTime: string;
    /** Inverter DC Battery power total (W) */
    batPower: number;
    /** Inverter DC PV power MPPT1 (W) */
    powerdc1: number | null;
    /** Inverter DC PV power MPPT2 (W) */
    powerdc2: number | null;
    /** Inverter DC PV power MPPT3 (W) */
    powerdc3: number | null;
    /** Inverter DC PV power MPPT4 (W) */
    powerdc4: number | null;
}

/**
 * SolaxCloudAPIResponse interface for responses from Solax Cloud API.
 */
export interface SolaxCloudAPIResponse {
    /** Response from server */
    exception: string;
    /** Data returned */
    result: SolaxCloudAPIResult;
    /** Whether the data request was successful */
    success: boolean;
}

/**
 * Brand for cloud data fetching.
 */
export const BRAND = {
  SOLAX: 0,
  QCELLS: 1,
};

/**
 * Cloud API URL for data fetching.
 */
const CLOUD_URL = {
  SOLAX: 'https://www.solaxcloud.com:9443/proxy/api/getRealtimeInfo.do',
  QCELLS: 'https://www.portal-q-cells.us/proxyApp/proxy/api/getRealtimeInfo.do',
};

/**
 * Main class to retrieve data from Solax API.
 */
export class SolaxCloudAPI {

  /**
     * Class constructor.
     * @param {number} brand Brand type.
     * @param {string} tokenId Token ID to gather data from Solax Cloud API.
     * @param {string} sn Unique identifier of inverter (Serial No).
     */
  constructor (public readonly brand: number, public readonly tokenId: string, public readonly sn: string) {
    this.brand = brand;
    this.tokenId = tokenId;
    this.sn = sn;
  }

  /**
   * Gets the cloud API URL depending on the inverter brand.
   * @returns Cloud API URL.
   */
  private getCloudURL(): string {
    if (this.brand === BRAND.QCELLS) {
      return CLOUD_URL.QCELLS;
    } else {
      return CLOUD_URL.SOLAX;
    }
  }

  /**
     * Gets the inverter type description from the corresponding type code.
     * @param {string} typeCode The Solax inverter type code.
     * @returns Corresponding inverter type description.
     */
  public static getInverterType(typeCode: string): string {
    switch (typeCode) {
      case '1':
        return 'X1-LX';
      case '2':
        return 'X-Hybrid';
      case '3':
        return 'X1-Hybiyd/Fit';
      case '4':
        return 'X1-Boost/Air/Mini';
      case '5':
        return 'X3-Hybiyd/Fit';
      case '6':
        return 'X3-20K/30K';
      case '7':
        return 'X3-MIC/PRO';
      case '8':
        return 'X1-Smart';
      case '9':
        return 'X1-AC';
      case '10':
        return 'A1-Hybrid';
      case '11':
        return 'A1-Fit';
      case '12':
        return 'A1-Grid';
      case '13':
        return 'J1-ESS';
      default:
        return 'Unknown';
    }
  }

  /**
     * Gets the inverter status description from the corresponding status code.
     * @param {string} statusCode The inverter status code.
     * @returns Corresponding inverter status description.
     */
  public static getInverterStatus(statusCode: string): string {
    switch (statusCode) {
      case '100':
        return 'Wait Mode';
      case '101':
        return 'Check Mode';
      case '102':
        return 'Normal Mode';
      case '103':
        return 'Fault Mode';
      case '104':
        return 'Permanent Fault Mode';
      case '105':
        return 'Update Mode';
      case '106':
        return 'EPS Check Mode';
      case '107':
        return 'EPS Mode';
      case '108':
        return 'Self-Test Mode';
      case '109':
        return 'Idle Mode';
      case '110':
        return 'Standby Mode';
      case '111':
        return 'Pv Wake Up Bat Mode';
      case '112':
        return 'Gen Check Mode';
      case '113':
        return 'Gen Run Mode';
      default:
        return 'Unknown';
    }
  }

  /**
   * Gets the inverter fed photovoltaic DC power (in W) from the retrieved API results.
   * @param {SolaxCloudAPIResult} data The result data retrieved from the Solax Cloud API.
   * @returns {number} The measured inverter photovoltaic input DC power (in W).
   */
  public static getPVPower(data: SolaxCloudAPIResult): number {
    return (data.powerdc1 || 0) + (data.powerdc2 || 0) + (data.powerdc3 || 0) + (data.powerdc4 || 0);
  }

  /**
   * Gets the inverter output AC power (in W) from the retrieved API results.
   * @param {SolaxCloudAPIResult} data The result data retrieved from the Solax Cloud API.
   * @returns {number} The measured inverter output AC power (in W).
   */
  public static getInverterACPower(data: SolaxCloudAPIResult): number {
    return data.acpower;
  }

  /**
   * Gets the inverter power charging battery (in W) from the retrieved API results.
   * @param {SolaxCloudAPIResult} data The result data retrieved from the Solax Cloud API.
   * @returns {number} The measured inverter DC power to battery (in W).
   */
  public static getInverterPowerToBattery(data: SolaxCloudAPIResult): number {
    return data.batPower > 0 ? data.batPower : 0;
  }

  /**
   * Gets the inverter power drawn from battery (in W) from the retrieved API results.
   * @param {SolaxCloudAPIResult} data The result data retrieved from the Solax Cloud API.
   * @returns {number} The measured inverter DC power from battery (in W).
   */
  public static getInverterPowerFromBattery(data: SolaxCloudAPIResult): number {
    return data.batPower < 0 ? -data.batPower : 0;
  }

  /**
   * Gets the Inverter AC energy out for today (KWh) from the retrieved API results.
   * @param {SolaxCloudAPIResult} data The result data retrieved from the Solax Cloud API.
   * @returns {number} The AC energy output by the inverter today (in KWh).
   */
  public static getYieldToday(data: SolaxCloudAPIResult): number {
    return data.yieldtoday;
  }

  /**
   * Gets the Inverter AC energy out total (KWh) from the retrieved API results.
   * @param {SolaxCloudAPIResult} data The result data retrieved from the Solax Cloud API.
   * @returns {number} The total AC energy output by the inverter (in KWh).
   */
  public static getYieldTotal(data: SolaxCloudAPIResult): number {
    return data.yieldtotal;
  }

  /**
   * Gets the battery State of Charge - Soc (%) from the retrieved API results.
   * @param {SolaxCloudAPIResult} data The result data retrieved from the Solax Cloud API.
   * @returns {number} The battery State of Charge for this inverter (%).
   */
  public static getBatterySoC(data: SolaxCloudAPIResult): number {
    return data.soc === null ? 0: data.soc;
  }

  /**
   * Gets the power currently being fed to the grid by the inverter (in W).
   * @param {SolaxCloudAPIResult} data The result data retrieved from the Solax Cloud API.
   * @returns The power currently being sent to the grid (in W).
   */
  public static getInverterPowerToGrid(data: SolaxCloudAPIResult): number {
    return data.feedinpower > 0 ? data.feedinpower : 0;
  }

  /**
   * Gets the power currently being drawn from the grid to the house (in W).
   * @param {SolaxCloudAPIResult} data The result data retrieved from the Solax Cloud API.
   * @returns The power currently being drawn from the grid to the house (in W).
   */
  public static getGridPowerToHouse(data: SolaxCloudAPIResult): number {
    return data.feedinpower < 0 ? -data.feedinpower : 0;
  }

  /**
   * Gets the power currently being generated by the inverter to the house (in W).
   * @param {SolaxCloudAPIResult} data The result data retrieved from the Solax Cloud API.
   * @returns The power currently being generated by the inverter to the house (in W).
   */
  public static getInverterPowerToHouse(data: SolaxCloudAPIResult): number {
    return this.getInverterACPower(data )- this.getInverterPowerToGrid(data);
  }

  /**
   * Retrieves inverter data using Solax Cloud "real-time" API.
   * @returns {SolaxCloudAPIResponse} The response by Solax Cloud API.
   */
  public getAPIData(): SolaxCloudAPIResponse {
    try {
      const response = fetch(this.getCloudURL() + '?tokenId=' + this.tokenId + '&sn=' + this.sn);

      if (!response.ok) {
        throw new Error(`unexpected response ${response.statusText}`);
      }

      return <SolaxCloudAPIResponse> response.json();
    } catch (error) {
      return <SolaxCloudAPIResponse> { exception: error, result: {}, success: false };
    }
  }

}