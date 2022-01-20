/**
 * Statistics.
 * This class is used for statistical calculations for the purpose of smoothing a series of value.
 */
export class Statistics {

  /**
     * Simple moving average calculation from a series of values.
     * Formula is
     *    SMA = (V1 + V2 + ... + Vn) / n
     * where
     *    Vn = Series value for period n
     *    n = number values in period
     * @param {number[]} series Array with series of values.
     * @param {number} windowSize Size of moving average window.
     * @param {number} maxCalculations Maximum calculations to be performed.
     * @returns {number[]} Array with simple moving averages from series.
     */
  public static simpleMovingAverage(series: number[], windowSize: number, maxCalculations = Infinity): number[] {
    const result: number[] = [];

    // sanity check
    if (!series || !windowSize || series.length < windowSize) {
      return result;
    }

    // first index to compute
    let index = windowSize - 1;

    // max series lenght
    const length = series.length + 1;

    // number of simple moving averages calculated
    let numberOfSMAsCalculated = 0;

    // loop over series array
    while (++index < length && numberOfSMAsCalculated++ < maxCalculations) {
      // create array with window slice only
      const windowSlice = series.slice(index - windowSize, index);

      // compute slice sum
      const sum = windowSlice.reduce((prev, curr) => prev + curr, 0);

      // push new moving average to result
      result.push(sum / windowSize);
    }

    return result;
  }

  /**
     * Exponential moving average calculation from a series of values.
     * Formula is
     *    EMAn = (Vn - EMAn-1) * weight + EMAn-1
     * where
     *    EMAn = Exponential Moving Average for period n
     *    EMAn-1 = Exponential Moving Average for period n - 1
     *    Vn = Series value for period n
     *    weight = multiplier to use lower weights for older value
     *    w = window size
     * and
     *    weight = 2 / (w + 1)
     * @param {number[]} series Array with series of values.
     * @param {number} windowSize Size of moving average window.
     * @returns {number[]} Array with exponential moving averages from series.
     */
  public static exponentialMovingAverage(series: number[], windowSize: number) {
    const result: number[] = [];

    // sanity check
    if (!series || !windowSize || series.length < windowSize) {
      return result;
    }

    // first index to compute
    let index = windowSize - 1;

    // set previous EMA index
    let previousEmaIndex = 0;

    // setup smoothing factor
    const smoothingFactor = 2 / (windowSize + 1);

    // calculate first EMA using SMA
    const [SMA] = Statistics.simpleMovingAverage(series, windowSize, 1);
    result.push(SMA);

    // loop over series array
    while (++index < series.length) {
      // get current value
      const value = series[index];

      // get previous EMA
      const previousEMA = result[previousEmaIndex++];

      // calculate current EMA
      const currentEMA = (value - previousEMA) * smoothingFactor + previousEMA;

      result.push(currentEMA);
    }

    return result;
  }

}