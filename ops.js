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
import { appendFileSync, rmSync } from "fs";

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
const LOGO_SHAPES = [
  ...LOGO1_SHAPES,
  ...LOGO2_SHAPES,
  ...LOGO3_SHAPES,
  ...LOGO4_SHAPES,
];

const OPS_FILE_NAME = "data/ops.txt";
const WIDTH = 8;
const newShapes = []; // a[cost][]
const allShapes = []; // a[code]

export class Ops {
  static logTable(...values) {
    console.log(...values.map((v) => v.toString().padStart(WIDTH)));
  }

  /**
   * Do one input transforms
   * @param {Number} code
   */
  static doOneOps(shape1) {
    const results = [];
    const ops = [
      "left",
      "uturn",
      "right",
      "cutLeft",
      "cutRight",
      // "unstackBottom",
      // "unstackTop",
      // "screwLeft",
      // "screwRight",
      // "flip",
    ];

    const code1 = shape1.code;
    const cost = shape1.cost + 1;
    for (let op of ops) {
      const newCode = Shape[op + "Code"](code1);
      // Skip NOPs
      if (code1 == newCode) continue;
      const result = {
        code: newCode,
        cost,
        op,
        code1,
      };
      results.push(result);
    }
    return results;
  }

  /**
   * Do two input transforms
   * @param {Number} code
   */
  static doTwoOps(shape1, shape2) {
    const results = [];
    const ops = ["stack"];

    const code1 = shape1.code;
    const code2 = shape2.code;
    const cost = shape1.cost + shape2.cost + 1;
    let newCode, result;
    for (let op of ops) {
      newCode = Shape[op + "Code"](code1, code2);
      // Skip NOPs
      if (code1 == newCode || code2 == newCode) continue;
      result = {
        code: newCode,
        cost,
        op,
        code1,
        code2,
      };
      results.push(result);
    }
    return results;
  }

  // Returns [newShape, oldShape]
  // - newShape - if shape is new or costs less
  // - oldShape - if old shape costs more
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
    }

    if (newShape.cost === oldShape.cost) {
      // console.debug("#### Same cost found ####");
      // Ops.displayShape(newShape);
      oldShape.alt++;
    }

    return result;
  }

  /**
   * Given a list of transform results
   * - update allShapes.
   * - update newShapes.
   * @param {Array} shapes Array of transform results {code, cost, op, code1, code2}
   */
  static saveShapes(shapes) {
    let newShape, oldShape;
    for (let shape of shapes) {
      [newShape, oldShape] = Ops.updateAllShapes(shape);
      // Remove old shape
      if (oldShape) {
        const entry = newShapes[oldShape.cost];
        const idx = entry.findIndex((s) => s.code === oldShape.code);
        entry.splice(idx, 1);
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
  }

  static runOps() {
    const START_SHAPES = [...FLAT_SHAPES, ...LOGO_SHAPES];
    const MAX_ITERS = 10000;
    const MAX_LEVEL = 4;
    let iters = 0;

    Ops.logTable("Iters", "Level", "Total", "ToDo");

    Ops.saveShapes(
      START_SHAPES.map((code) => {
        return { code, cost: 0, op: "prim" };
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
    // for (const code of newShapes) {
    //   console.log(Shape.pp(code));
    // }
    console.log("");

    console.log("Stats");
    console.log("ToDo: ", newShapes.flat().length);
    console.log("Total:", Object.keys(allShapes).length);
    console.log("");

    // Ops.displayShapes();
    // Ops.normalize();
    // Ops.appendFile(Ops.OPS_FILE_NAME, "Testing 123");

    // Ops.saveAllOps();
    for (let code = 0x1; code <= 0xf; code++) {
      Ops.findShape(code);
    }
    Ops.findShape(0xffff);
    Ops.findShape(0x12);
    Ops.findShape(0x121);
    Ops.findShape(0x1212);
    Ops.findShape(0x4b); // Logo
    Ops.findShape(0xfe1f); // Rocket

    Ops.saveAllShapes();
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

  static findShape(code, i = 0) {
    const shape = allShapes[code];
    if (shape === undefined) {
      console.log("Shape not found:", Shape.pp(code));
      return;
    }
    console.log("  ".repeat(i++) + Ops.ShapeToString(shape));
    shape.code1 !== undefined && Ops.findShape(shape.code1, i);
    shape.code2 !== undefined && Ops.findShape(shape.code2, i);
  }

  /**
   * List all ops for a given shape code.
   * @param {Number} code
   */
  static listOps(code) {
    const MAX_LENGTH = 8;
    /** @type {Array} */
    const ops = allShapes.get(code);

    if (ops == undefined || ops.length == 0) {
      return "";
    }
    ops.sort();

    let result = "";
    let line;
    const head = Shape.pp(code);
    let i = 0;
    for (i = 0; i < ops.length; i++) {
      if (i % MAX_LENGTH == 0) {
        line = head;
      }
      line += " ";
      line += ops[i];
      if (i % MAX_LENGTH == MAX_LENGTH - 1) {
        result += line;
        result += "\n";
      }
    }
    if (i % MAX_LENGTH != MAX_LENGTH - 1) {
      result += line;
      result += "\n";
    }
    return result;
  }

  static appendFile(filename, data) {
    try {
      appendFileSync(filename, data);
    } catch (err) {
      console.error(err);
    }
  }

  static saveAllShapes() {
    try {
      rmSync(OPS_FILE_NAME, { force: true });
    } catch (err) {
      console.error(err);
      return;
    }
    const EOL = "\n";
    const codes = Object.keys(allShapes);
    const data = codes
      .map((code) => Ops.ShapeToString(allShapes[code]))
      .join(EOL);
    Ops.appendFile(OPS_FILE_NAME, data);
  }

  static ShapeToString(shape) {
    if (!shape) return "";
    const result = [
      Shape.pp(shape.code),
      // shape.cost.toString().padStart(2),
      shape.op.padEnd(WIDTH, " "),
      shape.code1 === undefined ? "    " : Shape.pp(shape.code1),
      shape.code2 === undefined ? "    " : Shape.pp(shape.code2),
      `(${shape.alt})`,
    ];
    return result.join(" ");
  }

  static displayShapes() {
    console.log("Shapes");
    const codes = Array.from(allShapes.keys()).sort((a, b) => a - b);
    for (let code of codes) {
      Ops.displayShape(allShapes.get(code));
    }
  }
}
