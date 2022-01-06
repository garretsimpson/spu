/***
 * Shape - Shape handling primitives
 *
 * - A shape 4 quadrants and 1 to 4 layers.
 * - A shape is represented internally by 16 bit integer (shape code), one bit for each possible position.
 * - The order of the bits is simply the reverse order of the game's shape string (constant value).
 * - Shape piece types (C, R, S, W) and colors are currently not used.
 * - The constructor takes a 16 bit integer (shape code).
 * - Basic shape operations: rotate (left, uturn, right), cut, stack, unstack.
 */

import { readFileSync } from "fs";

const FULL_CIRC = "CuCuCuCu"; // 0x000F
const HALF_RECT = "RuRu----"; // 0x0003
const LOGO = "RuCw--Cw:----Ru--"; // 0x004B
const ROCKET = "CbCuCbCu:Sr------:--CrSrCr:CwCwCwCw"; // 0xFE1F

export class Shape {
  static CIRC = "C";
  static RECT = "R";
  static STAR = "S";
  static WIND = "W";

  static IMPOSSIBLE = [0x0014, 0x0034, 0x0052, 0x0078, 0x0114];

  static allShapes;

  /**
   * @param {Number} code
   */
  constructor(code) {
    this.code = code;
  }

  toString() {
    return Shape.toShape(this.code);
  }

  static init() {
    Shape.allShapes = new Set();
    Shape.readShapeFile();
  }

  static readShapeFile() {
    const FILENAME = "data/allShapes.txt";
    let data;
    try {
      console.log("Reading file:", FILENAME);
      data = readFileSync(FILENAME, "utf8");
    } catch (e) {
      console.error(e);
      return;
    }

    const EOL = /\r?\n/;
    const lines = data.toString().trim().split(EOL);
    console.log("lines:", lines.length);
    let badCodes = 0;
    let goodCodes = 0;
    for (const line of lines) {
      const [key, values] = line.split(/ /);
      const codes = values.split(/,/);
      for (const code of codes) {
        const num = Number.parseInt("0x" + code);
        if (Number.isNaN(num)) {
          badCodes++;
          continue;
        }
        goodCodes++;
        Shape.allShapes.add(num);
      }
    }
    console.log("good:", goodCodes);
    console.log("bad:", badCodes);
    console.log("");
  }

  static codeToHex(code) {
    return code.toString(16).padStart(4, "0");
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
      if (bin[15 - i] == "1") {
        // const layer = Math.trunc(i / 4);
        // const color = COLORS[layer];
        const color = "u";
        val = SHAPE + color;
      }
      if (i == 4 || i == 8 || i == 12) {
        result += SEP;
      }
      result += val;
    }
    return result;
  }

  /**
   * Compute the canonical shape code
   * @param {Number} code
   * @returns {Number}
   */
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
    const left = Shape.cutLeftCode(code);
    const right = Shape.cutRightCode(code);
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
    if (code == 0) return [0, 0];
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

  static layerCount(code) {
    let max = 0x0fff;
    for (let num = 4; num > 0; num--) {
      if (code > max) {
        return num;
      }
      max >>>= 4;
    }
    return 0;
  }

  // Returns true if the shape contains an empty layer
  static isInvalid(code) {
    if (code == 0) {
      return true;
    }
    for (; code > 0; code >>>= 4) {
      if ((code & 0xf) == 0) {
        return true;
      }
    }
    return false;
  }

  static isImpossible(code) {
    if (Shape.allShapes == undefined || Shape.allShapes.length == 0) {
      return false;
    }
    return !Shape.allShapes.has(code);
  }

  static toLayers(code) {
    const result = [];
    while (code > 0) {
      const [bottom, top] = Shape.unstackCode(code);
      result.push(top);
      code = bottom;
    }
    return result;
  }

  /**
   * Tries to unstack and restack all layers.
   * Layers: 1, 1/1, 1/1/1, 1/1/1/1
   */
  static canStackAll(code) {
    if (code == 0) {
      return false;
    }
    let layers = Shape.toLayers(code);
    let result = layers[0];
    for (let i = 1; i < layers.length; i++) {
      const bottom = layers[i];
      result = Shape.stackCode(result, bottom);
    }
    return result == code;
  }

  /**
   * Tries to unstack and restack just some of the layers.
   * Layers: 1, 1/1, 1/2, 2/1, 1/3, 2/2, 3/1
   */
  static canStackSome(code) {
    if (code == 0) {
      return false;
    }
    const numLayers = Shape.layerCount(code);
    if (numLayers == 1) return true;
    let tmp = 0;
    let top = 0;
    let bottom = code;
    for (let i = 1; i < numLayers; i++) {
      [bottom, tmp] = Shape.unstackCode(bottom);
      top = (top << 4) + tmp;
      const result = Shape.stackCode(top, bottom);
      if (result == code) return true;
    }
    return false;
  }

  static canCut(code) {
    if (code == 0) {
      return false;
    }
    // try cutting vertically
    let [left, right] = Shape.cutCode(code);
    if (Shape.stackCode(left, right) == code) {
      return true;
    }
    // try cutting horizontally
    code = Shape.rightCode(code);
    let [bottom, top] = Shape.cutCode(code);
    if (Shape.stackCode(bottom, top) == code) {
      return true;
    }
    return false;
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
      ["toShape", [0x004b], "RrRr--Rr:----Rg--:--------:--------"],
      ["flipCode", [0x1234], 0x84c2],
      ["keyCode", [0x4321], 0x1624],
      ["leftCode", [0x0001], 0x0008],
      ["leftCode", [0x1248], 0x8124],
      ["rightCode", [0x0001], 0x0002],
      ["uturnCode", [0x0001], 0x0004],
      ["cutCode", [0x5aff], [0x48cc, 0x1233]],
      ["cutCode", [0x936c], [0x084c, 0x0132]],
      ["stackCode", [0x000f, 0x000f], 0x00ff],
      ["stackCode", [0x1111, 0x2222], 0x3333],
      ["stackCode", [0xfffa, 0x5111], 0xf111],
      ["unstackCode", [0x000f], [0x0000, 0x000f]],
      ["unstackCode", [0x0234], [0x0034, 0x0002]],
      ["unstackCode", [0x1234], [0x0234, 0x0001]],
      ["layerCount", [0x0001], 1],
      ["layerCount", [0x000f], 1],
      ["layerCount", [0xffff], 4],
      ["toLayers", [0x0001], [0x0001]],
      ["toLayers", [0xabcd], [0x000a, 0x000b, 0x000c, 0x000d]],
      ["isInvalid", [0x0000], true],
      ["isInvalid", [0x0001], false],
      ["isInvalid", [0x0010], true],
      ["canStackAll", [0x0001], true],
      ["canStackAll", [0x0012], false],
      ["canStackAll", [0xffff], true],
      ["canStackSome", [0x000f], true],
      ["canStackSome", [0x00ff], true],
      ["canStackSome", [0x0fff], true],
      ["canStackSome", [0xffff], true],
      ["canStackAll", [0xfa5f], false],
      ["canStackSome", [0xfa5f], true],
      ["canCut", [0x0012], true],
      ["canCut", [0x00f1], false],
      ["canCut", [0x00ff], true],
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

  static testAllShapes() {
    // Initialize
    Shape.init();

    const allShapes = Shape.allShapes;
    const keyShapes = new Map();
    for (let code = 0; code <= 0xffff; code++) {
      const key = Shape.keyCode(code);
      keyShapes.set(key, {});
    }
    console.log("Number of shapes:", allShapes.size);
    console.log("Number of key shapes", keyShapes.size);

    // Analyze each shape
    console.log("");
    console.log("Analysis...");
    for (const [code, value] of keyShapes) {
      value.layers = Shape.layerCount(code);
      value.invalid = Shape.isInvalid(code);
      value.cuttable = Shape.canCut(code);
      value.stackAll = Shape.canStackAll(code);
      value.stackSome = Shape.canStackSome(code);
      value.impossible = Shape.isImpossible(code);
    }
    const unknownShapes = [];
    for (const [code, value] of keyShapes) {
      const known =
        value.invalid || value.impossible || value.cuttable || value.stackAll;
      // const known = value.invalid || !value.impossible;
      if (!known) unknownShapes.push(code);
    }

    // Display results
    const NON = "-";
    for (const [code, value] of keyShapes) {
      const unknown = unknownShapes.includes(code);
      console.log(
        Shape.pp(code),
        value.layers.toString() + (value.impossible ? "X" : NON),
        (value.invalid ? "I" : NON) +
          (value.cuttable ? "C" : NON) +
          (value.stackAll ? "S" : NON),
        unknown ? "XXXX" : ""
      );
    }
    console.log("");
    console.log("Number unknown:", unknownShapes.length);
    let code = unknownShapes[0];
    console.log("First unknown:", Shape.pp(code));
    console.log(Shape.toShape(code));
    console.log("");
    console.log(Shape.graph(code));

    const MAX_NUM = 8;
    const numLines = Math.floor(unknownShapes.length / MAX_NUM) + 1;
    for (let i = 0; i < numLines; i++) {
      const pos = MAX_NUM * i;
      const shapes = unknownShapes.slice(pos, pos + MAX_NUM);
      const line = shapes.map((v) => Shape.pp(v)).join(" ");
      console.log(line);
    }
    console.log("");
    for (let i = 0; i < numLines; i++) {
      const pos = MAX_NUM * i;
      const shapes = unknownShapes.slice(pos, pos + MAX_NUM);
      const head = shapes
        .map(
          (v) =>
            Shape.pp(v) +
            " " +
            (keyShapes.get(v).stackSome ? "S" : "-") +
            (keyShapes.get(v).cuttable ? "C" : "-") +
            " "
        )
        .join("   ");
      console.log(head);

      const graphs = shapes.map((v) => Shape.graph(v));
      for (let i = 0; i < 4; i++) {
        const line = graphs
          .map((v) => v.split(/\n/))
          .map((v) => v[i])
          .join("   ");
        console.log(line);
      }
      console.log("");
    }
  }

  static graph(code) {
    const bin = code.toString(2).padStart(16, "0");
    const ICONS = ["- ", "X "];
    let result = "";
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        const pos = 4 * y + (3 - x);
        const bit = bin[pos];
        result += bit == "0" ? ICONS[0] : ICONS[1];
      }
      result += "\n";
    }
    return result;
  }

  static makeMap() {
    Shape.init();

    const ICONS = ["  ", "XX"];
    console.log("4-layer impossible shapes");
    let head = "";
    for (let x = 0; x <= 0xff; x++) {
      const code = x.toString(16).padStart(2, "0");
      head += code;
    }
    console.log("  ", head);
    for (let y = 0; y <= 0xff; y++) {
      let row = "";
      for (let x = 0; x <= 0xff; x++) {
        const num = (y << 8) + x;
        const found = Shape.allShapes.has(num);
        const code = x.toString(16).padStart(2, "0");
        row += found ? ICONS[0] : code;
      }
      const code = y.toString(16).padStart(2, "0");
      console.log(code, row);
    }
  }

  static makeShapeMap() {
    Shape.init();

    console.log("2-layer impossible shapes");
    for (let y = 0; y <= 0x0f; y++) {
      let row = "";
      for (let x = 0; x <= 0x0f; x++) {
        const num = (x << 4) + y;
        const found = Shape.allShapes.has(num);
        const code = Shape.toShape(x).substring(0, 8);
        row += found ? "        " : code;
        row += " ";
      }
      console.log(Shape.toShape(y).substring(0, 8) + " : " + row);
    }
  }
}
