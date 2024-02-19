/**
 * Shape 2 operations
 */

export class Shape2 {
  static VOID = "-";
  static CIRC = "C";
  static RECT = "R";
  static STAR = "S";
  static WIND = "W";
  static PINS = "P";
  static CRYS = "X";

  static SHAPE_TYPES = [Shape2.VOID, Shape2.CIRC, Shape2.RECT, Shape2.STAR, Shape2.WIND];
  //   static SHAPE_TYPES = [Shape2.VOID, Shape2.CIRC, Shape2.RECT, Shape2.STAR, Shape2.WIND, Shape2.PINS, Shape2.CRYS];
  static NUM_TYPES = Shape2.SHAPE_TYPES.length;
  static NUM_SPOTS = 4;
  static MAX_VALUE = Shape2.NUM_TYPES ** Shape2.NUM_SPOTS - 1;

  static toNumber(code) {
    return code.toString(Shape2.NUM_TYPES).padStart(Shape2.NUM_SPOTS, "0");
  }

  static toString(code) {
    return Array.from(Shape2.toNumber(code))
      .map((v) => Shape2.SHAPE_TYPES[v])
      .join("");
  }

  static pp(code) {
    let result = code.toString();
    return result;
  }

  static fromString(string) {
    return Number.parseInt(
      Array.from(string)
        .map((v) => Shape2.SHAPE_TYPES.indexOf(v))
        .join(""),
      Shape2.NUM_TYPES
    );
  }

  static LSV = Shape2.NUM_TYPES;
  static MSV = Shape2.NUM_TYPES ** (Shape2.NUM_SPOTS - 1);

  /**
   * Left shift and rotate one digit
   * TODO: Can do this with Numbers or Strings.  I think numbers will be faster.
   * @param {Number} code
   * @returns {Number}
   */
  static rotateLeft(code) {
    const lsd = code % Shape2.MSV;
    const msd = (code - lsd) / Shape2.MSV;
    return lsd * Shape2.LSV + msd;
  }

  /**
   * Right shift and rotate one digit
   * @param {Number} code
   * @returns {Number}
   */
  static rotateRight(code) {
    const lsd = code % Shape2.LSV;
    const msd = (code - lsd) / Shape2.LSV;
    return lsd * Shape2.MSV + msd;
  }

  /**
   * Return the smallest value of all possible rotations
   * TODO: Use an array of values
   * @param {Number} code
   * @returns {Number}
   */
  static keyCode(code) {
    let result = code;
    for (const i of [1, 2, 3]) {
      code = Shape2.rotateLeft(code);
      result = Math.min(result, code);
    }
    return result;
  }

  /**
   * Returns true only if the shape has at most one of each type of quarter.
   * @param {Number} code
   * @returns {Boolean}
   */
  static isOmni(code) {
    const number = Shape2.toNumber(code);
    let num;
    for (let value = 1; value <= Shape2.NUM_TYPES; ++value) {
      // count the number of these values
      num = Array.from(number).filter((v) => v == value).length;
      if (num > 1) return false;
    }
    return true;
  }

  /**
   * Return all keys
   */
  static findKeys() {
    const keys = [];
    for (let code = 1; code <= Shape2.MAX_VALUE; ++code) {
      if (code == Shape2.keyCode(code) && Shape2.isOmni(code)) {
        // if (code == Shape2.keyCode(code)) {
        keys.push(code);
      }
    }
    console.log("Key shapes");
    console.log("Number of types:", Shape2.NUM_TYPES);
    console.log("Number of spots:", Shape2.NUM_SPOTS);
    console.log("Number of keys:", keys.length);
    for (const code of keys) {
      console.log(Shape2.toNumber(code), Shape2.toString(code));
    }
    return keys;
  }

  static test() {
    console.log("Shape2 test");
    console.log("Number of types:", Shape2.NUM_TYPES);
    console.log("Number of spots:", Shape2.NUM_SPOTS);
    // console.log("MSV:", Shape2.MSV);

    const TESTS = [
      ["toString", [0], "----"],
      ["toString", [Shape2.MAX_VALUE], "WWWW"],
      ["fromString", ["CCCC"], 125 + 25 + 5 + 1],
      ["rotateLeft", [Shape2.fromString("CRSW")], Shape2.fromString("RSWC")],
      ["rotateRight", [Shape2.fromString("CRSW")], Shape2.fromString("WCRS")],
      ["keyCode", [Shape2.fromString("CRSW")], Shape2.fromString("CRSW")],
      ["keyCode", [Shape2.fromString("SWCR")], Shape2.fromString("CRSW")],
      ["isOmni", [Shape2.fromString("CRSW")], true],
      ["isOmni", [Shape2.fromString("CCSW")], false],
    ];

    let testNum = 0;
    for (let [op, args, exp] of TESTS) {
      testNum++;
      const result = Shape2[op](...args);
      const pass = Shape2.pp(result) == Shape2.pp(exp);

      console.log(
        "#" + testNum,
        pass ? "PASS" : "FAIL",
        op + "(" + args.map((v) => Shape2.pp(v)).join(",") + ") returned",
        Shape2.pp(result)
      );
      if (!pass) {
        console.log("  expected", Shape2.pp(exp));
      }
    }
  }
}
