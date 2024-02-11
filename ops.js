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
import { Fileops } from "./fileops.js";

const EOL = "\n";

const DB_FILE_NAME = "data/db.bin";
const OPS_FILE_NAME = "data/ops.txt";
const KEYS_FILE_NAME = "data/keys.txt";
const TEXT_FILE_NAME = "data/text.txt";
const BUILDS_FILE_NAME = "data/builds.txt";

/**
 * @typedef ShapeDef
 * @type {object}
 * @property {string} op
 * @property {number} alt Number of alternates for the same shape.
 * @property {number} cost
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
  cutLeft: "cutLeftS1",
  cutRight: "cutRightS1",
  stack: "stackS1",
  unstackBottom: "unstackBottom",
  unstackTop: "unstackTop",
  screwLeft: "screwLeft",
  screwRight: "screwRight",
  mirror: "mirror",
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
    const WIDTH = 8; // Column width
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
    const cost = shape1.cost;
    let newCode, result;
    for (let op of ONE_OPS) {
      newCode = Shape[op + "Code"](code1);
      // Skip NOPs
      if (code1 == newCode) continue;
      result = {
        code: newCode,
        op,
        cost: cost + (OPS_COST[op] || 0),
        code1,
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
    const cost = shape1.cost + shape2.cost;
    const code1 = shape1.code;
    const code2 = shape2.code;
    let newCode, result;
    for (let op of TWO_OPS) {
      newCode = Shape[op + "Code"](code1, code2);
      // Skip NOPs
      if (code1 == newCode || code2 == newCode) continue;
      result = {
        code: newCode,
        op,
        cost: cost + (OPS_COST[op] || 0),
        code1,
        code2,
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

    const lowerCost = newShape.cost < oldShape.cost;
    if (lowerCost) {
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
      Ops.updateNewShapes(newShape, oldShape);
    }
  }

  /**
   * @param {ShapeDef} newShape
   * @param {ShapeDef} oldShape
   */
  static updateNewShapes(newShape, oldShape) {
    // Remove old shape
    if (oldShape) {
      const entry = newShapes[oldShape.cost];
      const idx = entry.findIndex((s) => s.code === oldShape.code);
      if (idx !== -1) {
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
        entry.push(newShape);
      }
    }
  }

  static clearNewShapes() {
    const levels = Object.keys(newShapes);
    for (let level of levels) {
      newShapes[level].length = 0;
    }
  }

  static runMultiOps() {
    const CONFIGS_TEST = [
      {
        name: "1-flats",
        shapes: Shape.FLAT_1,
        maxIter: 5000,
      },
      // {
      //   name: "2-float",
      //   shapes: Shape.LOGO_2,
      //   cost: 1,
      //   // maxIter: 4000,
      // },
    ];

    const CONFIGS_123 = [
      {
        name: "1-flats",
        shapes: Shape.FLATS,
        maxIter: 500,
      },
      {
        name: "2-float",
        shapes: Shape.LOGO_2,
        cost: 1,
        maxIter: 4000,
      },
      {
        name: "3-float",
        shapes: Shape.LOGO_3,
        cost: 2,
        maxIter: 2500,
      },
      {
        name: "4-float",
        shapes: Shape.LOGO_4,
        cost: 3,
      },
    ];

    const CONFIGS_TRASHLESS = [
      {
        name: "1-flats",
        shapes: Shape.FLAT_1,
        maxIter: 5000,
      },
      {
        name: "2-float",
        shapes: Shape.LOGO_2,
        cost: 2,
        // maxIter: 4000,
      },
      {
        name: "2-stack",
        shapes: Shape.STACK_2,
        // maxIter: 4000,
      },
    ];

    const results = {};
    let shapes;
    for (let config of CONFIGS_TEST) {
      shapes = config.shapes.map((code) => {
        return {
          code,
          op: OPS.prim,
          cost: config.cost || 0,
        };
      });
      Ops.runOps(shapes, config.maxIter);

      shapes = Object.keys(allShapes);
      const keys = shapes
        .map((v) => Shape.keyCode(v))
        .filter((v, i, a) => a.indexOf(v) === i);
      results[config.name] = { shapes, keys };
    }

    Ops.logTable("Name", "Shapes", "Keys");
    for (const name in results) {
      const data = results[name];
      Ops.logTable(name, data.shapes.length, data.keys.length);
    }
    console.log("");

    // const all3 = results["3-logo "].keys;
    // const all4 = results["4-logo "].keys;
    // const only4 = all4.filter((v) => !all3.includes(v));
    // Ops.saveChart(only4);

    Ops.processShapes();
  }

  static runOps(startShapes, maxIters) {
    if (!startShapes) {
      startShapes = Shape.FLAT_4.map((code) => {
        return { code, op: OPS.prim, cost: 0 };
      });
    }

    const seenShapes = allShapes.filter((e) => e);
    Ops.clearNewShapes();
    Ops.saveShapes(startShapes);

    Ops.logTable("Iters", "Level", "ToDo", "Total");

    let iters = 0;
    let shape, shapes;
    // Note: Search by increasing cost level to avoid reducing the cost of a found shape.
    // Note: When a shape is used for searching, it should have the lowest cost possible.
    for (let level = 0; level < newShapes.length; level++) {
      shapes = newShapes[level];
      if (shapes === undefined) continue;
      while (shapes.length > 0) {
        iters++;
        if (iters % 100 == 0) {
          const total = Object.keys(allShapes).length;
          Ops.logTable(iters, level, shapes.length, total);
        }
        if (maxIters && iters > maxIters) break;

        shape = shapes.shift();

        // do one input operations
        // Ops.saveShapes(Ops.doOneOps(shape));

        // do two input operations
        seenShapes.push(shape);
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
  }

  static processShapes() {
    // Ops.displayShapes();
    // Ops.normalize();

    Ops.saveAllShapes();
    Ops.saveAllBuilds();
    Ops.saveDB();

    // for (let code = 0x1; code <= 0xf; code++) {
    //   Ops.findShape(code);
    // }
    Ops.findShape(0x1);
    Ops.findShape(0x11);
    Ops.findShape(0x12);
    Ops.findShape(0x121);
    Ops.findShape(0x1212);
    Ops.findShape(0xffff);

    Ops.findShape(0x4b); // Logo
    Ops.findShape(0xfe1f); // Rocket

    // console.log("Rocket:", Ops.getBuildStr(0xfe1f));
  }

  /**
   * @param {ShapeDef} shape
   * @returns {string}
   */
  static shapeToString(shape) {
    if (!shape) return "";
    let stackTrash = 0;
    if (shape.code1 != undefined && shape.code2 != undefined) {
      stackTrash = Shape.stackTrash(shape.code1, shape.code2);
    }
    const result = [
      Shape.pp(shape.code),
      Ops.OP_CODE[shape.op],
      shape.code1 === undefined ? "    " : Shape.pp(shape.code1),
      shape.code2 === undefined ? "    " : Shape.pp(shape.code2),
      `(${shape.cost},${shape.alt},${stackTrash})`,
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
    stackS1: "S1",
    stackS2: "S2",
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
   * @param {Array} shapes
   */
  static saveChart(shapes) {
    console.log("Saving shape chart");
    Fileops.writeFile("data/chart.txt", Shape.chart(shapes));
  }

  static saveAllShapes() {
    let data;
    const codes = Object.keys(allShapes);
    data = codes.map((code) => Ops.shapeToString(allShapes[code])).join(EOL);
    Fileops.writeFile(OPS_FILE_NAME, data);
    const keys = codes
      .map((v) => Shape.keyCode(v))
      .filter((v, i, a) => a.indexOf(v) === i);
    data = keys.map((code) => Ops.shapeToString(allShapes[code])).join(EOL);
    Fileops.writeFile(KEYS_FILE_NAME, data);
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
    Fileops.writeFile(BUILDS_FILE_NAME, data);
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
    Fileops.rmFile(DB_FILE_NAME);
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
    Fileops.appendFile(DB_FILE_NAME, data);
  }

  /**
   * @param {string} filename
   * @returns {Array<object>}
   */
  static readDB(filename) {
    console.log("Read DB:", filename);
    const data = Fileops.readBinFile(filename);
    if (!data) return [];

    const opName = [];
    for (let name of Object.keys(Ops.OP_ENUM)) {
      opName[Ops.OP_ENUM[name]] = name;
    }

    const result = [];
    let pos, code1, code2, op, shape;
    for (let code = 0; code <= 0xffff; code++) {
      pos = 5 * code;
      code1 = data[pos++] | (data[pos++] << 8);
      code2 = data[pos++] | (data[pos++] << 8);
      op = data[pos++];
      if (op === 0) continue;
      op = Ops.OP_CODE[opName[op]];
      shape = { code, op, code1, code2 };
      result.push(shape);
    }
    console.log("DB entries:", result.length);
    return result;
  }

  static dbToText(filename) {
    const shapes = Ops.readDB(filename);
    if (shapes.length == 0) return;

    const result = [];
    let line;
    for (const shape of shapes) {
      line = [
        Shape.pp(shape.code),
        shape.op,
        Shape.pp(shape.code1),
        Shape.pp(shape.code2),
      ].join(" ");
      result.push(line);
    }
    console.log("Save DB text:", TEXT_FILE_NAME);
    Fileops.writeFile(TEXT_FILE_NAME, result.join(EOL));
  }
}
