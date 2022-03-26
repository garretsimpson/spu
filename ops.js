/**
 * Find new shapes by performing all possible transformations on a shape.
 *
 * Two types of transforms / operations
 * 1> Input one shape and perform all possible transforms (left, uturn, right, cut-left, cut-right).
 * 2> Input two shapes and perform stack.  Need to try all combinations of two shapes.
 * - As new shapes are found, they need to be tried with #1 and #2.
 * - Avoid repeating work: For each shape, need to track if it has been used in a transformation.
 * - Store output shape (key), input shape(s), transform function.
 *
 * - Phase two, find build plan / transformation sequence for a target shape.
 * - Example
 *   - Target is Logo.
 *   - Logo can be constructed using stack(xxxx, yyyy).
 *   - xxxx can be constructed using ..., etc.
 *   - Build tree can be constructed recursively.
 * - Issues
 *   - How big is complete shape construction database?
 *   - If need to do partial search, then when to stop?
 *
 * Design
 * - Initial shape: 1 full layer (4 pieces).
 * - Store initial shape.
 * - For each new shape:
 *   - Perform all possible 1 input transforms.
 *   - Output is a list of transform operations and the resulting shapes.
 *   - Flag input shape as used / transformed.
 *   - Store (new ways to build) output shapes.
 * - If no new shapes, then done.  Else...
 * - For each new shape:
 *   - Perform stack with all other shapes.
 *   - Store (new ways to build) output shapes.
 * - Repeat
 *
 * Format of transform results: {code, cost, op, code1, code2}
 *
 */

import { Shape } from "./shape.js";
import { appendFileSync, readFileSync, writeFileSync, rmSync } from "fs";

const FULL_SHAPES = [0xf];
const FLAT_SHAPES = [
  0x1, 0x2, 0x3, 0x4, 0x5, 0x6, 0x7, 0x8, 0x9, 0xa, 0xb, 0xc, 0xd, 0xe, 0xf,
];
const LOGO1_SHAPES = [0x1, 0x2, 0x4, 0x8];
const LOGO2_SHAPES = [0x12, 0x24, 0x48, 0x81, 0x18, 0x21, 0x42, 0x84];
const LOGO3_SHAPES = [0x121, 0x242, 0x484, 0x818, 0x181, 0x212, 0x424, 0x848];
const LOGO4_SHAPES = [
  0x1212, 0x2424, 0x4848, 0x8181, 0x1818, 0x2121, 0x4242, 0x8484,
];
const LOGO_SHAPES = [...LOGO2_SHAPES, ...LOGO3_SHAPES, ...LOGO4_SHAPES];

const EOL = "\n";
const WIDTH = 8; // Column width

const DB_FILE_NAME = "data/db.bin";
const OPS_FILE_NAME = "data/ops.txt";
const TEXT_FILE_NAME = "data/text.txt";
const BUILDS_FILE_NAME = "data/builds.txt";

/**
 * @typedef ShapeDef
 * @type {object}
 * @property {string} op
 * @property {number} cost
 * @property {number} logo
 * @property {number} code
 * @property {number} code1
 * @property {number} code2
 */

/** @type {Array<Array<ShapeDef>>} */
const newShapes = []; // a[cost][]
/** @type {Array<ShapeDef>} */
const allShapes = []; // a[code]

const OPS = {
  prim: "prim",
  left: "left",
  uturn: "uturn",
  right: "right",
  cutLeft: "cutLeft",
  cutRight: "cutRight",
  stack: "stack",
  unstackBottom: "unstackBottom",
  unstackTop: "unstackTop",
  screwLeft: "screwLeft",
  screwRight: "screwRight",
  flip: "flip",
};

const OPS_COST = {
  prim: 0,
  left: 1,
  uturn: 1,
  right: 1,
  cutLeft: 1,
  cutRight: 1,
  stack: 1,
};

const ONE_OPS = [OPS.left, OPS.uturn, OPS.right, OPS.cutLeft, OPS.cutRight];
const TWO_OPS = [OPS.stack];

export class Ops {
  static logTable(...values) {
    console.log(...values.map((v) => v.toString().padStart(WIDTH)));
  }

  /**
   * Do one input transforms
   * @param {ShapeDef} shape1
   * @returns {Array<ShapeDef>}
   */
  static doOneOps(shape1) {
    const results = [];
    const code1 = shape1.code;
    let cost = shape1.cost;
    for (let op of ONE_OPS) {
      const newCode = Shape[op + "Code"](code1);
      // Skip NOPs
      if (code1 == newCode) continue;
      const result = {
        code: newCode,
        cost: cost + OPS_COST[op],
        op,
        code1,
        logo: shape1.logo,
      };
      results.push(result);
    }
    return results;
  }

  /**
   * Do two input transforms
   * @param {ShapeDef} shape1
   * @param {ShapeDef} shape2
   * @returns {Array<ShapeDef>}
   */
  static doTwoOps(shape1, shape2) {
    const results = [];
    const code1 = shape1.code;
    const code2 = shape2.code;
    const cost = shape1.cost + shape2.cost;
    let newCode, result;
    for (let op of TWO_OPS) {
      newCode = Shape[op + "Code"](code1, code2);
      // Skip NOPs
      if (code1 == newCode || code2 == newCode) continue;
      result = {
        code: newCode,
        cost: cost + OPS_COST[op],
        op,
        code1,
        code2,
        logo: shape1.logo + shape2.logo,
      };
      results.push(result);
    }
    return results;
  }

  /**
   * @param {ShapeDef} newShape
   * @returns {[ShapeDef, ShapeDef]}
   *
   * Returns [newShape, oldShape]:
   * - newShape - if shape is new or costs less.
   * - oldShape - if old shape costs more.
   */
  static updateAllShapes(newShape) {
    let result = [null, null];
    const code = newShape.code;
    // Do not store empty shapes
    if (code === 0) return result;

    const oldShape = allShapes[code];
    if (oldShape === undefined) {
      allShapes[code] = newShape;
      newShape.alt = 1;
      result = [newShape, null];
      return result;
    }

    if (newShape.cost < oldShape.cost) {
      console.debug("#### Lower cost found ####");
      allShapes[code] = newShape;
      newShape.alt = 1;
      result = [newShape, oldShape];
      return result;
    }

    if (newShape.cost === oldShape.cost) {
      // console.debug("#### Same cost found ####");
      oldShape.alt++;
      return result;
    }

    return result;
  }

  /**
   * Given a list of transform results:
   * - update allShapes.
   * - update newShapes.
   * @param {Array<ShapeDef>} shapes Array of transform results
   */
  static saveShapes(shapes) {
    let newShape, oldShape;
    for (let shape of shapes) {
      [newShape, oldShape] = Ops.updateAllShapes(shape);
      // Remove old shape
      if (oldShape) {
        const entry = newShapes[oldShape.cost];
        const idx = entry.findIndex((s) => s.code === oldShape.code);
        if (idx === -1) {
          console.error("#### Old shape not found");
        } else {
          entry.splice(idx, 1);
        }
      }
      // Insert new shape
      if (newShape) {
        const cost = newShape.cost;
        const entry = newShapes[cost];
        if (entry === undefined) {
          newShapes[cost] = [newShape];
        } else {
          // Prioritize non-logo shapes
          if (newShape.logo === 0) {
            entry.unshift(newShape);
          } else {
            entry.push(newShape);
          }
        }
      }
    }
  }

  static runOps() {
    // const START_SHAPES = FULL_SHAPES;
    // const START_SHAPES = [...FLAT_SHAPES, ...LOGO_SHAPES];
    const MAX_ITERS = 10000;
    const MAX_LEVEL = 4;
    let iters = 0;

    Ops.logTable("Iters", "Level", "Total", "ToDo");

    Ops.saveShapes(
      FLAT_SHAPES.map((code) => {
        return { code, cost: OPS_COST[OPS.prim], op: OPS.prim, logo: 0 };
      })
    );

    Ops.saveShapes(
      LOGO_SHAPES.map((code) => {
        return { code, cost: OPS_COST[OPS.prim], op: OPS.prim, logo: 1 };
      })
    );

    const seenShapes = [];
    // Note: Search by increasing cost level to avoid reducing the cost of a found shape.
    // Note: When a shape is used for searching, it should have the lowest cost possible.
    for (let level = 0; level < newShapes.length; level++) {
      const shapes = newShapes[level];
      if (shapes === undefined) continue;
      while (shapes.length > 0) {
        iters++;
        if (iters % 100 == 0) {
          const total = Object.keys(allShapes).length;
          Ops.logTable(iters, level, total, shapes.length);
        }
        if (iters > MAX_ITERS) break;
        // if (level > MAX_LEVEL) break;

        const shape = shapes.shift();
        seenShapes.push(shape);

        // do one input operations
        // Ops.saveShapes(Ops.doOneOps(shape));

        // do two input operations
        for (const other of seenShapes) {
          Ops.saveShapes(Ops.doTwoOps(shape, other));
          if (other.code === shape.code) continue;
          Ops.saveShapes(Ops.doTwoOps(other, shape));
        }
      }
    }
    console.log("");

    console.log("Remaining shapes:");
    const levels = Object.keys(newShapes);
    for (let level of levels) {
      console.log(level, newShapes[level].length);
    }
    console.log("");

    console.log("Stats");
    console.log("ToDo: ", newShapes.flat().length);
    console.log("Total:", Object.keys(allShapes).length);
    console.log("");

    // Ops.displayShapes();
    // Ops.normalize();

    Ops.saveAllShapes();
    Ops.saveAllBuilds();
    Ops.saveDB();

    for (let code = 0x1; code <= 0xf; code++) {
      Ops.findShape(code);
    }
    Ops.findShape(0xffff);
    Ops.findShape(0x12);
    Ops.findShape(0x121);
    Ops.findShape(0x1212);
    Ops.findShape(0x4b); // Logo
    Ops.findShape(0xfe1f); // Rocket

    console.log("Rocket:", Ops.getBuildStr(0xfe1f));
  }

  /**
   * @param {ShapeDef} shape
   * @returns {string}
   */
  static shapeToString(shape) {
    if (!shape) return "";
    const result = [
      Shape.pp(shape.code),
      // shape.cost.toString().padStart(2),
      shape.op.padEnd(WIDTH, " "),
      shape.code1 === undefined ? "    " : Shape.pp(shape.code1),
      shape.code2 === undefined ? "    " : Shape.pp(shape.code2),
      `(${shape.alt},${shape.logo})`,
    ];
    return result.join(" ");
  }

  /**
   * @param {number} code
   * @param {number} [i=0]
   */
  static findShape(code, i = 0) {
    const shape = allShapes[code];
    if (shape === undefined) {
      console.log("Shape not found:", Shape.pp(code));
      return;
    }
    console.log("  ".repeat(i++) + Ops.shapeToString(shape));
    shape.code1 !== undefined && Ops.findShape(shape.code1, i);
    shape.code2 !== undefined && Ops.findShape(shape.code2, i);
  }

  static OP_CODE = {
    prim: "P ",
    left: "RL",
    uturn: "R2",
    right: "RR",
    cutLeft: "CL",
    cutRight: "CR",
    stack: "ST",
  };

  /**
   * @param {number} code
   * @returns {string}
   */
  static getBuildStr(code) {
    const shape = allShapes[code];
    if (shape === undefined) return "";
    const op = shape.op;
    if (op === OPS.prim) return Shape.pp(code);
    let result = "";
    result += Shape.pp(code);
    result += " ";
    result += Ops.OP_CODE[op];
    result += "(";
    if (shape.code1) result += Ops.getBuildStr(shape.code1);
    if (shape.code2) result += " " + Ops.getBuildStr(shape.code2);
    result += ")";
    return result;
  }

  static normalize() {
    const normals = new Map();
    for (const code of allShapes.keys()) {
      const key = Shape.keyCode(code);
      let codes = normals.get(key);
      if (codes == undefined) {
        codes = [];
        normals.set(key, codes);
      }
      codes.push(code);
    }

    console.log("Shapes");
    for (let code = 0; code <= 0xffff; code++) {
      const key = Shape.keyCode(code);
      if (key != code) continue;
      let result;
      if (normals.has(key)) {
        result = normals
          .get(key)
          .sort((a, b) => a - b)
          .map((v) => Shape.pp(v))
          .join();
      } else {
        result = "xxxx";
      }
      console.log(Shape.pp(key), result);
    }
  }

  /**
   * @param {string} filename
   * @returns {Uint8Array}
   */
  static readFile(filename) {
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
      rmSync(OPS_FILE_NAME, { force: true });
    } catch (err) {
      console.error(err);
      return false;
    }
    return true;
  }

  static saveAllShapes() {
    const codes = Object.keys(allShapes);
    const data = codes
      .map((code) => Ops.shapeToString(allShapes[code]))
      .join(EOL);
    Ops.writeFile(OPS_FILE_NAME, data);
  }

  static displayShapes() {
    console.log("Shapes");
    const codes = Array.from(allShapes.keys()).sort((a, b) => a - b);
    for (let code of codes) {
      Ops.displayShape(allShapes.get(code));
    }
  }

  static saveAllBuilds() {
    const codes = Object.keys(allShapes)
      .map((v) => Number(v))
      .filter((code) => code === Shape.keyCode(code));
    const data = codes.map((code) => Ops.getBuildStr(code)).join(EOL);
    Ops.writeFile(BUILDS_FILE_NAME, data);
  }

  // { NONE=0, RAW=1, STACK=2, CUT_LEFT=3, CUT_RIGHT=4, ROTATE_1=5, ROTATE_2=6, ROTATE_3=7 };
  static OP_ENUM = {
    none: 0,
    prim: 1,
    stack: 2,
    cutLeft: 3,
    cutRight: 4,
    right: 5,
    uturn: 6,
    left: 7,
  };

  /**
   * save database file - used by solutions viewer
   * The database has 2^16 entries, one for each shape code.
   * The entries are 5 bytes: <code1><code2><op>
   */
  static saveDB() {
    try {
      rmSync(DB_FILE_NAME, { force: true });
    } catch (err) {
      console.error(err);
      return;
    }
    // Init data
    const size = 5 * (1 << 16);
    const data = new Uint8Array(size);
    // Set entries
    let entry, pos;
    for (let code = 0; code <= 0xffff; code++) {
      entry = allShapes[code];
      if (entry === undefined) continue;
      const op = entry.op;
      // The viewer swaps stack codes
      const code1 = op === OPS.stack ? entry.code2 : entry.code1;
      const code2 = op === OPS.stack ? entry.code1 : entry.code2;
      pos = 5 * code;
      data[pos++] = code1 & 0xff;
      data[pos++] = code1 >>> 8;
      data[pos++] = code2 & 0xff;
      data[pos++] = code2 >>> 8;
      data[pos++] = Ops.OP_ENUM[op];
    }
    // Write file
    Ops.appendFile(DB_FILE_NAME, data);
  }

  static dbToText() {
    const data = Ops.readFile(DB_FILE_NAME);
    if (!data) return;

    const opName = [];
    for (let name of Object.keys(Ops.OP_ENUM)) {
      opName[Ops.OP_ENUM[name]] = name;
    }

    const result = [];
    let pos, line;
    for (let code = 0; code <= 0xffff; code++) {
      pos = 5 * code;
      const code1 = data[pos++] | (data[pos++] << 8);
      const code2 = data[pos++] | (data[pos++] << 8);
      const op = data[pos++];
      if (op === 0) continue;
      line = [
        Shape.pp(code),
        Ops.OP_CODE[opName[op]],
        Shape.pp(code1),
        Shape.pp(code2),
      ].join(" ");
      result.push(line);
    }
    Ops.writeFile(TEXT_FILE_NAME, result.join(EOL));
  }
}
