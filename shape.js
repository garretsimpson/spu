/***
 * Shape Processing Unit (SPU)
 * Author: Garret Simpson
 *
 * Created for Shapez.io: https://github.com/tobspr/shapez.io
 *
 */

const FULL_CIRC = "CuCuCuCu";
const HALF_RECT = "RuRu----";
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
    return this.toShape();
  }

  static codeToHex(code) {
    const hex = code.toString(16).padStart(4, "0");
    return "0x" + hex;
  }

  /**
   * Convert shape code to a shapez constant value.
   * Uses a fixed shape for each piece and a different color for each layer.
   * @returns {String}
   */
  toShape() {
    const COLORS = ["r", "g", "b", "y"];
    const SHAPE = Shape.RECT;
    const EMPTY = "--";
    const SEP = ":";

    const bin = this.code.toString(2).padStart(16, "0");
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

  keyCode() {
    const code = this.code;
    const fcode = this.flip();
    let result = Math.min(code, fcode);

    for (let i = 1; i < 4; i++) {
      result = Math.min(result, this.rotate(code, i));
      result = Math.min(result, this.rotate(fcode, i));
    }
    return result;
  }

  rotate(code, steps) {
    const lShift = steps & 0x3;
    const rShift = 4 - lShift;
    const mask = (0xf >>> rShift) * 0x1111;
    const result =
      ((code >>> rShift) & mask) | ((code << lShift) & ~mask & 0xffff);
    return result;
  }

  right() {
    return new Shape(this.rotate(this.code, 1));
  }

  uturn() {
    return new Shape(this.rotate(this.code, 2));
  }

  left() {
    return new Shape(this.rotate(this.code, 3));
  }

  flip() {
    let code = this.code;
    let result = 0;
    for (let i = 0; i < 4; i++) {
      result = (result << 1) | (code & 0x1111);
      code >>>= 1;
    }
    return result;
  }

  // Remove empty layers
  collapse(code) {
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

  cut() {
    const left = this.collapse(this.code & 0xcccc);
    const right = this.collapse(this.code & 0x3333);
    return [new Shape(left), new Shape(right)];
  }

  stack(shape) {
    const top = shape.code;
    const bottom = this.code;
    for (let offset = 4; offset > 0; offset--) {
      if (((top << ((offset - 1) * 4)) & bottom) != 0) {
        return new Shape(((top << (offset * 4)) | bottom) & 0xffff);
      }
    }
    return new Shape(top | bottom);
  }

  static stackCode(top, bottom) {
    for (let offset = 4; offset > 0; offset--) {
      if (((top << ((offset - 1) * 4)) & bottom) != 0) {
        return ((top << (offset * 4)) | bottom) & 0xffff;
      }
    }
    return top | bottom;
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
      ["left", [0x0001], 0x0008],
      ["right", [0x0001], 0x0002],
      ["uturn", [0x0001], 0x0004],
      ["left", [0x1248], 0x8124],
      ["flip", [0x1234], 0x84c2],
      ["keyCode", [0x4321], 0x1624],
      ["toShape", [0x004b], "RrRr--Rr:----Rg--:--------:--------"],
      ["cut", [0x5aff], [0x48cc, 0x1233]],
      ["cut", [0x936c], [0x084c, 0x0132]],
      ["stack", [0x000f, 0x000f], 0x00ff],
      ["stack", [0x1111, 0x2222], 0x3333],
      ["stack", [0x5111, 0xfffa], 0xf111],
    ];

    let testNum = 0;
    for (let [op, ins, exp] of TESTS) {
      testNum++;
      const code = ins[0];
      const shape = new Shape(code);
      const args = ins.slice(1);
      const result = shape[op](...args.map((v) => new Shape(v)));
      const pass = Shape.pp(result) == Shape.pp(exp);

      console.log(
        "#" + testNum,
        pass ? "PASS" : "FAIL",
        op + "(" + ins.map((v) => Shape.pp(v)).join() + ") returned",
        Shape.pp(result)
      );
      if (!pass) {
        console.log("  expected", Shape.pp(exp));
      }
    }
  }

  static testPerf() {
    let result = 0;
    let reps = 100000;
    const shape = new Shape(0x5111);
    console.time("stack");
    for (let i = 0; i < reps; i++) {
      result = shape.stack(0xfffa);
      //   console.log(Shape.pp(result));
    }
    console.timeEnd("stack");

    console.time("stackCode");
    for (let i = 0; i < reps; i++) {
      result = Shape.stackCode(0xfffa, 0x5111);
      //   console.log(Shape.pp(result));
    }
    console.timeEnd("stackCode");
  }

  static testLogo() {
    const EXP = "RrRr--Rr:----Rg--:--------:--------";
    const INPUT = new Shape(0x000f);
    let shape0, shape1, shape2;

    [shape0, shape1] = INPUT.cut();
    [shape1, shape2] = shape1.left().cut();
    shape1 = shape2.right().stack(shape1);
    shape0 = shape0.left();
    [shape0, shape1] = shape1.stack(shape0).cut();
    [shape1, shape2] = INPUT.cut();
    shape0 = shape0.stack(shape2);

    const result = shape0.toShape();
    const pass = result == EXP;
    console.log("Logo:", pass ? "PASS" : "FAIL", "returned", result);
    if (!pass) {
      console.log("  expected", EXP);
    }
  }
}
