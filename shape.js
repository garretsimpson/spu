/***
 * Shape - Shape handling primitives
 *
 * - A shape has 4 possible layers.  Each layer has 4 positions (quads).
 * - A shape is represented internally by 16 bit integer (shape code), one bit for each possible position.
 * - The order of the bits is simply the reverse order of the game's shape string.
 * - Shape piece types (C, R, S, W) and colors are currently not used.
 * - The constructor takes a 16 bit integer (shape code).
 * - Basic shape operations: rotate(left, uturn, right), cut, stack
 * - The flip and keyCode functions are used to compute a canonical shape code.
 */

import { Spu } from "./spu.js";

const FULL_CIRC = "CuCuCuCu"; // 0x000F
const HALF_RECT = "RuRu----"; // 0x0003
const LOGO = "RuCw--Cw:----Ru--"; // 0x004B
const ROCKET = "CbCuCbCu:Sr------:--CrSrCr:CwCwCwCw"; // 0xFE1F

export class Shape {
  static CIRC = "C";
  static RECT = "R";
  static STAR = "S";
  static WIND = "W";

  /**
   * @param {Number} code
   */
  constructor(code) {
    this.code = code;
  }

  toString() {
    return Shape.toShape(this.code);
  }

  static codeToHex(code) {
    const hex = code.toString(16).padStart(4, "0");
    return hex;
    //return "0x" + hex;
  }

  /**
   * Convert shape code to a shapez constant value.
   * Uses a fixed shape for each piece and a different color for each layer.
   * @returns {String}
   */
  static toShape(code) {
    const COLORS = ["r", "g", "b", "y"];
    const SHAPE = Shape.RECT;
    const EMPTY = "--";
    const SEP = ":";

    const bin = code.toString(2).padStart(16, "0");
    let result = "";
    for (let i = 0; i < 16; i++) {
      let val = EMPTY;
      if (bin[15 - i] == 1) {
        const layer = Math.trunc(i / 4);
        const color = COLORS[layer];
        val = SHAPE + color;
      }
      if (i == 4 || i == 8 || i == 12) {
        result += SEP;
      }
      result += val;
    }
    return result;
  }

  static keyCode(code) {
    const fcode = Shape.flipCode(code);
    let result = Math.min(code, fcode);

    for (let i = 1; i < 4; i++) {
      result = Math.min(result, Shape.rotateCode(code, i));
      result = Math.min(result, Shape.rotateCode(fcode, i));
    }
    return result;
  }

  static rotateCode(code, steps) {
    const lShift = steps & 0x3;
    const rShift = 4 - lShift;
    const mask = (0xf >>> rShift) * 0x1111;
    const result =
      ((code >>> rShift) & mask) | ((code << lShift) & ~mask & 0xffff);
    return result;
  }

  static rightCode(code) {
    return Shape.rotateCode(code, 1);
  }

  right() {
    return new Shape(Shape.rightCode(this.code));
  }

  static uturnCode(code) {
    return Shape.rotateCode(code, 2);
  }

  uturn() {
    return new Shape(Shape.uturnCode(this.code));
  }

  static leftCode(code) {
    return Shape.rotateCode(code, 3);
  }

  left() {
    return new Shape(Shape.leftCode(this.code));
  }

  static flipCode(code) {
    let result = 0;
    for (let i = 0; i < 4; i++) {
      result = (result << 1) | (code & 0x1111);
      code >>>= 1;
    }
    return result;
  }

  // Remove empty layers
  static collapse(code) {
    let result = 0;
    for (let i = 0; i < 4; i++) {
      const val = code & 0xf000;
      if (val != 0) {
        result = (result << 4) | (val >>> 12);
      }
      code <<= 4;
    }
    return result;
  }

  static cutCode(code) {
    const left = Shape.collapse(code & 0xcccc);
    const right = Shape.collapse(code & 0x3333);
    return [left, right];
  }

  static cutLeftCode(code) {
    return Shape.collapse(code & 0xcccc);
  }

  static cutRightCode(code) {
    return Shape.collapse(code & 0x3333);
  }

  cut() {
    const [left, right] = Shape.cutCode(this.code);
    return [new Shape(left), new Shape(right)];
  }

  static stackCode(top, bottom) {
    for (let offset = 4; offset > 0; offset--) {
      if (((top << ((offset - 1) * 4)) & bottom) != 0) {
        return ((top << (offset * 4)) | bottom) & 0xffff;
      }
    }
    return top | bottom;
  }

  stack(shape) {
    const top = shape.code;
    const bottom = this.code;
    const result = Shape.stackCode(top, bottom);
    return new Shape(result);
  }

  static unstackCode(code) {
    let layer = 3;
    let key = 0xf000;
    for (; layer >= 0; layer--) {
      if ((code & key) != 0) break;
      key >>>= 4;
    }
    const bottom = code & ~key;
    const top = code >>> (layer * 4);
    return [bottom, top];
  }

  static unstackBottomCode(code) {
    return Shape.unstackCode(code)[0];
  }

  static unstackTopCode(code) {
    return Shape.unstackCode(code)[1];
  }

  unstack(shape) {
    const [bottom, top] = unstackCode(shape.code);
    return [new Shape(bottom), new Shape(top)];
  }

  // pretty print
  static pp(value) {
    if (typeof value === "number") {
      return Shape.codeToHex(value);
    }
    if (typeof value === "object" && value instanceof Shape) {
      return Shape.pp(value.code);
    }
    if (typeof value === "object" && Array.isArray(value)) {
      return "[" + value.map((v) => Shape.pp(v)).join() + "]";
    }
    return JSON.stringify(value);
  }

  static runTests() {
    const TESTS = [
      ["leftCode", [0x0001], 0x0008],
      ["rightCode", [0x0001], 0x0002],
      ["uturnCode", [0x0001], 0x0004],
      ["leftCode", [0x1248], 0x8124],
      ["flipCode", [0x1234], 0x84c2],
      ["keyCode", [0x4321], 0x1624],
      ["toShape", [0x004b], "RrRr--Rr:----Rg--:--------:--------"],
      ["cutCode", [0x5aff], [0x48cc, 0x1233]],
      ["cutCode", [0x936c], [0x084c, 0x0132]],
      ["stackCode", [0x000f, 0x000f], 0x00ff],
      ["stackCode", [0x1111, 0x2222], 0x3333],
      ["stackCode", [0xfffa, 0x5111], 0xf111],
      ["unstackCode", [0x000f], [0x0000, 0x000f]],
      ["unstackCode", [0x0234], [0x0034, 0x0002]],
      ["unstackCode", [0x1234], [0x0234, 0x0001]],
    ];

    let testNum = 0;
    for (let [op, args, exp] of TESTS) {
      testNum++;
      const result = Shape[op](...args);
      const pass = Shape.pp(result) == Shape.pp(exp);

      console.log(
        "#" + testNum,
        pass ? "PASS" : "FAIL",
        op + "(" + args.map((v) => Shape.pp(v)).join(",") + ") returned",
        Shape.pp(result)
      );
      if (!pass) {
        console.log("  expected", Shape.pp(exp));
      }
    }
  }

  static testPerf() {
    let result = 0;
    let name, pass;
    let reps = 100000;

    const topCode = 0xfffa;
    const bottomCode = 0x5111;
    const expCode = 0xf111;

    name = "stackCode";
    console.time(name);
    for (let i = 0; i < reps; i++) {
      result = Shape[name](topCode, bottomCode);
    }
    console.timeEnd(name);
    pass = result == expCode;
    console.log(name, pass ? "PASS" : "FAIL");

    const top = new Shape(topCode);
    const bottom = new Shape(bottomCode);
    name = "stack";
    console.time(name);
    for (let i = 0; i < reps; i++) {
      result = bottom[name](top);
    }
    console.timeEnd(name);
    pass = result.code == expCode;
    console.log(name, pass ? "PASS" : "FAIL");
  }

  static testLogo() {
    const EXP = "RrRr--Rr:----Rg--:--------:--------";
    let shape0, shape1, shape2;

    const INPUT = new Shape(0x000f);
    [shape0, shape1] = INPUT.cut();
    [shape1, shape2] = shape1.left().cut();
    shape1 = shape2.right().stack(shape1);
    shape0 = shape0.left();
    [shape0, shape1] = shape1.stack(shape0).cut();
    [shape1, shape2] = INPUT.cut();
    shape0 = shape0.stack(shape2);

    const result = Shape.toShape(shape0.code);
    const pass = result == EXP;
    console.log("Logo:", pass ? "PASS" : "FAIL", "returned", result);
    if (!pass) {
      console.log("  expected", EXP);
    }
  }
}
