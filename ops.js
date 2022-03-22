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
 */

import { Shape } from "./shape.js";
import { appendFileSync, rm } from "fs";

const OPS_FILE_NAME = "ops.txt";
const WIDTH = 10;
const allShapes = new Map();

export class Ops {
  static logTable(...values) {
    console.log(...values.map((v) => v.toString().padStart(WIDTH)));
  }

  /**
   * Do one input transforms
   * @param {Number} code
   */
  static doOneOps(code) {
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

    if (code == 0) {
      return results;
    }
    const cost = allShapes.get(code).cost + 1;
    for (let op of ops) {
      const newCode = Shape[op + "Code"](code);
      // Skip NOPs
      if (code == newCode) continue;
      const result = {
        code: newCode,
        cost,
        op: op + "(" + Shape.pp(code) + ")",
      };
      results.push(result);
    }
    return results;
  }

  /**
   * Do two input transforms
   * @param {Number} code
   */
  static doTwoOps(code1, code2) {
    const results = [];
    const ops = ["stack"];

    if (code1 == 0 || code2 == 0) {
      return results;
    }
    const cost = allShapes.get(code1).cost + allShapes.get(code2).cost + 1;
    let newCode, result;
    for (let op of ops) {
      newCode = Shape[op + "Code"](code1, code2);
      // Skip NOPs
      if (code1 == newCode || code2 == newCode) continue;
      result = {
        code: newCode,
        cost,
        op: op + "(" + Shape.pp(code1) + "," + Shape.pp(code2) + ")",
      };
      results.push(result);
    }
    return results;
  }

  /**
   * Given a list of transform results, store the new shapes.
   * Adds new shapes to newShapes.
   * @param {Array} shapes Array of {code, cost, op}
   * @param {Array} Array of new shapes
   */
  static saveShapes(shapes) {
    const newShapes = [];
    for (const shape of shapes) {
      const code = shape.code;
      // Do not store empty shapes
      if (code == 0) continue;
      let entry = allShapes.get(code);
      if (entry == undefined) {
        allShapes.set(code, shape);
        newShapes.push(code);
      } else if (shape.cost < entry.cost) {
        console.log("#### Lower cost shape found");
        allShapes.set(code, shape);
      }
    }
    return newShapes;
  }

  // Note: Cost should always be increasing to avoid reducing the cost of a found shape.
  // TODO: Group allShapes by cost, perform search order by cost (bredth-first)

  static runOps() {
    const START_SHAPES = [0xf];
    const usedShapes = [];
    const stats = { iters: 0, ops: 0 };
    const MAX_ITERS = 10;

    let cost = 0;
    const newShapes = Ops.saveShapes(
      START_SHAPES.map((code) => {
        return { code, cost };
      })
    );

    Ops.logTable("Iters", "ToDo", "Total", "Ops");

    let shape;
    while (newShapes.length > 0) {
      if (stats.iters >= MAX_ITERS) break;
      stats.iters++;
      if (stats.iters % 100 == 0) {
        Ops.logTable(stats.iters, newShapes.length, allShapes.size, stats.ops);
      }

      shape = newShapes.shift();
      usedShapes.push(shape);

      let results;
      // do one input operations
      newShapes.push(...Ops.saveShapes(Ops.doOneOps(shape)));

      // do two input operations
      // const codes = Array.from(allShapes.keys());
      for (const code of usedShapes) {
        newShapes.push(...Ops.saveShapes(Ops.doTwoOps(shape, code)));
        if (code == shape) continue;
        newShapes.push(...Ops.saveShapes(Ops.doTwoOps(code, shape)));
      }
    }
    console.log("");

    // console.log("Remaining shapes:", newShapes.length);
    // for (const code of newShapes) {
    //   console.log(Shape.pp(code));
    // }
    // console.log("");

    console.log("Stats");
    console.log("Iters:", stats.iters);
    console.log("Ops:  ", stats.ops);
    console.log("ToDo: ", newShapes.length);
    console.log("Total:", allShapes.size);
    console.log("");

    Ops.displayShapes();
    // Ops.normalize();
    // Ops.appendFile(Ops.OPS_FILE_NAME, "Testing 123");

    // Ops.saveAllOps();
    // Ops.findShape(SHAPE1);
    // Ops.findShape(0x4b); // Logo
    // Ops.findShape(0x03); // Logo part
    // Ops.findShape(0x48); // Logo part
    // Ops.findShape(0xfe1f); // Rocket
    // Ops.findShape(0xffff);
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

  static findShape(code) {
    const ops = allShapes.get(Shape.keyCode(code));
    if (ops == undefined || ops.length == 0) {
      console.log(Shape.pp(code), "not found");
      return;
    }
    console.log(Shape.pp(code), "found (" + ops.length + ")...");
    Ops.listOps(code);
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

  static saveAllOps() {
    for (let code = 0; code < 0xffff; code++) {
      const data = Ops.listOps(code);
      try {
        rm(OPS_FILE_NAME);
      } catch (err) {
        console.error(err);
      }
      Ops.appendFile(OPS_FILE_NAME, data);
      // console.log(data);
    }
  }

  static displayShapes() {
    console.log("Shapes");
    const MAX_LENGTH = 8;
    const keys = Array.from(allShapes.keys()).sort((a, b) => a - b);
    for (let key of keys) {
      const value = allShapes.get(key);
      console.log(Shape.pp(key), value.cost.toString().padStart(2), value.op);
    }
  }
}
