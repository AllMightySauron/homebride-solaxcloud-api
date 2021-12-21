
/**
 * Utility class.
 */
export class Util {

  /**
   * Calculates 32 bit hash from a string.
   * @param s {string} String to calculate 32 bit hash from.
   * @returns {number} The 32 bit hash from the string.
   */
  public static hash32(s: string): number {
    let hash = 0;

    if (s.length === 0) {
      return hash;
    }

    for (let i = 0; i < s.length; i++) {
      const chr = s.charCodeAt(i);

      hash = ((hash << 5) - hash) + chr;
      hash |= 0; // Convert to 32bit integer
    }

    return hash;
  }

  /**
   * Removes non-standard alphanumeric characters from string.
   * @param {string} s The original string.
   * @returns {string} Resulting string without any non-standard chars.
   */
  public static normalizeName(s: string) {
    return s.replace(/[^-_ a-zA-Z0-9]/gi, '');
  }

}