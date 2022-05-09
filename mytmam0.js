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
    // const complexShapes = keyShapes.filter((code) => !Shape.canStackAll(code));
    // complexShapes.forEach((code) => unknownShapes.set(code, { code }));

    const testShapes = [0x1, 0x21, 0x31, 0xa5];
    testShapes.forEach((code) => unknownShapes.set(code, { code }));

    console.log("Knowns:", knownShapes.size);
    console.log("Unknowns:", unknownShapes.size);

    let result;
    for (let code of Array.from(unknownShapes.keys())) {
      result = MyTmam.deconstruct(code);
      if (!result) {
        console.log("NOT FOUND", Shape.pp(code));
      } else {
        console.log(
          "FOUND",
          Shape.pp(code),
          Shape.pp(result.build),
          result.order
        );
        knownShapes.set(code, result);
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
   * @param {number} shape
   * @returns {boolean}
   */
  static isEmpty(shape) {
    return shape == 0;
  }

  /**
   * @param {number} shape
   * @returns {boolean}
   */
  static isOneLayer(shape) {
    return MyTmam.toLayers(shape).length == 1;
  }

  /**
   * @param {number} shape
   * @returns {boolean}
   */
  static noBottom(shape) {
    return (shape & 0xf) == 0;
  }

  /**
   * @param {number} shape
   * @returns {boolean}
   */
  static canStackBottom(shape) {
    const layers = MyTmam.toLayers(shape);
    return (layers[0] & layers[1]) != 0;
  }

  /**
   * @param {number} shape
   * @returns {number}
   */
  static add5th(shape) {
    if (shape > 0x0fff) shape |= 0xf0000;
    return shape;
  }

  /**
   * @param {number} shape
   * @returns {number}
   */
  static dropBottom(shape) {
    return shape >>> 4;
  }

  /**
   * @param {number} shape
   * @returns {number}
   */
  static getBottom(shape) {
    return shape & 0xf;
  }

  /**
   * @param {number} code
   * @param {number} value
   * @returns {number}
   */
  static removeCode(code, value) {
    return code & ~value;
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

  static findLogoX(shape, config) {
    const result = [];
    return result;
  }

  static findLogoY(shape, config) {
    const result = [];
    return result;
  }

  /**
   * @param {number} shape
   * @returns {Array<number>}
   */
  static deconstruct(targetShape) {
    console.log("Deconstruct");
    console.log(Shape.toShape(targetShape));
    console.log(Shape.pp(targetShape));
    console.log(Shape.graph(targetShape));

    const configs = [
      { logoFunc: MyTmam.findLogoX, reverse: false },
      { logoFunc: MyTmam.findLogoY, reverse: false },
      { logoFunc: MyTmam.findLogoX, reverse: true },
      { logoFunc: MyTmam.findLogoY, reverse: true },
    ];

    let num = 0;
    let shape, part, logos, result;
    const partList = [];
    let found = false;
    for (const config of configs) {
      console.log("ROUND", ++num);
      shape = MyTmam.add5th(targetShape);
      partList.length = 0;
      while (!MyTmam.isEmpty(shape)) {
        if (MyTmam.noBottom(shape)) {
          shape = MyTmam.dropBottom(shape);
          continue;
        }
        if (MyTmam.isOneLayer(shape) || MyTmam.canStackBottom(shape)) {
          part = MyTmam.getBottom(shape);
          console.log("LAYER", Shape.pp(shape), Shape.pp([part]));
        } else if ((logos = config.logoFunc(shape, config)).length > 0) {
          if (config.reverse) logos.reverse();
          part = logos[0];
          console.log("LOGO ", Shape.pp(shape), Shape.pp([part]));
        } else {
          part = MyTmam.getBottom(shape);
          console.log("EXTRA", Shape.pp(shape), Shape.pp([part]));
        }
        partList.push(part);
        result = { code: targetShape, build: partList };
        found = MyTmam.tryBuild(result);
        if (found) break;
        shape = MyTmam.removeCode(shape, part);
      }
      if (found) break;
    }
    if (!found) result = null;

    return result;
  }

  /**
   * Verify build - try stacking the results
   * @param {object} data {code: number, build: Array<number>}
   * @returns {boolean}
   */
  static tryBuild(data) {
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
