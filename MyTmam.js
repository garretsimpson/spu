/***
 * Code my TMAM
 *
 * Ideas
 * - find parts produces a mask?  or part and remainder?
 * - use a mask to find next part.
 * - work layers in palce or shift down?
 */

import { Shape } from "./shape.js";

export class MyTmam {
  static test() {
    const possibleShapes = [];
    const complexShapes = [];
    Shape.init();
    for (let code = 0; code <= 0xffff; ++code) {
      if (Shape.isPossible(code)) possibleShapes.push(code);
      if (Shape.isPossible(code) && Shape.canStackAll(code))
        complexShapes.push(code);
    }

    const testShapes = [];
    testShapes.push(0x1, 0x21, 0x31, 0xa5);

    let result;
    for (let code of testShapes) {
      result = MyTmam.deconstruct(code);
      if (!result) {
        console.log(Shape.pp(code), "not found");
      } else {
        console.log(Shape.pp(code), Shape.pp(result));
      }
      console.log("");
    }
  }

  /**
   * @param {number} code
   * @returns {Array<number>}
   */
  static toLayers(code) {
    let result = [];
    let value;
    for (let i = 0; i < 4; ++i) {
      value = code & 0xf;
      if (value == 0) break;
      result.push(value);
      code >>>= 4;
    }
    return result;
  }

  /**
   * @param {Array<number>} layers
   * @returns {boolean}
   */
  static isEmpty(layers) {
    return layers.length == 0;
  }

  /**
   * @param {Array<number>} layers
   * @returns {boolean}
   */
  static isOneLayer(layers) {
    return layers.length == 1;
  }

  /**
   * @param {Array<number>} layers
   * @returns {boolean}
   */
  static noBottom(layers) {
    return layers[0] == 0;
  }

  /**
   * @param {Array<number>} layers
   * @returns {boolean}
   */
  static canStackBottom(layers) {
    return (layers[0] & layers[1]) != 0;
  }

  /**
   * @param {number} shape
   * @returns {Array<number>}
   */
  static deconstruct(shape) {
    console.log("Deconstruct");
    console.log(Shape.pp(shape));
    console.log(Shape.graph(shape));

    const STATES = { off: "off", init: "init", find: "find", done: "done" };

    // init
    const result = [];
    let layers = MyTmam.toLayers(shape);
    let part;

    let state = STATES.find;
    while (state != STATES.done) {
      // analyze
      if (MyTmam.isEmpty(layers)) {
        state = STATES.done;
        continue;
      }
      if (MyTmam.noBottom(layers)) {
        layers.shift();
        continue;
      }
      if (MyTmam.isOneLayer(layers) || MyTmam.canStackBottom(layers)) {
        part = layers[0];
        console.log("LAYER", Shape.pp(part), Shape.pp(layers));
        layers[0] = 0;
      } else {
        part = layers[0];
        console.log("EXTRA", Shape.pp(part), Shape.pp(layers));
        layers[0] = 0;
      }
      result.push(part);
    }

    return result;
  }
}
