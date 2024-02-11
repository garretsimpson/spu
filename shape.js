/***
 * Shape handling primitives
 *
 * - A shape has 4 quadrants and 1 to 4 layers.
 * - A shape is represented internally by 32 bit integer (shape code), two bits for each possible position.
 * - shape string: A.B.C.D.:..., where ABCD are quads 1234
 * - shape code(binary): ...:DCBA:dcba
 * - two bits (Xx): 00 - gap(-), 01 - solid(O), 10 - pin(I), 11 - crystal(X)
 * - Example: bowtie (Ru--Ru--) is 05, (P---P---) is 50, (cu--cu--) is 55
 * - The order of the bits is simply the reverse order of the game's shape string (constant value).
 * - Shape piece types (C, R, S, W) and colors are currently not used.
 * - The constructor takes a 32 bit integer (shape code).
 * - Shapez1 operations: rotate (left, uturn, right), cut, stack
 * - Shapez2 operations: rotate (left, uturn, right), cut, swap, stack, unstack.
 * - Alt operations: flip, screw, stack4, ...
 */

import { Fileops } from "./fileops.js";
import { Ops } from "./ops.js";

const FULL_CIRC = "CuCuCuCu"; // 0x000F
const HALF_RECT = "RuRu----"; // 0x0003
const LOGO = "RuCw--Cw:----Ru--"; // 0x004B
const ROCKET = "CbCuCbCu:Sr------:--CrSrCr:CwCwCwCw"; // 0xFE1F

export class Shape {
  static CIRC = "C";
  static RECT = "R";
  static STAR = "S";
  static WIND = "W";
  static CRYS = "c";
  static PIN = "P-";

  static FLAT_1 = [0x1, 0x2, 0x4, 0x8];
  static FLAT_2 = [0x3, 0x5, 0x6, 0x9, 0xa, 0xc];
  static FLAT_3 = [0x7, 0xb, 0xd, 0xe];
  static FLAT_4 = [0xf];
  static FLATS = [
    ...Shape.FLAT_1,
    ...Shape.FLAT_2,
    ...Shape.FLAT_3,
    ...Shape.FLAT_4,
  ];

  static STACK_1 = [0x1, 0x2, 0x4, 0x8];
  static STACK_2 = [0x11, 0x22, 0x44, 0x88];
  static STACK_3 = [0x111, 0x222, 0x444, 0x888];
  static STACK_4 = [0x1111, 0x2222, 0x4444, 0x8888];
  static STACKS = [
    ...Shape.STACK_1,
    ...Shape.STACK_2,
    ...Shape.STACK_3,
    ...Shape.STACK_4,
  ];

  static MASKS = {
    E: [0, 0x3, 0x33, 0x333, 0x3333],
    N: [0, 0x9, 0x99, 0x999, 0x9999],
    W: [0, 0xc, 0xcc, 0xccc, 0xcccc],
    S: [0, 0x6, 0x66, 0x666, 0x6666],
  };

  static LOGO_2 = [0x81, 0x21, 0x12, 0x42, 0x24, 0x84, 0x48, 0x18];
  static LOGO_3 = [0x181, 0x121, 0x212, 0x242, 0x424, 0x484, 0x848, 0x818];
  static LOGO_4 = [
    0x8181, 0x2121, 0x1212, 0x4242, 0x2424, 0x8484, 0x4848, 0x1818,
  ];

  static LOGO_A = [
    [],
    [],
    [0x21, 0x18, 0x84, 0x42, 0x12, 0x81, 0x48, 0x24],
    [0x121, 0x818, 0x484, 0x242, 0x212, 0x181, 0x848, 0x424],
    [0x2121, 0x1818, 0x8484, 0x4242, 0x1212, 0x8181, 0x4848, 0x2424],
  ];

  // Mirrors of LOGO_A
  static LOGO_B = [
    [],
    [],
    [0x48, 0x81, 0x12, 0x24, 0x84, 0x18, 0x21, 0x42],
    [0x848, 0x181, 0x212, 0x424, 0x484, 0x818, 0x121, 0x242],
    [0x4848, 0x8181, 0x1212, 0x2424, 0x8484, 0x1818, 0x2121, 0x4242],
  ];

  // Rotate 180 of LOGO_A
  static LOGO_C = [
    [],
    [],
    [0x84, 0x42, 0x21, 0x18, 0x48, 0x24, 0x12, 0x81],
    [0x484, 0x242, 0x121, 0x818, 0x848, 0x424, 0x212, 0x181],
    [0x8484, 0x4242, 0x2121, 0x1818, 0x4848, 0x2424, 0x1212, 0x8181],
  ];

  // Reverse of LOGO_A
  static LOGO_D = [
    [],
    [],
    [0x24, 0x48, 0x81, 0x12, 0x42, 0x84, 0x18, 0x21],
    [0x424, 0x848, 0x181, 0x212, 0x242, 0x484, 0x818, 0x121],
    [0x2424, 0x4848, 0x8181, 0x1212, 0x4242, 0x8484, 0x1818, 0x2121],
  ];

  /** @type {Set<number>} */
  static allShapes;

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
  }

  static readShapeFile() {
    const FILENAME = "data/allShapes.txt";
    console.log("Reading shape file:", FILENAME);
    const data = Fileops.readFile(FILENAME);
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
   * @returns {Array<code>}
   */
  static getAllShapes() {
    return Array.from(Shape.allShapes).sort((a, b) => a - b);
  }

  /**
   * @param {number} code
   * @returns {string}
   */
  static codeToHex(code) {
    const [code1, code2] = Shape.splitCode(code);
    let result = "";
    result = code1.toString(16).padStart(4, "0");
    if (code2 != 0) {
      result = code2.toString(16).padStart(4, "0") + ":" + result;
    }
    return result;
  }

  /**
   * @param {number} code
   * @returns {Array<number>}
   */
  static splitCode(code) {
    const code1 = code & 0xffff;
    const code2 = code >>> 16;
    return [code1, code2];
  }

  /**
   * @param {number} code
   * @returns {string}
   */
  static countPieces(code) {
    return Array.from(code.toString(2)).filter((v) => v == 1).length;
  }

  /**
   * Convert shape code to a shapez constant value.
   * Uses a fixed shape for each piece and a different color for each layer.
   * @param {number} code
   * @returns {string}
   */
  static toShape(code) {
    const COLORS = ["r", "g", "b", "w"];
    const EMPTY = "--";
    const SEP = ":";

    const [code1, code2] = Shape.splitCode(code);
    const bin1 = code1.toString(2).padStart(16, "0");
    const bin2 = code2.toString(2).padStart(16, "0");
    let num, val, layer, color;
    let result = "";
    for (let i = 0; i < 16; i++) {
      num = bin2[15 - i] + bin1[15 - i];
      layer = Math.trunc(i / 4);
      color = COLORS[layer];
      switch (num) {
        case "00":
          val = EMPTY;
          break;
        case "01":
          val = Shape.RECT + color;
          break;
        case "10":
          val = Shape.PIN;
          break;
        case "11":
          val = Shape.CRYS + color;
          break;
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
    const mask = (0xf >>> rShift) * 0x11111111;
    const result =
      ((code >>> rShift) & mask) | ((code << lShift) & ~mask & 0xffffffff);
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
      result = (result << 1) | (code & 0x11111111);
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
   * Drop a part on top of a shape.
   * The part is assumed to be a single solid part that won't separate.
   * @param {number} base
   * @param {number} part
   * @returns {number}
   */
  static dropPart(base, part) {
    if (part == 0) return base;
    const [code1, code2] = Shape.splitCode(base);
    const code = code1 | code2;
    for (let offset = 4; offset > 0; offset--) {
      if (((part << ((offset - 1) * 4)) & code) != 0) {
        return base | ((part << (offset * 4)) & 0xffff);
      }
    }
    return base | part;
  }

  /**
   * Drop a pin on top of a shape.
   * @param {number} base
   * @param {number} quad
   * @returns {number}
   */
  static dropPin(base, quad) {
    const pin = 1 << quad;
    const [code1, code2] = Shape.splitCode(base);
    const code = code1 | code2;
    for (let offset = 4; offset > 0; offset--) {
      if (((pin << ((offset - 1) * 4)) & code) != 0) {
        return base | (pin << (16 + offset * 4));
      }
    }
    return base | (pin << 16);
  }

  /**
   * Remove empty layers
   * @param {number} code
   * @returns {number}
   */
  static collapseS1(code) {
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
  static cutS1Code(code) {
    const left = Shape.cutLeftS1Code(code);
    const right = Shape.cutRightS1Code(code);
    return [left, right];
  }

  /**
   * @returns {[Shape,Shape]}
   */
  cutS1() {
    const [left, right] = Shape.cutS1Code(this.code);
    return [new Shape(left), new Shape(right)];
  }

  /**
   * @param {number} code
   * @returns {number}
   */
  static cutLeftS1Code(code) {
    return Shape.collapseS1(code & 0xcccc);
  }

  /**
   * @param {number} code
   * @returns {number}
   */
  static cutRightS1Code(code) {
    return Shape.collapseS1(code & 0x3333);
  }

  static CRYSTAL_MASK = 0x00010001;
  static NEXT_SPOTS = [
    [1, 4],
    [0, 5],
    [3, 6],
    [2, 7],
    [0, 5, 8],
    [1, 4, 9],
    [2, 7, 10],
    [3, 6, 11],
    [4, 9, 12],
    [5, 8, 13],
    [6, 11, 14],
    [7, 10, 15],
    [8, 13],
    [9, 12],
    [10, 15],
    [11, 14],
  ];

  // TODO: Use spot number instead of layers and quads.

  /**
   * @param {number} shape
   * @param {Array<number>} quads
   * @returns {number}
   */
  static collapseS2(shape, quads) {
    const layers = Shape.toLayers(shape);
    // First layer remains unchanged
    let result = shape & 0x000f000f;
    let part, spot, val;
    for (let layerNum = 1; layerNum < layers.length; ++layerNum) {
      part = layers[layerNum];
      for (let quad of quads) {
        spot = 4 * layerNum + quad;
        val = (part >>> quad) & 0x11;
        if (val == 0x10) {
          // drop pin
          part &= ~(0x10 << quad);
          result = Shape.dropPin(result, quad);
        } else if (val == 0x11) {
          part &= ~(0x11 << quad);
          // break crystal, but only if it falls (gap under)
          if ((result & (Shape.CRYSTAL_MASK << (spot - 4))) == 0) continue;
          result |= Shape.CRYSTAL_MASK << spot;
        }
      }
      // check only solids remain
      if (part > 0xf) {
        console.error("Cutting error.  Non solid part found.");
        return 0;
      }
      // Drop parts
      result = Shape.dropPart(result, part);
    }
    return result;
  }

  /**
   * @param {number} shape
   * @returns {number}
   */
  static cutLeftS2Code(shape) {
    const layers = Shape.toLayers(shape);
    // Step 1: break all cut crystals
    // Check all 8 places that a crystal can span the cut
    let layer;
    const todo = [];
    for (let layerNum = 0; layerNum < layers.length; ++layerNum) {
      layer = layers[layerNum];
      if ((layer & 0x99) == 0x99) todo.push(4 * layerNum + 3);
      if ((layer & 0x66) == 0x66) todo.push(4 * layerNum + 2);
    }
    // Find all connected crystals
    let num, val;
    let found = 0;
    for (let i = 0; i < todo.length; ++i) {
      num = todo[i];
      found |= Shape.CRYSTAL_MASK << num;
      for (const spot of Shape.NEXT_SPOTS[num]) {
        if (todo.includes(spot)) continue;
        val = (shape >>> spot) & Shape.CRYSTAL_MASK;
        if (val == Shape.CRYSTAL_MASK) todo.push(spot);
      }
    }
    // Break all connected crystals
    shape &= ~found;

    // Step 2: Drop parts
    return Shape.collapseS2(shape & 0xcccccccc, [2, 3]);
  }

  /**
   * @param {number} shape
   * @returns {number}
   */
  static cutRightS2Code(shape) {
    const layers = Shape.toLayers(shape);
    // Step 1: break all cut crystals
    // Check all 8 places that a crystal can span the cut
    let layer;
    const todo = [];
    for (let layerNum = 0; layerNum < layers.length; ++layerNum) {
      layer = layers[layerNum];
      if ((layer & 0x99) == 0x99) todo.push(4 * layerNum + 0);
      if ((layer & 0x66) == 0x66) todo.push(4 * layerNum + 1);
    }
    // Find all connected crystals
    let num, val;
    let found = 0;
    for (let i = 0; i < todo.length; ++i) {
      num = todo[i];
      found |= Shape.CRYSTAL_MASK << num;
      for (const spot of Shape.NEXT_SPOTS[num]) {
        if (todo.includes(spot)) continue;
        val = (shape >>> spot) & Shape.CRYSTAL_MASK;
        if (val == Shape.CRYSTAL_MASK) todo.push(spot);
      }
    }
    // Break all connected crystals
    shape &= ~found;

    // Step 2: Drop parts
    return Shape.collapseS2(shape & 0x33333333, [0, 1]);
  }

  /**
   * @param {number} code
   * @returns {number}
   */
  static cutS2Code(shape) {
    const left = Shape.cutLeftS2Code(shape);
    const right = Shape.cutRightS2Code(shape);
    return [left, right];
  }

  /**
   * @param {number} top
   * @param {number} bottom
   * @returns {number}
   */
  static stackS1Code(top, bottom) {
    for (let offset = 4; offset > 0; offset--) {
      if (((top << ((offset - 1) * 4)) & bottom) != 0) {
        return ((top << (offset * 4)) | bottom) & 0xffff;
      }
    }
    return top | bottom;
  }

  /**
   * @param {number} top
   * @param {number} bottom
   * @returns {number}
   */
  static stackS2Code(top, bottom) {
    let val;
    const layers = Shape.toLayers(top);
    for (let part of layers) {
      for (let quad of [0, 1, 2, 3]) {
        val = (part >>> quad) & 0x11;
        if (val == 0x10) {
          // drop pin
          part &= ~(0x10 << quad);
          bottom = Shape.dropPin(bottom, quad);
        } else if (val == 0x11) {
          // break crystal
          part &= ~(0x11 << quad);
        }
      }
      // check only solids remain
      if (part > 0xf) {
        console.error("Stacking error.  Non solid part found.");
        return 0;
      }
      // drop parts
      if (part == 0x5) {
        bottom = Shape.dropPart(bottom, 0x1);
        bottom = Shape.dropPart(bottom, 0x4);
      } else if (part == 0xa) {
        bottom = Shape.dropPart(bottom, 0x2);
        bottom = Shape.dropPart(bottom, 0x8);
      } else {
        bottom = Shape.dropPart(bottom, part);
      }
    }
    return bottom;
  }

  /**
   * Return bottom code if stack would cause trash.
   * @param {number} top
   * @param {number} bottom
   * @returns {number}
   */
  static stack4Code(top, bottom) {
    for (let offset = 4; offset > 0; offset--) {
      if (((top << ((offset - 1) * 4)) & bottom) != 0) {
        const result = (top << (offset * 4)) | bottom;
        if (result > 0xffff) return bottom;
        return result & 0xffff;
      }
    }
    return top | bottom;
  }

  /**
   * @param {Shape} shape
   * @returns {Shape}
   */
  stackS1(shape) {
    const top = shape.code;
    const bottom = this.code;
    const result = Shape.stackS1Code(top, bottom);
    return new Shape(result);
  }

  /**
   * Return the number trashed pieces cause by stack.
   * @param {number} top
   * @param {number} bottom
   * @returns {number}
   */
  static stackTrash(top, bottom) {
    const code = Shape.stackS1Code(top, bottom);
    let result = 0;
    result += Shape.countPieces(top);
    result += Shape.countPieces(bottom);
    result -= Shape.countPieces(code);
    return result;
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
    let mask = 0xf0000;
    for (let num = 5; num > 0; num--) {
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
      if ((code & 0xf) == 0) return true;
    }
    return false;
  }

  /**
   * @param {number} code
   * @returns {boolean}
   */
  static isPossible(code) {
    const shapes = Shape.allShapes;
    return shapes && shapes.has(code);
  }

  /**
   * TODO: This might be simpler with bit logic.
   * @param {number} code
   * @returns {Array<number>}
   */
  static toLayersOld(code) {
    const result = [];
    while (code > 0) {
      const [bottom, top] = Shape.unstackCode(code);
      result.push(top);
      code = bottom;
    }
    return result;
  }

  /**
   * Returns an array of shapes, layers from bottom to top
   * @param {number} code
   * @returns {Array<number>}
   */
  static toLayers(code) {
    let result = [];
    let [code1, code2] = Shape.splitCode(code);
    let value;
    for (let i = 0; i < 4; ++i) {
      if ((code1 | code2) == 0) break;
      value = ((code2 & 0xf) << 4) | (code1 & 0xf);
      result.push(value);
      code1 >>>= 4;
      code2 >>>= 4;
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
      const top = layers[i];
      result = Shape.stackS1Code(top, result);
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
      const result = Shape.stackS1Code(top, bottom);
      if (result == code) return true;
    }
    return false;
  }

  /**
   * Retruns true if 1-layer shape or bottom layer is supporting the layers above.
   * @param {number} code
   * @returns {boolean}
   */
  static canStackBottom(code) {
    if (code == 0) return false;
    const above = (code & 0x00f0) >>> 4;
    if (above == 0) return true;
    const bottom = code & 0x000f;
    return (above & bottom) != 0;
  }

  /**
   * Retruns true if layer is supported.
   * @param {number} code
   * @returns {boolean}
   */
  static canStackLayer(code, layer) {
    if (code == 0) return false;
    if (layer <= 0) return true;
    const mask = 0xf << (4 * layer);
    const above = code & mask;
    if (above == 0) return true;
    const below = (code << 4) & mask;
    return (above & below) != 0;
  }

  /**
   * Retruns true if layer is supported.
   * @param {number} code
   * @returns {boolean}
   */
  static canStackLayerOtherHalf(code, logo, layer) {
    if (code == 0) return false;
    if (layer <= 0) return true;
    const layers = Shape.toLayers(logo);
    if (layers.length < 2) return 0;
    const mask = Shape.rotateCode(layers[0] | layers[1], 2) << (4 * layer);
    const above = code & mask;
    if (above == 0) return true;
    const below = (code << 4) & mask;
    return (above & below) != 0;
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
    let [left, right] = Shape.cutS1Code(code);
    if (Shape.stackS1Code(left, right) == code) {
      return true;
    }
    // try cutting horizontally
    code = Shape.rightCode(code);
    let [bottom, top] = Shape.cutS1Code(code);
    if (Shape.stackS1Code(bottom, top) == code) {
      return true;
    }
    return false;
  }

  /**
   * Has "hat"
   * Find the top layer of value.  Return true if there is a piece above it.
   * Note: Assuming this is only used for half-logos.
   * @param {number} code
   * @param {number} value
   * @returns {boolean}
   */
  static supportACode(code, value) {
    const num = Shape.layerCount(value);
    const maskA = value & (0xf << (4 * (num - 1)));
    return (code & (maskA << 4)) != 0;
  }

  /**
   * Has "chip" on shoulder, something in the "seat"
   * Find the next to top layer of value.  Return true if there is a piece above it.
   * Note: Assuming this is only used for half-logos.
   * @param {number} code
   * @param {number} value
   * @returns {boolean}
   */
  static supportBCode(code, value) {
    const num = Shape.layerCount(value);
    const maskB = value & (0xf << (4 * (num - 2)));
    return (code & (maskB << 4)) != 0;
  }

  /**
   * @param {number} code
   * @param {number} mask
   * @param {number} value
   * @returns {number}
   */
  static containsCode(code, mask, value) {
    return (code & mask) == value;
  }

  /**
   * @param {number} code
   * @param {number} value
   * @returns {number}
   */
  static removeCode(code, value) {
    return code & ~value;
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
      ["codeToHex", [0x004b], "004b"],
      ["codeToHex", [0x1234004b], "1234:004b"],
      ["toShape", [0x004b], "RrRr--Rr:----Rg--:--------:--------"],
      ["toShape", [0x00fd0f0f], "crRrcrcr:P-P-P-P-:RbRbRbRb:--------"],
      ["countPieces", [0x0], 0],
      ["countPieces", [0xf], 4],
      ["countPieces", [0xffff], 16],
      ["mirrorCode", [0x1234], 0x84c2],
      ["mirrorCode", [0x12345678], 0x84c2a6e1],
      ["keyCode", [0x4321], 0x1624],
      ["keyCode", [0x87654321], 0x87351624],
      ["leftCode", [0x0001], 0x0008],
      ["leftCode", [0x1248], 0x8124],
      ["leftCode", [0x0001001e], 0x00080087],
      ["rightCode", [0x0001], 0x0002],
      ["uturnCode", [0x0001], 0x0004],
      ["cutS1Code", [0x5aff], [0x48cc, 0x1233]],
      ["cutS1Code", [0x936c], [0x084c, 0x0132]],
      ["cutS2Code", [0x936c], [0x00cc, 0x0132]],
      ["cutS2Code", [0x000f0000], [0x000c0000, 0x00030000]],
      ["cutS2Code", [0x000f000f], [0x0000, 0x0000]],
      ["cutS2Code", [0xe8c4f8c4], [0x0000, 0x0001]],
      ["cutS2Code", [0x00500073], [0x0000, 0x00100033]],
      ["stackS1Code", [0x0000, 0x000f], 0x000f],
      ["stackS1Code", [0x000f, 0x0000], 0x000f],
      ["stackS1Code", [0x000f, 0x000f], 0x00ff],
      ["stackS1Code", [0x1111, 0x2222], 0x3333],
      ["stackS1Code", [0xfffa, 0x5111], 0xf111],
      ["stackS2Code", [0xfffa, 0x5111], 0x511b],
      ["stackS2Code", [0x000f, 0x00010000], 0x000100f0],
      ["stackS2Code", [0x000f0000, 0x08ce], 0x842108ce],
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
      ["toLayers", [0x0001], [0x1]],
      ["toLayers", [0x0120], [0x0, 0x2, 0x1]],
      ["toLayers", [0xabcd], [0xd, 0xc, 0xb, 0xa]],
      ["toLayers", [0x12345678], [0x48, 0x37, 0x26, 0x15]],
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
      ["canStackLayer", [0x000f, 1], true],
      ["canStackLayer", [0xfa5f, 1], true],
      ["canStackLayer", [0xffa5, 1], false],
      ["canCut", [0x0012], true],
      ["canCut", [0x00f1], false],
      ["canCut", [0x00ff], true],
      ["supportACode", [0x0521, 0x0021], false],
      ["supportACode", [0x0f21, 0x0021], true],
      ["supportACode", [0x0361, 0x0121], false],
      ["supportBCode", [0x0521, 0x0021], false],
      ["supportBCode", [0x0f21, 0x0021], false],
      ["supportBCode", [0x0361, 0x0121], true],
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
    Shape.init();

    console.log("Analysis...");
    const shapes = new Map();
    let value;
    for (let code = 0; code <= 0xffff; code++) {
      value = {};
      value.layers = Shape.layerCount(code);
      value.invalid = Shape.isInvalid(code);
      value.possible = Shape.isPossible(code);
      value.cuttable = Shape.canCut(code);
      value.stackAll = Shape.canStackAll(code);
      value.stackSome = Shape.canStackSome(code);
      shapes.set(code, value);
    }

    const invalidShapes = [];
    const oneLayerStack = [];
    const complexShapes = [];
    const possibleShapes = [];
    const impossibleShapes = [];
    for (const [code, value] of shapes) {
      if (value.invalid) invalidShapes.push(code);
      if (value.stackAll) oneLayerStack.push(code);
      if (value.possible) possibleShapes.push(code);
      if (value.possible && !value.stackAll) complexShapes.push(code);
      if (!value.possible && !value.invalid) impossibleShapes.push(code);
    }
    const keyShapes = possibleShapes.filter(
      (code) => Shape.keyCode(code) == code
    );

    const layerCounts = [0, 0, 0, 0, 0];
    for (const code of possibleShapes) {
      let num = Shape.layerCount(code);
      layerCounts[num]++;
    }

    const pieceCounts = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (const code of possibleShapes) {
      let num = Shape.countPieces(code);
      pieceCounts[num]++;
    }

    const TABLE_DATA = [
      ["Possible shapes", possibleShapes.length],
      ["Standard MAM shapes", oneLayerStack.length],
      ["Advanced MAM shapes", complexShapes.length],
      ["Invalid shapes", invalidShapes.length],
      ["Impossible shapes", impossibleShapes.length],
      ["Key shapes", keyShapes.length],
      ["1 layer", layerCounts[1]],
      ["2 layer", layerCounts[2]],
      ["3 layer", layerCounts[3]],
      ["4 layer", layerCounts[4]],
    ];
    const WIDTH = 6;
    for (let [name, value] of TABLE_DATA) {
      value = value.toString().padStart(WIDTH, " ");
      console.log(value, name);
    }
    console.log("");

    // All unique complex shapes with exactly 4 corners
    const foundShapes = keyShapes.filter(
      (code) => complexShapes.includes(code) && Shape.countPieces(code) == 4
    );

    console.log("Number of found shapes", foundShapes.length);

    Ops.saveChart(foundShapes);
  }

  /**
   * @param {Array<number>} shapes
   * @param {Array<any>} parts
   * @param {Array<any>} offsets
   * @returns {string}
   */
  static chart(shapes, parts, offsets) {
    const EOL = "\n";
    const SEP = "  ";
    const MAX_NUM = 8;

    let result = "";
    // const codes = shapes.slice().sort((a, b) => a - b);
    const codes = shapes.slice();
    const numLines = Math.floor(codes.length / MAX_NUM) + 1;

    for (let i = 0; i < numLines; i++) {
      const pos = MAX_NUM * i;
      const line = codes
        .slice(pos, pos + MAX_NUM)
        .map((code) => Shape.splitCode(code));
      // result += line.map((v) => Shape.pp(v[1]) + "    ").join(SEP) + EOL;
      // result += line.map((v) => Shape.pp(v[0]) + "    ").join(SEP) + EOL;

      // TODO: Need a way to tell difference between S1 shape w/5th layer and a S2 shape.  Both are > 0xffff.
      let graphs;
      if (!parts) {
        graphs = line.map((v) => Shape.graphS2(v[0], v[1]));
      } else {
        graphs = line.map((v) => Shape.graphParts(parts[v[0]], offsets[v[0]]));
      }
      for (let i = 0; i < 5; i++) {
        const row = graphs
          .map((v) => v.split(/\n/))
          .map((v) => v[i])
          .join(SEP);
        result += row;
        result += EOL;
      }
      result += EOL;
    }
    return result;
  }

  /**
   * Graph a Shapez 1 shape
   * @param {number} code - 20 bit value (5 layers)
   * @returns {string}
   */
  static graphS1(code) {
    const EOL = "\n";
    const bin = code.toString(2).padStart(20, "0");
    const ICONS = ["- ", "O "];
    let pos, bit;
    let result = "";
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 4; x++) {
        pos = 4 * y + (3 - x);
        bit = bin[pos];
        result += ICONS[bit];
      }
      result += EOL;
    }
    return result;
  }

  /**
   * Graph a Shapez 2 shape
   * @param {number} code1 - 16 bit value - 4 layer S1 shape code
   * @param {number} code2 - 32 bit value - 4 layer S2 shape code
   * @returns {string}
   */
  static graphS2(code1, code2) {
    const EOL = "\n";
    const ICONS = { "00": "- ", "01": "O ", 10: "I ", 11: "X " };
    const hex1 = code1.toString(16).padStart(4, "0");
    const hex2 = code2.toString(16).padStart(4, "0");
    const bin1 = code1.toString(2).padStart(16, "0");
    const bin2 = code2.toString(2).padStart(16, "0");
    let pos, bit;
    let result = "";
    for (let y = 0; y < 4; y++) {
      result += hex2[y] + hex1[y] + " ";
      for (let x = 0; x < 4; x++) {
        pos = 4 * y + (3 - x);
        bit = bin2[pos] + bin1[pos];
        result += ICONS[bit];
      }
      result += EOL;
    }
    return result;
  }

  /**
   * @param {Array<number>} parts - array of shape codes
   * @param {Array<number>} offsets - array of layer nums where part was found
   * @returns {string}
   */
  static graphParts(parts, offsets) {
    const ROWS = 5;
    const COLS = 4;
    const CHARS = "ABCDEF";
    const EMPTY = "-";
    let part, offset;
    let bin, pos, bit, row;
    let data = [];
    for (let i = 0; i < parts.length; i++) {
      part = parts[i];
      offset = offsets[i];
      // offset = offset - Shape.layerCount(part) + 1; // top of part
      bin = (part << (offset * 4)).toString(2).padStart(ROWS * COLS, "0");
      for (let y = 0; y < ROWS; y++) {
        row = data[y] || [];
        for (let x = 0; x < COLS; x++) {
          pos = 4 * y + (3 - x);
          bit = bin[pos];
          if (bit == "1") row[x] = CHARS[i];
        }
        data[y] = row;
      }
    }
    let result = "";
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        result += data[y][x] || EMPTY;
        result += " ";
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

  static countParts() {
    Shape.init();

    let counts = {};
    let num, val;
    for (const shape of Shape.allShapes) {
      if (shape !== Shape.keyCode(shape)) continue;
      num = Shape.countPieces(shape);
      val = counts[num] | 0;
      counts[num] = val + 1;
    }

    // console.log(counts);

    let total = 0;
    for (const num of Object.keys(counts).sort((a, b) => a - b)) {
      val = counts[num];
      console.log(
        num.toString().padStart(2, " "),
        val.toString().padStart(6, " ")
      );
      total += val;
    }
    console.log("total:", total);
  }

  static testChart() {
    const shapes = [
      0x0001, 0x0c63, 0x0001001e, 0x08ce8421, 0x00fd0f0f, 0x639cffff,
    ];
    Ops.saveChart(shapes);
  }
}
