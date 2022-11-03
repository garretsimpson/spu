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
  static init() {
    MyTmam.makeLogos();
  }

  /**
   * Make logo and mask constants.
   * There are four positions 0..3 (ESWN), three sizes 2..4, and two orientations (left/right handed)
   */
  static makeLogos() {
    const LOGO = [[], [], [0x21, 0x12], [0x121, 0x212], [0x2121, 0x1212]];
    const MASK_X = [[], [], [0x33, 0x33], [0x333, 0x333], [0x3333, 0x3333]];
    const MASK_Y = [[], [], [0x33, 0x33], [0x133, 0x233], [0x2333, 0x1333]];
    // const SEAT = [0x0361, 0x0392];
    // const MASK_Z = [0x07ff, 0x0bff];

    MyTmam.LOGOS_X = MyTmam.makeLogoCodes(LOGO, MASK_X);
    MyTmam.LOGOS_Y = MyTmam.makeLogoCodes(LOGO, MASK_Y);
    // MyTmam.SEATS = MyTmam.makeSeatCodes(SEAT, MASK_Z);
  }

  /**
   * @param {number[][]} logos
   * @param {number[][]} masks
   * @returns {number[][][]}
   */
  static makeLogoCodes(logos, masks) {
    const codes = [];
    let sizes, values;
    for (const pos of [0, 1, 2, 3]) {
      sizes = [];
      for (const size of [2, 3, 4]) {
        values = [];
        for (const num of [0, 1]) {
          values.push({
            logo: Shape.rotateCode(logos[size][num], pos),
            mask: Shape.rotateCode(masks[size][num], pos),
          });
        }
        sizes[size] = values;
      }
      codes[pos] = sizes;
    }
    return codes;
  }

  /**
   * @param {number[]} seats
   * @param {number[]} masks
   * @returns {number[][]}
   */
  static makeSeatCodes(seats, masks) {
    const codes = [];
    let values;
    for (let pos = 0; pos < 4; ++pos) {
      values = [];
      for (let num = 0; num < 2; ++num) {
        values.push({
          seat: Shape.rotateCode(seats[num], pos),
          mask: Shape.rotateCode(masks[num], pos),
        });
      }
      codes[pos] = values;
    }
    return codes;
  }

  static test() {
    const values = [0, 0x0001, 0x0012, 0x0120, 0x1200];
    let result;
    for (const value of values) {
      result = MyTmam.bottomLayerNum(value);
      console.log("bottomLayerNum:", Shape.pp(value), result);
    }
  }

  static run() {
    const knownShapes = new Map();
    const unknownShapes = new Map();

    Shape.init();
    MyTmam.init();
    const possibleShapes = [];
    for (let code = 0; code <= 0xffff; ++code) {
      if (Shape.isPossible(code)) possibleShapes.push(code);
    }
    // possibleShapes.forEach((code) => unknownShapes.set(code, { code }));

    const keyShapes = possibleShapes.filter(
      (code) => Shape.keyCode(code) == code
    );
    keyShapes.forEach((code) => unknownShapes.set(code, { code }));

    // const complexShapes = possibleShapes.filter(
    //   (code) => !Shape.canStackAll(code)
    // );
    // complexShapes.forEach((code) => unknownShapes.set(code, { code }));

    // const testShapes = [0x1, 0x21, 0x31, 0x5a5a]; // basic test shapes
    // const testShapes = [0x1634, 0x3422]; // 3-logo and fifth layer
    // const testShapes = [0x0178, 0x0361]; // hat and seat
    // const testShapes = [0x3343, 0x334a, 0x334b]; // stack order "10234++++"
    // const testShapes = [0x1625, 0x1629, 0x162c, 0x162d]; // stack order "10324++++"
    // const testShapes = [0x3425, 0x342c, 0x342d, 0x343c, 0x34a5, 0x35a1]; // stack order?
    // const testShapes = [0x0361, 0x1361, 0x1634, 0x1b61, 0x36c2]; // seat joint
    // const testShapes = [0x17a4, 0x37a4]; // multiple solutions: strict logo (depending on search order) and seat joint
    // const testShapes = [0x4da1, 0x8e52]; // multiple solutions: strict logo (depending on search order) and seat joint
    // const testShapes = [0x167a]; // has 2 2-layer logos, but only 1 is needed - 167a [000a,0007,0012,0004] 0123+++
    // const testShapes = [0x0163, 0x03c6, 0x1163, 0x1165]; // unknowns for binz
    // testShapes.forEach((code) => unknownShapes.set(code, { code }));

    console.log("Knowns:", knownShapes.size);
    console.log("Unknowns:", unknownShapes.size);
    console.log("");

    let result;
    for (let code of Array.from(unknownShapes.keys())) {
      result = MyTmam.deconstruct2(code);
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
    console.log("");

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
    return shape > 0 && shape < 0x0010;
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
    const above = (shape & 0x00f0) >> 4;
    const below = shape & 0x000f;
    return (above & below) != 0;
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
   * @param {number} shape
   * @returns {number}
   */
  static bottomLayerNum(shape) {
    if (shape == 0) return 0;
    let num;
    for (num = 0; num < 4; num++) {
      if ((shape & 0xf) != 0) break;
      shape >>>= 4;
    }
    return num;
  }

  /**
   * @param {number} shape
   * @param {number} num
   * @returns {number}
   */
  static dropLayers(shape, num) {
    return shape >>> (4 * num);
  }

  /**
   * @param {number} shape
   * @param {number} part
   * @returns {boolean}
   */
  static hasHatOld(shape, part) {
    // find top of part
    let top = 0;
    let mask = 0xf000;
    while (top == 0 && mask > 0) {
      top = part & mask;
      mask >>>= 4;
    }
    // look for top on top of top
    top <<= 4;
    return (shape & top) != 0;
  }

  /**
   * @param {number} shape
   * @param {number} part
   * @param {number} size
   * @returns {boolean}
   */
  static hasHat(shape, part, size) {
    // find top of part
    const mask = 0xf << (4 * (size - 1));
    const top = part & mask;
    // look for a piece on top of top
    return (shape & (top << 4)) != 0;
  }

  /**
   * @param {number} shape
   * @param {number} part
   * @param {number} size
   * @returns {boolean}
   */
  static hasPad(shape, part, size) {
    // find seat of part
    const mask = 0xf << (4 * (size - 2));
    const seat = part & mask;
    // look for a piece on top of seat
    return (shape & (seat << 4)) != 0;
  }

  /**
   * @param {number} shape
   * @param {number} part
   * @returns {number}
   */
  static deletePart(shape, part) {
    return shape & ~part;
  }

  /**
   * Find parts that require a seat
   * @param {number} shape
   * @returns {number?}
   */
  static findSeats(shape) {
    const SEATS = MyTmam.SEATS;
    const LOGOS = MyTmam.LOGOS_X;
    const size = 3;
    let result = [];
    let seat, mask, logo;
    for (let pos = 0; pos < 4; ++pos) {
      for (let num = 0; num < 2; ++num) {
        seat = SEATS[pos][num].seat;
        mask = SEATS[pos][num].mask;
        logo = LOGOS[pos][size][num].logo;
        if ((shape & mask) == seat) result.push(logo);
      }
    }

    return result;
  }

  /**
   * Find half-logo parts
   * @param {number} shape
   * @param {object} config
   * @returns {Array<number>}
   */
  static findLogos(shape, config) {
    const LOGOS = config.pad ? MyTmam.LOGOS_Y : MyTmam.LOGOS_X;
    const size = config.size;
    let result = [];
    for (let pos = 0; pos < 4; ++pos) {
      for (const { logo, mask } of LOGOS[pos][size]) {
        if ((shape & mask) == logo) result.push(logo);
      }
    }
    // if (config.pad === true)
    //   result = result.filter((part) => MyTmam.hasPad(shape, part, size));
    if (config.hat === true)
      result = result.filter((part) => MyTmam.hasHat(shape, part, size));
    return result;
  }

  /**
   * Find half-logo parts that include the bottom layer.
   * Return only the tallest part from each position.
   * @param {number} shape
   * @param {object} config
   * @returns {Array<number>}
   */
  static findBigLogos(shape, config) {
    const LOGOS = config.seat ? MyTmam.LOGOS_Y : MyTmam.LOGOS_X;
    const result = [];
    const found = [];
    // Use WSEN [2, 1, 0, 3] to match my game
    for (const pos of [2, 1, 0, 3]) {
      found.length = 0;
      for (const size of [4, 3, 2]) {
        for (const { logo, mask } of LOGOS[pos][size]) {
          if ((shape & mask) == logo) found.push(logo);
        }
        if (found.length > 0) {
          result.push(found[0]);
          break;
        }
      }
    }
    return result;
  }

  /**
   * Find half-logo parts from all positions.
   * Don't return two logos when they appear in the same position.
   * @param {number} shape
   * @returns {Array<Array<number>>}
   */
  static findAllLogos(shape) {
    const LOGOS = MyTmam.LOGOS_X;
    const result = [];
    const found = [];
    for (const pos of [0, 1, 2, 3]) {
      result[pos] = [];
      found.length = 0;
      for (const size of [4, 3, 2]) {
        for (let off = 4 - size; off >= 0; --off) {
          for (let { logo, mask } of LOGOS[pos][size]) {
            mask <<= 4 * off;
            if ((shape & mask) == mask) break;
            logo <<= 4 * off;
            if ((shape & logo) == logo) found.push(logo);
          }
        }
      }
      result[pos].push(...found);
    }
    return result;
  }

  /**
   * Find half-logo parts from all positions.
   * Return only the set of tallest part from each position.
   * @param {number} shape
   * @returns {Array<Array<number>>}
   */
  static findAllBigLogos(shape) {
    const LOGOS = MyTmam.LOGOS_X;
    const result = [];
    const found = [];
    for (const pos of [0, 1, 2, 3]) {
      result[pos] = [];
      found.length = 0;
      for (const size of [4, 3, 2]) {
        for (let off = 4 - size; off >= 0; --off) {
          for (let { logo, mask } of LOGOS[pos][size]) {
            mask <<= 4 * off;
            logo <<= 4 * off;
            if ((shape & logo) == logo) found.push(logo);
          }
        }
        if (found.length > 0) {
          result[pos].push(...found);
          break;
        }
      }
    }
    return result;
  }

  /**
   * Deconstructor - prof ninja method
   * @param {number} shape
   * @returns {object?}
   */
  static deconstruct0(targetShape) {
    console.log("Deconstruct");
    console.log(Shape.toShape(targetShape));
    console.log(Shape.pp(targetShape));
    console.log(Shape.graph(targetShape));

    const SEAT_KEYS = [0x0361, 0x1361, 0x1634, 0x1b61, 0x36c2];
    const P1_KEYS = [0x1bc1, 0x2792, 0x4e94, 0x8d68]; // one 3-pad, then two 2-logo, picks the wrong one.
    const P2_KEYS = [0x35a1, 0x3a52, 0x65a4, 0xca58]; // two 3-hat, picks the wrong one

    const LOGO_CONFIG = [
      { size: 2, hat: true },
      { size: 3, hat: true },
      { size: 4 },
      { size: 3 },
      { size: 2 },
    ];
    const SEAT_CONFIG = [{ size: 3, pad: true }, { size: 2 }];

    const hasSeat =
      SEAT_KEYS.indexOf(Shape.keyCode(targetShape)) == -1 ? false : true;
    const CONFIGS = hasSeat ? SEAT_CONFIG : LOGO_CONFIG;

    let shape, part, seats, logos;
    const partList = [];
    shape = MyTmam.add5th(targetShape);
    while (!MyTmam.isEmpty(shape)) {
      part = null;
      if (MyTmam.noBottom(shape)) {
        shape = MyTmam.dropBottom(shape);
        continue;
      }
      if (MyTmam.isOneLayer(shape) || MyTmam.canStackBottom(shape)) {
        part = MyTmam.getBottom(shape);
        console.log("LAYER", Shape.pp(shape), Shape.pp([part]));
      }
      // if (part == null) {
      //   seats = MyTmam.findSeats(shape);
      //   console.log(">SEAT", Shape.pp(shape), Shape.pp(seats));
      //   if (seats.length > 0) {
      //     part = seats[0];
      //     console.log("SEAT ", Shape.pp(shape), Shape.pp([part]));
      //   }
      // }
      if (part == null) {
        for (let config of CONFIGS) {
          logos = MyTmam.findLogos(shape, config);
          console.log(
            ">LOGO",
            Shape.pp(shape),
            Shape.pp(logos),
            `(${config.size}${config.pad == true ? ",pad" : ""}${
              config.hat == true ? ",hat" : ""
            })`
          );
          if (logos.length > 0) {
            part = logos[0];
            // part = logos[logos.length - 1];
            console.log("LOGO ", Shape.pp(shape), Shape.pp([part]));
            break;
          }
        }
      }
      if (part == null) {
        part = MyTmam.getBottom(shape);
        console.log("EXTRA", Shape.pp(shape), Shape.pp([part]));
      }
      partList.push(part);
      shape = MyTmam.deletePart(shape, part);
    }

    const result = { code: targetShape, build: partList };
    const found = MyTmam.tryBuild(result);
    if (found) {
      return result;
    } else {
      return null;
    }
  }

  /**
   * Deconstructor - kipy method
   * @param {number} shape
   * @returns {object?}
   */
  static deconstruct1(targetShape) {
    console.log("Deconstruct");
    console.log(Shape.toShape(targetShape));
    console.log(Shape.pp(targetShape));
    console.log(Shape.graph(targetShape));

    const configs = [
      { seat: false, reverse: false },
      { seat: true, reverse: false },
      { seat: false, reverse: true },
      { seat: true, reverse: true },
    ];

    let num = 0;
    let shape, part, logos, result;
    const partList = [];
    let found = false;
    for (const config of configs) {
      console.log("ROUND", ++num);
      shape = targetShape;
      if (!config.seat) {
        shape = MyTmam.add5th(shape);
      }
      partList.length = 0;
      while (!MyTmam.isEmpty(shape)) {
        if (MyTmam.noBottom(shape)) {
          shape = MyTmam.dropBottom(shape);
          continue;
        }
        if (MyTmam.isOneLayer(shape) || MyTmam.canStackBottom(shape)) {
          part = MyTmam.getBottom(shape);
          console.log("LAYER", Shape.pp(shape), Shape.pp([part]));
        } else if ((logos = MyTmam.findBigLogos(shape, config)).length > 0) {
          console.log(">LOGO", Shape.pp(logos));
          if (config.reverse) {
            part = logos[logos.length - 1];
          } else {
            part = logos[0];
          }
          console.log("LOGO ", Shape.pp(shape), Shape.pp([part]));
        } else {
          part = MyTmam.getBottom(shape);
          console.log("EXTRA", Shape.pp(shape), Shape.pp([part]));
        }
        partList.push(part);
        result = { code: targetShape, build: partList };
        found = MyTmam.tryBuild(result);
        if (found) break;
        shape = MyTmam.deletePart(shape, part);
      }
      if (found) break;
    }
    if (!found) result = null;

    return result;
  }

  /**
   * Deconstructor - binz method
   * @param {number} shape
   * @returns {object?}
   */
  static deconstruct2(targetShape) {
    console.log("Deconstruct");
    console.log(Shape.toShape(targetShape));
    console.log(Shape.pp(targetShape));
    console.log(Shape.graph(targetShape));

    // const layers = Shape.toLayers(targetShape);

    // Find all logos
    // TODO: include both strict and "seated" logos
    let allLogos = MyTmam.findAllLogos(targetShape);
    console.log(">LOGO", Shape.pp(allLogos));

    // Reduce set of logos (needs work)
    // need to skip no logo cases (execept first case)
    // const logosets = [
    //   [],
    //   allLogos[0],
    //   allLogos[1],
    //   allLogos[2],
    //   allLogos[3],
    //   [allLogos[0], allLogos[2]].flat(),
    //   [allLogos[1], allLogos[3]].flat(),
    // ];
    allLogos = allLogos.flat();
    const numLogos = allLogos.length;
    const numSets = 1 << numLogos;
    console.log("STATS", numLogos, numSets);

    const logoSets = [];
    let bin, set;
    for (let i = 0; i < numSets; ++i) {
      bin = i.toString(2).padStart(numLogos, "0");
      set = [];
      for (let j = 0; j < numLogos; ++j) {
        if (bin[j] == 1) {
          set.push(allLogos[j]);
        }
      }
      logoSets[i] = set;
    }
    // console.log(">SETS", Shape.pp(logoSets));

    let shape,
      flats,
      count = 0,
      result;
    const partList = [];
    let found = false;

    // for each combination of logos
    for (const logos of logoSets) {
      count++;
      // console.log("LOGOS", Shape.pp(logos));
      // delete logos from layers
      shape = targetShape;
      for (const logo of logos) {
        shape = MyTmam.deletePart(shape, logo);
        // console.log("SHAPE", Shape.pp(shape));
      }
      flats = Shape.toLayers(shape);
      // console.log("FLATS", Shape.pp(flats));
      // arrange layers (needs work)
      // for each layer (starting with bottom),
      // - add flat for that layer (if any)
      // - add logos that have a bottom in that layer (if any)
      partList.length = 0;
      for (let i of [0, 1, 2, 3]) {
        flats[i] && partList.push(flats[i]);
        for (const logo of logos) {
          const num = MyTmam.bottomLayerNum(logo);
          if (num == i) {
            partList.push(MyTmam.dropLayers(logo, num));
          }
        }
      }
      // console.log("PARTS", Shape.pp(partList));
      // add fifth layer if needed
      // try stacking
      result = { code: targetShape, build: partList };
      found = MyTmam.tryBuild(result);
      // console.log("");
      if (found) break;
    }
    if (!found) result = null;
    console.log("STATS", count, numSets);

    return result;
  }

  /**
   * Wizard deconstructor by Nabby
   * @param {number} shape
   */
  static deconstruct3(shape) {
    console.log("Deconstruct");
    console.log(Shape.pp(shape));

    let part;
    while (!MyTmam.isEmpty(shape)) {
      part = MyTmam.doNabbyMagic(shape);
      MyTmam.outputPart(part);
      shape = MyTmam.deletePart(shape, part);
    }
  }

  /**
   * Verify build - try stacking the results
   * @param {object} data {code: number, build: Array<number>}
   * @returns {boolean}
   */
  static tryBuild(data) {
    const ORDERS0 = [
      [],
      ["0"],
      ["01+"],
      ["012++", "102++"],
      ["0123+++", "0213+++", "1023+++", "1032+++"],
      ["01234++++", "01324++++", "02134++++", "10234++++", "10324++++"],
    ];
    const ORDERS1 = [
      [],
      ["0"],
      ["01+"],
      ["012++", "01+2+"], // both are needed
      ["0123+++", "012++3+", "01+23++"], // not used: 01+2+3+
      ["01234++++", "012++34++", "01+234+++"], // not used: 01+2+3+4+
    ];
    const ORDERS = ORDERS1;
    const num = data.build.length;
    if (num >= ORDERS.length) {
      // console.error("too many parts");
      return false;
    }
    let code;
    for (const order of ORDERS[num]) {
      code = MyTmam.stackOrder(data.build, order);
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
