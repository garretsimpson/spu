/***
 * Code my TMAM
 *
 * Ideas
 * - find parts produces a mask? or part and remainder?
 * - use a mask to find next part.
 * - work layers in place or shift down?
 */

import { Shape } from "./shape.js";
import { Fileops } from "./fileops.js";

export class MyTmam {
  static test() {
    const knownShapes = new Map();
    const unknownShapes = new Map();

    const possibleShapes = [];
    Shape.init();
    for (let code = 0; code <= 0xffff; ++code) {
      if (Shape.isPossible(code)) possibleShapes.push(code);
    }
    const keyShapes = possibleShapes.filter(
      (code) => Shape.keyCode(code) == code
    );
    const complexShapes = keyShapes.filter((code) => !Shape.canStackAll(code));

    complexShapes.forEach((code) => unknownShapes.set(code, { code }));

    // const testShapes = [0x1, 0x21, 0x31, 0xa5];
    // testShapes.forEach((code) => unknownShapes.set(code, { code }));

    let result;
    for (let code of Array.from(unknownShapes.keys())) {
      result = MyTmam.deconstruct(code);
      if (!result) {
        console.log("NOT FOUND", Shape.pp(code));
      } else {
        console.log("FOUND", Shape.pp(code), Shape.pp(result));
        knownShapes.set(code, { code, build: result });
        unknownShapes.delete(code);
      }
      console.log("");
    }

    console.log("Knowns:", knownShapes.size);
    console.log("Unknowns:", unknownShapes.size);
    console.log(Shape.pp(Array.from(unknownShapes.keys())));

    // Log known builds
    console.log("Saving known builds");
    let data = "";
    for (const [key, value] of knownShapes) {
      data += Shape.pp(key);
      data += " ";
      data += Shape.pp(value.build);
      data += " ";
      data += value.order;
      data += "\n";
    }
    Fileops.writeFile("data/known.txt", data);

    // Log remaining unknowns
    console.log("Saving chart of unknowns");
    const chart = Shape.chart(unknownShapes);
    Fileops.writeFile("data/unknown.txt", chart);
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

  static hasLogo(layers) {
    let found;
    let result = "";
    for (let pos of ["E", "N", "W", "S"]) {
      let code = [];
      for (let i = 0; i < layers.length; ++i) {
        code[i] = layers[i].toString(2).padStart(4, "0"); // convert to binary string
        code[i] = Array.from(code[i])
          .reverse()
          .map((v) => +v);
        layers[i] = Shape.rightCode(layers[i]);
      }
      found =
        code[0][0] ^ code[0][1] &&
        code[0][0] ^ code[1][0] &&
        code[0][1] ^ code[1][1];
      result += found ? pos : "-";
      //   console.log(">>", code[0], code[1], found, `'${result}'`);
    }
    console.log(">LOGO", result);
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
        layers.shift();
        continue;
      }
      if (MyTmam.hasLogo(layers)) {
        // extract logo
        console.log("LOGO ", Shape.pp(part), Shape.pp(layers));
        continue;
      }
      part = layers[0];
      console.log("EXTRA", Shape.pp(part), Shape.pp(layers));
      layers.shift();

      result.push(part);
    }

    return result;
  }

  /**
   * Verify build - try stacking the results
   * @param {object} data {code: number, build: Array<number>}
   * @returns {boolean}
   */
  static verifyBuild(data) {
    const ORDERS = [
      [],
      ["0"],
      ["01+"],
      ["01+2+", "012++"],
      ["01+2+3+", "0123+++", "01+23++", "012++3+"],
      ["01+2+3+4+", "01234++++", "01+234+++", "012++34++"], // not used: 01+2+3+4+
      [],
      [],
      [],
      [],
      [],
    ];
    const num = data.build.length;
    let code;
    for (const order of ORDERS[num]) {
      code = Shape.stackOrder(data.build, order);
      if (code == data.code) {
        data.order = order;
        return true;
      }
    }
    return false;
  }

  /**
   * Stack in the given order
   * @param {Array<number>} codes
   * @param {string} order
   * @returns {number}
   */
  static stackOrder(codes, order) {
    const stack = [];
    let code;
    for (const i of order) {
      if (i == "+") {
        code = Shape.stackCode(stack.pop(), stack.pop());
      } else {
        code = codes[i];
      }
      stack.push(code);
    }
    const result = stack.pop();
    // console.log("ORDER", order, Shape.pp(codes), Shape.pp(result));
    return result;
  }
}
