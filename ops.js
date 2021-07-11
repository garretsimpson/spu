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
  static saveShapes(shape, newShapes, results, stats) {
    const shapes = new Set();

    for (const result of results) {
      const code = result.code;
      // Do not store empty shapes
      if (code == 0) continue;
      let ops = allShapes.get(code);
      if (ops == undefined) {
        ops = new Set();
        allShapes.set(code, ops);
        shapes.add(code);
      }
      // ops.add(result.op);
      stats.ops++;
    }
    for (shape of shapes) {
      newShapes.push(shape);
    }
  }

  static runOps() {
    const SHAPE1 = 0xf;
    const newShapes = [];
    const stats = { iters: 0, ops: 0 };
    const MAX_ITERS = 100000;

    newShapes.push(SHAPE1);
    allShapes.set(SHAPE1, new Set());
    const width = 10;
    console.log(
      "Iters".padStart(width),
      "ToDo".padStart(width),
      "Total".padStart(width),
      "Ops".padStart(width)
    );
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

      const shape = newShapes.pop();
      let results;
      // do one input operations
      results = Ops.doOneOps(shape);
      Ops.saveShapes(shape, newShapes, results, stats);

      // do two input operations
      const codes = Array.from(allShapes.keys());
      for (const code of codes) {
        results = Ops.doTwoOps(shape, code);
        Ops.saveShapes(shape, newShapes, results, stats);
        if (code == shape) continue;
        results = Ops.doTwoOps(code, shape);
        Ops.saveShapes(shape, newShapes, results, stats);
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

    // console.log("Shapes");
    // const MAX_LENGTH = 5;
    // const keys = Array.from(allShapes.keys()).sort((a, b) => a - b);
    // for (let key of keys) {
    //   const ops = Array.from(allShapes.get(key));
    //   const len = Math.min(ops.length, MAX_LENGTH);
    //   console.log(Shape.pp(key), ops.slice(-len).join(","));
    // }
  }
}
