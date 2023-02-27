import { appendFileSync, readFileSync, writeFileSync, rmSync } from "fs";

export class Fileops {
  /**
   * @param {string} filename
   */
  static rmFile(filename) {
    try {
      rmSync(filename, { force: true });
    } catch (err) {
      console.error(err);
      return;
    }
  }

  /**
   * @param {string} filename
   * @returns {*}
   */
  static readFile(filename) {
    let data;
    try {
      data = readFileSync(filename);
    } catch (err) {
      console.error(err);
      return;
    }
    return data;
  }

  /**
   * @param {string} filename
   * @returns {Uint8Array}
   */
  static readBinFile(filename) {
    let data;
    try {
      data = readFileSync(filename);
    } catch (err) {
      console.error(err);
      return;
    }
    return new Uint8Array(data);
  }

  /**
   * @param {string} filename
   * @param {*} data
   */
  static writeFile(filename, data) {
    try {
      writeFileSync(filename, data);
    } catch (err) {
      console.error(err);
    }
  }

  /**
   * @param {string} filename
   * @param {*} data
   */
  static appendFile(filename, data) {
    try {
      appendFileSync(filename, data);
    } catch (err) {
      console.error(err);
    }
  }

  /**
   *
   * @param {string} filename
   * @returns {boolean}
   */
  static deleteFile(filename) {
    try {
      rmSync(filename, { force: true });
    } catch (err) {
      console.error(err);
      return false;
    }
    return true;
  }
}
