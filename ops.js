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

const allShapes = new Map();

export class Ops {
  /**
   * Do one input transforms
   * @param {Number} code
   */
  static doOneOps(code) {
    const results = [];
    const ops = ["left", "uturn", "right", "cutLeft", "cutRight"];

    if (code == 0) {
      return results;
    }
    for (let op of ops) {
      const newCode = Shape[op + "Code"](code);
      const result = { code: newCode, op: op + "(" + Shape.pp(code) + ")" };
      // Skip NOPs
      if (code == newCode) continue;
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
    let newCode, result;
    for (let op of ops) {
      newCode = Shape[op + "Code"](code1, code2);
      result = {
        code: newCode,
        op: op + "(" + Shape.pp(code1) + "," + Shape.pp(code2) + ")",
      };
      // Skip NOPs
      if (code1 == newCode || code2 == newCode) continue;
      results.push(result);
    }
    return results;
  }

  /**
   * Given a list of transform results, store the new shapes.
   * Adds new shapes to newShapes.
   * @param {Number} shape
   * @param {Array} newShapes
   * @param {Array} results
   */
  static saveShapes(newShapes, results) {
    let num = 0;
    for (const result of results) {
      const code = result.code;
      // Do not store empty shapes
      if (code == 0) continue;
      let ops = allShapes.get(code);
      if (ops == undefined) {
        // ops = new Set();
        ops = [];
        allShapes.set(code, ops);
        newShapes.push(code);
      }
      // ops.add(result.op);
      // ops.push(result.op);
      num++;
    }
    return num;
  }

  static runOps() {
    const SHAPE1 = 0xf;
    const newShapes = [];
    const usedShapes = [];
    const stats = { iters: 0, ops: 0 };
    const MAX_ITERS = 50000;

    newShapes.push(SHAPE1);
    allShapes.set(SHAPE1, []);

    const width = 10;
    console.log(
      "Iters".padStart(width),
      "ToDo".padStart(width),
      "Total".padStart(width),
      "Ops".padStart(width)
    );

    let shape;
    while (newShapes.length > 0) {
      if (stats.iters >= MAX_ITERS) break;
      stats.iters++;
      if (stats.iters % 100 == 0) {
        console.log(
          stats.iters.toString().padStart(width),
          newShapes.length.toString().padStart(width),
          allShapes.size.toString().padStart(width),
          stats.ops.toString().padStart(width)
        );
      }

      shape = newShapes.shift();
      usedShapes.push(shape);

      let results;
      // do one input operations
      results = Ops.doOneOps(shape);
      stats.ops += Ops.saveShapes(newShapes, results, stats);

      // do two input operations
      // const codes = Array.from(allShapes.keys());
      for (const code of usedShapes) {
        results = Ops.doTwoOps(shape, code);
        stats.ops += Ops.saveShapes(newShapes, results, stats);
        if (code == shape) continue;
        results = Ops.doTwoOps(code, shape);
        stats.ops += Ops.saveShapes(newShapes, results, stats);
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

    // Ops.displayShapes();
    Ops.normalize();

    // Ops.findShape(SHAPE1);
    // Ops.findShape(0x4b); // Logo
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
    //const keys = Array.from(normals.keys()).sort((a, b) => a - b);
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
    const ops = allShapes.get(code);
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
    const ops = allShapes.get(code).sort();

    let result;
    let i = 0;
    for (i = 0; i < ops.length; i++) {
      if (i % MAX_LENGTH == 0) {
        result = Shape.pp(code);
      }
      result += " ";
      result += ops[i];
      if (i % MAX_LENGTH == MAX_LENGTH - 1) {
        console.log(result);
      }
    }
    if (i % MAX_LENGTH != MAX_LENGTH - 1) {
      console.log(result);
    }
  }

  static displayShapes() {
    console.log("Shapes");
    const MAX_LENGTH = 8;
    const keys = Array.from(allShapes.keys()).sort((a, b) => a - b);
    for (let key of keys) {
      const ops = Array.from(allShapes.get(key));
      const len = Math.min(ops.length, MAX_LENGTH);
      console.log(Shape.pp(key), ops.slice(-len).join(","));
    }
  }
}
