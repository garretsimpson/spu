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
const newShapes = [];
const allShapes = new Map();

export class Ops {
  static logTable(...values) {
    console.log(...values.map((v) => v.toString().padStart(WIDTH)));
  }

  /**
   * Do one input transforms
   * @param {Number} code
   */
  static doOneOps(code1, cost) {
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

    cost++;
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
  static doTwoOps(code1, code2, cost) {
    const results = [];
    const ops = ["stack"];

    cost++;
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

  /**
   * Given a list of transform results add new shapes to newShapes.
   * @param {Array} shapes Array of {code, cost, op}
   */
  static saveShapes(shapes) {
    const results = [];
    for (let shape of shapes) {
      const code = shape.code;
      // Do not store empty shapes
      if (code === 0) continue;
      const entry = allShapes.get(code);
      if (entry === undefined) {
        allShapes.set(code, shape);
        results.push(shape);
      } else {
        if (shape.cost === entry.cost) {
          // console.debug("#### Same cost found ####");
          // Ops.displayShape(shape);
        } else if (shape.cost < entry.cost) {
          console.error("#### Lower cost found ####");
          // Ops.displayShape(shape);
          allShapes.set(code, shape);
        }
      }
    }
    for (let shape of results) {
      const cost = shape.cost;
      const entry = newShapes[cost];
      if (entry === undefined) {
        newShapes[cost] = [shape];
      } else {
        entry.push(shape);
      }
    }
  }

  static runOps() {
    const LOGO1_SHAPES = [0x1, 0x2, 0x4, 0x8];
    const LOGO2_SHAPES = [0x12, 0x24, 0x48, 0x81, 0x18, 0x21, 0x42, 0x84];
    const LOGO3_SHAPES = [
      0x121, 0x242, 0x484, 0x818, 0x181, 0x212, 0x424, 0x848,
    ];
    const LOGO4_SHAPES = [
      0x1212, 0x2424, 0x4848, 0x8181, 0x1818, 0x2121, 0x4242, 0x8484,
    ];
    const START_SHAPES = [
      ...LOGO1_SHAPES,
      ...LOGO2_SHAPES,
      ...LOGO3_SHAPES,
      ...LOGO4_SHAPES,
    ];
    const MAX_ITERS = 32;
    const seenShapes = [];

    let cost = 0;
    Ops.saveShapes(
      START_SHAPES.map((code) => {
        return { code, cost, op: "prim" };
      })
    );

    let iters = 0;
    Ops.logTable("Iters", "Cost", "Total", "ToDo");

    // Note: Search by increasing cost to avoid reducing the cost of a found shape.
    for (cost = 0; cost < newShapes.length; cost++) {
      const shapes = newShapes[cost];
      if (shapes === undefined) continue;
      while (shapes.length > 0) {
        iters++;
        // if (iters >= MAX_ITERS) break;
        if (iters % 100 == 0) {
          Ops.logTable(iters, cost, allShapes.size, shapes.length);
        }

        const shape = shapes.shift();
        seenShapes.push(shape);
        // const seenShapes = Array.from(allShapes.values());

        // do one input operations
        Ops.saveShapes(Ops.doOneOps(shape.code, cost));

        // do two input operations
        for (const other of seenShapes) {
          const newCost = cost + other.cost; // TODO: Lookup other cost as it might be lower?
          Ops.saveShapes(Ops.doTwoOps(shape.code, other.code, newCost));
          if (other.code == shape.code) continue;
          Ops.saveShapes(Ops.doTwoOps(other.code, shape.code, newCost));
        }
      }
    }
    console.log("");

    // console.log("Remaining shapes:", newShapes.length);
    // for (const code of newShapes) {
    //   console.log(Shape.pp(code));
    // }
    // console.log("");

    console.log("Stats");
    console.log("ToDo: ", newShapes.flat().length);
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

  static displayShape(shape) {
    console.log(
      Shape.pp(shape.code),
      shape.cost.toString().padStart(2),
      shape.op,
      shape.code1 === undefined ? "" : Shape.pp(shape.code1),
      shape.code2 === undefined ? "" : Shape.pp(shape.code2)
    );
  }

  static displayShapes() {
    console.log("Shapes");
    const codes = Array.from(allShapes.keys()).sort((a, b) => a - b);
    for (let code of codes) {
      Ops.displayShape(allShapes.get(code));
    }
  }
}
