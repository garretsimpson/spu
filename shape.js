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

import { Fileops } from "./fileops.js";

const FULL_CIRC = "CuCuCuCu"; // 0x000F
const HALF_RECT = "RuRu----"; // 0x0003
const LOGO = "RuCw--Cw:----Ru--"; // 0x004B
const ROCKET = "CbCuCbCu:Sr------:--CrSrCr:CwCwCwCw"; // 0xFE1F

export class Shape {
  static CIRC = "C";
  static RECT = "R";
  static STAR = "S";
  static WIND = "W";

  /** @type {Set<number>} */
  static allShapes;
  /** @type {Map<number,object>} */
  static keyShapes;

  /**
   * @param {number} code
   */
  constructor(code) {
    this.code = code;
  }

  /**
   * @returns {string}
   */
  toString() {
    return Shape.toShape(this.code);
  }

  static init() {
    Shape.allShapes = new Set();
    Shape.readShapeFile();

    Shape.keyShapes = new Map();
    for (let code = 0; code <= 0xffff; code++) {
      const key = Shape.keyCode(code);
      Shape.keyShapes.set(key, {});
    }
  }

  static readShapeFile() {
    const data = Fileops.readFile("data/allShapes.txt");
    if (!data) return;
    const lines = data.toString().trim().split(/\r?\n/);
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

  /**
   * @param {number} code
   * @returns {string}
   */
  static codeToHex(code) {
    return code.toString(16).padStart(4, "0");
  }

  /**
   * Convert shape code to a shapez constant value.
   * Uses a fixed shape for each piece and a different color for each layer.
   * @param {number} code
   * @returns {string}
   */
  static toShape(code) {
    // const COLORS = ["r", "g", "b", "y"];
    const COLOR = "u";
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
        val = SHAPE + COLOR;
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
   * @param {number} code
   * @returns {number}
   */
  static keyCode(code) {
    const fcode = Shape.mirrorCode(code);
    let result = Math.min(code, fcode);

    for (let i = 1; i < 4; i++) {
      result = Math.min(result, Shape.rotateCode(code, i));
      result = Math.min(result, Shape.rotateCode(fcode, i));
    }
    return result;
  }

  /**
   * @param {number} code
   * @param {number} steps
   * @returns {number}
   */
  static rotateCode(code, steps) {
    const lShift = steps & 0x3;
    const rShift = 4 - lShift;
    const mask = (0xf >>> rShift) * 0x1111;
    const result =
      ((code >>> rShift) & mask) | ((code << lShift) & ~mask & 0xffff);
    return result;
  }

  /**
   * @param {number} code
   * @returns {number}
   */
  static rightCode(code) {
    return Shape.rotateCode(code, 1);
  }

  /**
   * @returns {Shape}
   */
  right() {
    return new Shape(Shape.rightCode(this.code));
  }

  /**
   * @param {number} code
   * @returns {number}
   */
  static uturnCode(code) {
    return Shape.rotateCode(code, 2);
  }

  /**
   * @returns {Shape}
   */
  uturn() {
    return new Shape(Shape.uturnCode(this.code));
  }

  /**
   * @param {number} code
   * @returns {number}
   */
  static leftCode(code) {
    return Shape.rotateCode(code, 3);
  }

  /**
   * @returns {Shape}
   */
  left() {
    return new Shape(Shape.leftCode(this.code));
  }

  /**
   * @param {number} code
   * @returns {number}
   */
  static mirrorCode(code) {
    let result = 0;
    for (let i = 0; i < 4; i++) {
      result = (result << 1) | (code & 0x1111);
      code >>>= 1;
    }
    return result;
  }

  /**
   * @returns {Shape}
   */
  mirror() {
    return new Shape(Shape.mirrorCode(this.code));
  }

  /**
   * Remove empty layers
   * @param {number} code
   * @returns {number}
   */
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

  /**
   * @param {number} code
   * @returns {number}
   */
  static cutCode(code) {
    const left = Shape.cutLeftCode(code);
    const right = Shape.cutRightCode(code);
    return [left, right];
  }

  /**
   * @param {number} code
   * @returns {number}
   */
  static cutLeftCode(code) {
    return Shape.collapse(code & 0xcccc);
  }

  /**
   * @param {number} code
   * @returns {number}
   */
  static cutRightCode(code) {
    return Shape.collapse(code & 0x3333);
  }

  /**
   * @returns {[Shape,Shape]}
   */
  cut() {
    const [left, right] = Shape.cutCode(this.code);
    return [new Shape(left), new Shape(right)];
  }

  /**
   * @param {number} top
   * @param {number} bottom
   * @returns {number}
   */
  static stackCode(top, bottom) {
    for (let offset = 4; offset > 0; offset--) {
      if (((top << ((offset - 1) * 4)) & bottom) != 0) {
        return ((top << (offset * 4)) | bottom) & 0xffff;
      }
    }
    return top | bottom;
  }

  /**
   * @param {Shape} shape
   * @returns {Shape}
   */
  stack(shape) {
    const top = shape.code;
    const bottom = this.code;
    const result = Shape.stackCode(top, bottom);
    return new Shape(result);
  }

  /**
   * @param {number} code
   * @returns {[number,number]}
   */
  static unstackCode(code) {
    if (code == 0) return [0, 0];
    const num = Shape.layerCount(code) - 1;
    const mask = 0x000f << (4 * num); // top layer
    const bottom = code & ~mask;
    const top = code >>> (4 * num);
    return [bottom, top];
  }

  /**
   * @param {number} code
   * @returns {number}
   */
  static unstackBottomCode(code) {
    return Shape.unstackCode(code)[0];
  }

  /**
   * @param {number} code
   * @returns {number}
   */
  static unstackTopCode(code) {
    return Shape.unstackCode(code)[1];
  }

  /**
   * @param {Shape} shape
   * @returns {[Shape,Shape]}
   */
  unstack(shape) {
    const [bottom, top] = unstackCode(shape.code);
    return [new Shape(bottom), new Shape(top)];
  }

  /**
   * @param {number} code
   * @returns {number}
   */
  static flipCode(code) {
    code = Shape.mirrorCode(code);
    let result = 0;
    for (let i = 0; i < 4; i++) {
      if (code == 0) break;
      result = (result << 4) | (code & 0xf);
      code >>>= 4;
    }
    return result;
  }

  /**
   * @returns {Shape}
   */
  flip() {
    return new Shape(Shape.flipCode(this.code));
  }

  /**
   * Rotate each layer 90 degrees more than layer above.
   * Example: (top to bottom)
   * 1 layer shape: 90
   * 4 layer shape: 90, 180, 270, 0 (360)
   * @param {number} code
   * @returns {number}
   */
  static screwLeftCode(code) {
    let result = 0;
    while (code > 0) {
      code = Shape.leftCode(code);
      const [bottom, top] = Shape.unstackCode(code);
      result = (result << 4) | top;
      code = bottom;
    }
    return result;
  }

  /**
   * @param {number} code
   * @returns {number}
   */
  static screwRightCode(code) {
    let result = 0;
    while (code > 0) {
      code = Shape.rightCode(code);
      const [bottom, top] = Shape.unstackCode(code);
      result = (result << 4) | top;
      code = bottom;
    }
    return result;
  }

  /**
   * @returns {Shape}
   */
  screwLeft() {
    return new Shape(Shape.screwLeftCode(this.code));
  }

  /**
   * @returns {Shape}
   */
  screwRight() {
    return new Shape(Shape.screwRightCode(this.code));
  }

  /**
   * @param {number} code
   * @returns {number}
   */
  static layerCount(code) {
    let mask = 0xf000;
    for (let num = 4; num > 0; num--) {
      if (code & mask) return num;
      mask >>>= 4;
    }
    return 0;
  }

  /**
   * Returns true if the shape contains an empty layer
   * @param {number} code
   * @returns {boolean}
   */
  static isInvalid(code) {
    if (code == 0) return true;
    for (; code > 0; code >>>= 4) {
      if ((code & 0xf) == 0) {
        return true;
      }
    }
    return false;
  }

  /**
   * @param {number} code
   * @returns {boolean}
   */
  static isPossible(code) {
    if (Shape.allShapes == undefined || Shape.allShapes.length == 0) {
      return false;
    }
    return Shape.allShapes.has(code);
  }

  /**
   * TODO: This might be simpler with bit logic.
   * @param {number} code
   * @returns {Array<number>}
   */
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
   * @param {number} code
   * @returns {boolean}
   */
  static canStackAll(code) {
    if (code == 0) return false;
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
   * @param {number} code
   * @returns {boolean}
   */
  static canStackSome(code) {
    if (code == 0) return false;
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

  /**
   * Retruns true if 1-layer shape or bottom layer is supporting the layers above.
   * TODO: would be faster with bit ops
   * @param {number} code
   * @returns {boolean}
   */
  static canStackBottom(code) {
    if (code == 0) return false;
    const top = code >>> 4;
    const bottom = code & 0x000f;
    return Shape.stackCode(top, bottom) == code;
  }

  /**
   * Remove the bottom layer
   * @param {number} code
   * @returns {number}
   */
  static dropBottomCode(code) {
    return code >>> 4;
  }

  /**
   * @param {number} code
   * @returns {boolean}
   */
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

  /**
   * pretty print
   * @param {*} value
   * @returns {String}
   */
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
      ["mirrorCode", [0x1234], 0x84c2],
      ["keyCode", [0x4321], 0x1624],
      ["leftCode", [0x0001], 0x0008],
      ["leftCode", [0x1248], 0x8124],
      ["rightCode", [0x0001], 0x0002],
      ["uturnCode", [0x0001], 0x0004],
      ["cutCode", [0x5aff], [0x48cc, 0x1233]],
      ["cutCode", [0x936c], [0x084c, 0x0132]],
      ["stackCode", [0x0000, 0x000f], 0x000f],
      ["stackCode", [0x000f, 0x000f], 0x00ff],
      ["stackCode", [0x1111, 0x2222], 0x3333],
      ["stackCode", [0xfffa, 0x5111], 0xf111],
      ["unstackCode", [0x000f], [0x0000, 0x000f]],
      ["unstackCode", [0x0234], [0x0034, 0x0002]],
      ["unstackCode", [0x1234], [0x0234, 0x0001]],
      ["flipCode", [0x0001], 0x0008],
      ["flipCode", [0x1234], 0x2c48],
      ["screwLeftCode", [0x0001], 0x0008],
      ["screwLeftCode", [0x1111], 0x8421],
      ["screwRightCode", [0x0001], 0x0002],
      ["screwRightCode", [0x1111], 0x2481],
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
      ["canStackBottom", [0xfa5f], true],
      ["canStackBottom", [0xffa5], false],
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
    const keyShapes = Shape.keyShapes;
    console.log("All shapes:", allShapes.size);
    console.log("Key shapes:", keyShapes.size);

    // Analyze each shape
    console.log("");
    console.log("Analysis...");
    for (const [code, value] of keyShapes) {
      value.layers = Shape.layerCount(code);
      value.invalid = Shape.isInvalid(code);
      value.possible = Shape.isPossible(code);
      value.cuttable = Shape.canCut(code);
      value.stackAll = Shape.canStackAll(code);
      value.stackSome = Shape.canStackSome(code);
    }

    const invalidShapes = [];
    const oneLayerStack = [];
    const complexShapes = [];
    const possibleShapes = [];
    const impossibleShapes = [];
    for (const [code, value] of keyShapes) {
      if (value.invalid) invalidShapes.push(code);
      if (value.stackAll) oneLayerStack.push(code);
      if (value.possible) possibleShapes.push(code);
      if (value.possible && !value.stackAll) complexShapes.push(code);
      if (!value.possible && !value.invalid) impossibleShapes.push(code);
    }

    // Display results
    // const NON = "-";
    // for (const [code, value] of keyShapes) {
    //   const unknown = unknownShapes.includes(code);
    //   console.log(
    //     Shape.pp(code),
    //     value.layers.toString() + (value.impossible ? "X" : NON),
    //     (value.invalid ? "I" : NON) +
    //       (value.cuttable ? "C" : NON) +
    //       (value.stackAll ? "S" : NON),
    //     unknown ? "XXXX" : ""
    //   );
    // }
    // console.log("");

    const TABLE_DATA = [
      ["Total key shapes", keyShapes.size],
      ["Possible shapes", possibleShapes.length],
      ["Standard MAM shapes", oneLayerStack.length],
      ["Advanced MAM shapes", complexShapes.length],
      ["Invalid shapes", invalidShapes.length],
      ["Impossible shapes", impossibleShapes.length],
    ];
    const WIDTH = 6;
    for (let row of TABLE_DATA) {
      console.log(row[1].toString().padStart(WIDTH, " "), row[0]);
    }
    console.log("");

    const unknownShapes = new Set(complexShapes);

    if (unknownShapes.size == 0) {
      console.log("No unknown shapes");
      return;
    }

    // Attempt to deconstruct
    let oneLayer, twoLayer, bottomLayer;

    const NUM_REPS = 0;
    for (let rep = 1; rep <= NUM_REPS; rep++) {
      console.log("Rep:", rep);

      // Remove all 1-layer shapes
      oneLayer = Array.from(unknownShapes).filter(
        (c) => Shape.layerCount(c) == 1
      );
      console.log("One layer:", oneLayer.length);
      for (let code of oneLayer) {
        unknownShapes.delete(code);
        keyShapes.delete(code);
      }

      // Remove all 2-layer shapes
      twoLayer = Array.from(unknownShapes).filter(
        (c) => Shape.layerCount(c) == 2
      );
      console.log("Two layer:", twoLayer.length);
      for (let code of twoLayer) {
        unknownShapes.delete(code);
        keyShapes.delete(code);
      }

      // Remove bottom support
      bottomLayer = Array.from(unknownShapes).filter((c) =>
        Shape.canStackBottom(c)
      );
      console.log("Bottom layer:", bottomLayer.length);
      for (let code of bottomLayer) {
        unknownShapes.delete(code);
        keyShapes.delete(code);
        const newCode = Shape.dropBottomCode(code);
        unknownShapes.add(newCode);
        keyShapes.set(newCode, { cflag: true });
      }
    }

    const shapes = Array.from(unknownShapes).sort((a, b) => a - b);
    console.log("");
    console.log("Number unknown:", shapes.length);
    let code = shapes[0];
    console.log("First unknown:", Shape.pp(code));
    console.log(Shape.toShape(code));
    console.log("");
    console.log(Shape.graph(code));

    for (let code of shapes) {
      // keyShapes.get(code).cflag = Shape.canCut(code);
      keyShapes.get(code).sflag = Shape.canStackBottom(code);
    }
    const chart = Shape.chart(shapes);
    Fileops.writeFile("data/chart.txt", chart);
  }

  /**
   * @param {Array<number>} shapes
   */
  static chart(shapes) {
    const EOL = "\n";
    const MAX_NUM = 8;

    let result = "";
    const keyShapes = Shape.keyShapes;
    const numLines = Math.floor(shapes.length / MAX_NUM) + 1;
    // for (let i = 0; i < numLines; i++) {
    //   const pos = MAX_NUM * i;
    //   const shapes = shapes.slice(pos, pos + MAX_NUM);
    //   const line = shapes.map((v) => Shape.pp(v)).join(" ");
    //   result += line;
    //   result += EOL;
    // }

    for (let i = 0; i < numLines; i++) {
      const pos = MAX_NUM * i;
      const line = shapes.slice(pos, pos + MAX_NUM);
      const head = line
        .map(
          (v) =>
            Shape.pp(v) +
            " " +
            (keyShapes.get(v).sflag ? "S" : "-") +
            (keyShapes.get(v).cflag ? "C" : "-") +
            " "
        )
        .join("   ");
      result += head;
      result += EOL;

      const graphs = line.map((v) => Shape.graph(v));
      for (let i = 0; i < 4; i++) {
        const row = graphs
          .map((v) => v.split(/\n/))
          .map((v) => v[i])
          .join("   ");
        result += row;
        result += EOL;
      }
      result += EOL;
    }
    return result;
  }

  /**
   * @param {number} code
   * @returns {string}
   */
  static graph(code) {
    const bin = code.toString(2).padStart(16, "0");
    const ICONS = ["- ", "X "];
    let result = "";
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        const pos = 4 * y + (3 - x);
        const bit = bin[pos];
        result += ICONS[bit];
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
