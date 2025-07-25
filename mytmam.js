/***
 * TMAM simulator
 *
 * Implements software versions of various TMAMs
 */

import { Shape } from "./shape.js";
import { Fileops } from "./fileops.js";

const RULE = {
  FLAT: "-",
  STACK: "|",
  LEFT: "\\",
  RIGHT: "/",
  LEFT_PRUNE: "<",
  RIGHT_PRUNE: ">",
  LEFT_2: "(",
  RIGHT_2: ")",
};

const ARULE = {
  FLAT: "--",
  NO_V: "XV",
  HAT_H: "HH",
  THREE_H: "3H",
};

const OPS = { EJECT: "@", FLAT: "-", STACK: "|", LEFT: "\\", RIGHT: "/", FIFTH: "+" };

export class MyTmam {
  // Some TMAMs have analyzers that work in parallel.
  // In this TMAM simulator work is done serially, typically by interleaving the work of each analyzer.

  // Stats are per shape
  // - combos - number of possible half-logo combinations.
  // - iters - sum of work done by all analyzers.
  // - logos - number of half-logos found.
  // - maxIters - work done by the analyzer that did the most work.
  // An iter is a unit of work.
  static stats = { combos: [0], iters: [0], logos: [0], maxIters: [0] };

  static init() {
    MyTmam.makeLogos();
  }

  /**
   * Make logo and mask constants.
   * There are four positions 0..3 (ESWN), three sizes 2..4, and two directions (right/left handed)
   */
  static makeLogos() {
    const FLOATS = [[], [], [0x21, 0x12], [0x121, 0x212], [0x2121, 0x1212]];
    const MASK_X = [[], [], [0x33, 0x33], [0x333, 0x333], [0x3333, 0x3333]];
    const MASK_Y = [[], [], [0x33, 0x33], [0x133, 0x233], [0x2333, 0x1333]];
    // const SEAT = [0x0361, 0x0392];
    // const MASK_Z = [0x07ff, 0x0bff];

    MyTmam.FLOATS = MyTmam.makeLogoCodes(FLOATS, FLOATS);
    MyTmam.LOGOS_X = MyTmam.makeLogoCodes(FLOATS, MASK_X);
    MyTmam.LOGOS_Y = MyTmam.makeLogoCodes(FLOATS, MASK_Y);
    // MyTmam.SEATS = MyTmam.makeSeatCodes(SEAT, MASK_Z);
  }

  /**
   * @param {number[][]} codes
   * @param {number[][]} masks
   * @returns {number[][][]}
   */
  static makeLogoCodes(codes, masks) {
    const DIR = [OPS.RIGHT, OPS.LEFT];
    const result = [];
    let sizes, values;
    for (const pos of [0, 1, 2, 3]) {
      sizes = [];
      for (const size of [2, 3, 4]) {
        values = [];
        for (const dir of [0, 1]) {
          values.push({
            code: Shape.rotateCode(codes[size][dir], pos),
            mask: Shape.rotateCode(masks[size][dir], pos),
            dir: DIR[dir],
            pos,
          });
        }
        sizes[size] = values;
      }
      result[pos] = sizes;
    }
    return result;
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
   * @param {number} above
   * @param {number} below
   * @returns {boolean}
   */
  static isStable(above, below) {
    return above == 0 || (above & below) != 0;
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
   * Find all flats from the bottom layer
   */
  static findBottomFlats(shape) {
    let result = [];
    let mask = 0xf;
    let top, bottom;
    for (let num = 0; num < 4; ++num) {
      bottom = shape & mask;
      shape >>= 4;
      top = shape & mask;
      if (top == 0) {
        result[num] = bottom;
        break;
      }
      if ((top & bottom) == 0) break;
      result[num] = bottom;
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
    if (config.hat === true) result = result.filter((part) => MyTmam.hasHat(shape, part, size));
    return result;
  }

  /**
   * Find floating parts that include the bottom layer.
   * Return only the tallest part from each position.
   * @param {number} shape
   * @param {object} config
   * @returns {Array<number>}
   */
  static findBigFloats(shape, config) {
    const LOGOS = config.seat ? MyTmam.LOGOS_Y : MyTmam.LOGOS_X;
    const result = [];
    const found = [];
    // Use WSEN [2, 1, 0, 3] to match my game
    for (const pos of [2, 1, 0, 3]) {
      found.length = 0;
      for (const size of [4, 3, 2]) {
        for (const { code, mask } of LOGOS[pos][size]) {
          if ((shape & mask) == code) found.push(code);
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
   * Don't return the logos when they appear in the same position.
   * @param {number} shape
   * @returns {Array<Array<number>>}
   */
  static findAllLogos(shape) {
    const LOGOS = MyTmam.LOGOS_X;
    const result = [, , [], [], []];
    let list;
    for (const size of [2, 3, 4]) {
      for (let off = 0; off <= 4 - size; ++off) {
        // Use position order NWSE [3, 2, 1, 0] from Binz' TMAM
        for (const pos of [3, 2, 1, 0]) {
          for (let { logo, mask } of LOGOS[pos][size]) {
            mask <<= 4 * off;
            if ((shape & mask) == mask) break;
            logo <<= 4 * off;
            if ((shape & logo) == logo) {
              result[size].push(logo);
            }
          }
        }
      }
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
   * Returns a list of all n-bit numbers with a given number of 1s.
   * @param {number} max
   * @param {number} bits
   * @param {?number} sum
   * @param {?array} ret
   * @returns {array<number>}
   */
  static hammingCombos1(max, bits, sum = 0, ret = []) {
    --bits;
    for (let pos = bits; pos < max; ++pos) {
      const value = sum | (1 << pos);
      if (bits) {
        MyTmam.hammingCombos1(pos, bits, value, ret);
      } else {
        ret.push(value);
      }
    }
    return ret;
  }

  /**
   * Returns a list of all n-bit numbers with 1..given number of 1s.
   * @param {number} max
   * @param {number} bits
   * @param {?number} sum
   * @param {?array} ret
   * @returns {array<number>}
   */
  static hammingCombos2(max, bits, sum = 0, ret = []) {
    --bits;
    for (let pos = 0; pos < max; ++pos) {
      const value = sum | (1 << pos);
      ret.push(value);
      if (bits) MyTmam.hammingCombos2(pos, bits, value, ret);
    }
    return ret;
  }

  /**
   * Verify build - try stacking the results
   * @param {object} data {code: number, build: Array<number>}
   * @returns {boolean}
   */
  static tryBuild(targetShape, data) {
    // bottom-up
    const ORDERS1 = [[], ["0"], ["01+"], ["01+2+"], ["01+2+3+"], ["01+2+3+4+"]];
    // top-down
    const ORDERS2 = [[], ["0"], ["01+"], ["012++"], ["0123+++"], ["01234++++"]];
    // fixed part order
    const ORDERS3 = [
      [],
      ["0"],
      ["01+"],
      ["012++", "01+2+"], // both are needed
      ["0123+++", "012++3+", "01+23++"], // not used: 01+2+3+
      ["01234++++", "012++34++", "01+234+++"], // not used: 01+2+3+4+
    ];
    // top-down with various part orders
    // Note: These are incomplete
    const ORDERS4 = [
      [],
      ["0"],
      ["01+"],
      ["012++", "102++"],
      ["0123+++", "0213+++", "1023+++", "1032+++"],
      ["01234++++", "01324++++", "02134++++", "10234++++", "10324++++"],
    ];
    // Used by superparts
    const ORDERS5 = [[], ["0"], ["01+"], ["012++", "01+2+"], ["0123+++"], ["01234++++"]];
    const ORDERS_MYTMAM = [
      [],
      ["0"],
      ["01+"],
      ["012++", "01+2+"], // both are needed
      ["0123+++", "01+23++"],
      ["01234++++", "012++34++", "01+234+++"],
    ];
    const ORDERS = ORDERS_MYTMAM;

    const num = data.parts.length;
    if (num >= ORDERS.length) {
      // console.error("too many parts");
      return false;
    }
    let code;
    for (const order of ORDERS[num]) {
      code = MyTmam.stackOrder(data.parts, order);
      if (code == targetShape) {
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
        code = Shape.stackS1Code(stack.pop(), stack.pop());
      } else {
        code = codes[i];
      }
      stack.push(code);
    }
    const result = stack.pop();
    // console.log("ORDER", order, Shape.pp(codes), Shape.pp(result));
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

    const LOGO_CONFIG = [{ size: 2, hat: true }, { size: 3, hat: true }, { size: 4 }, { size: 3 }, { size: 2 }];
    const SEAT_CONFIG = [{ size: 3, pad: true }, { size: 2 }];

    const hasSeat = SEAT_KEYS.indexOf(Shape.keyCode(targetShape)) == -1 ? false : true;
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
            `(${config.size}${config.pad == true ? ",pad" : ""}${config.hat == true ? ",hat" : ""})`
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

    const result = { build: partList };
    const found = MyTmam.tryBuild(targetShape, result);
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
    console.log(Shape.graphS1(targetShape));

    const configs = [
      { seat: false, reverse: false },
      { seat: false, reverse: true },
      { seat: true, reverse: false },
      { seat: true, reverse: true },
    ];

    let num = 0;
    let shape, part, logos, result;
    const partList = [];
    let found = false;
    for (const config of configs) {
      console.log("ROUND", ++num, config);
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
        } else if ((logos = MyTmam.findBigFloats(shape, config)).length > 0) {
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
        result = { parts: partList };
        found = MyTmam.tryBuild(targetShape, result);
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
    console.log(Shape.graphS1(targetShape));

    const layers = Shape.toLayers(targetShape);

    // Find all logos
    const allLogos = MyTmam.findAllLogos(targetShape);
    const numLogos = allLogos.flat().length;
    console.log(">LOGO", Shape.pp(allLogos));
    console.log(">>NUM", numLogos);
    // allLogos = allLogos.flat();

    // Make logo sets
    const logoSets2 = [[], allLogos.flat(), allLogos.flat().reverse()];
    const logoSets3 = [
      [],
      [...allLogos[2], ...allLogos[3]],
      [...allLogos[3], ...allLogos[4]],
      [...allLogos[4], ...allLogos[2]],
    ];
    const logoSets = logoSets3;
    const numSets = logoSets.length;
    console.log(">SETS", Shape.pp(logoSets));
    // console.log(">>NUM", numSets);

    // Make combos
    let combo;
    const combos = [];
    for (const logoset of logoSets) {
      combo = [];
      // binary combos
      // let num = 1 << logoset.length;
      // for (let i = 1; i < num; ++i) {
      //   combo.push(i);
      // }
      // hamming combos
      for (let i = 1; i < 5; ++i) {
        combo.push(...MyTmam.hammingCombos1(logoset.length, i));
      }
      combo.push(...MyTmam.hammingCombos2(logoset.length, 4));
      if (combo.length == 0) combo.push(0);
      combos.push(combo);
      // console.log(">COMB", Shape.pp(combo));
    }
    const numCombos = combos.flat().length;
    // console.log(">>NUM", numCombos);
    console.log("COMBO", combos.map((a) => a.length).toString());

    const logos = [];
    const partList = [];
    const maxIters = [];
    let found = false;
    let iters = 0;
    let i = 0;
    let value, num, bin, bit;
    let shape, flats, result;

    // Iterete over all combos
    while (iters < numCombos) {
      // interleave the combos
      // in game this would done in parallel
      value = combos[i].shift();
      if (value == undefined) {
        i = (i + 1) % numSets;
        continue;
      }
      logos.length = 0;
      num = logoSets[i].length;
      bin = value.toString(2).padStart(num, "0");
      for (let j = 0; j < num; ++j) {
        // LSB first
        bit = bin[num - j - 1];
        if (bit == 1) {
          logos.push(logoSets[i][j]);
        }
      }
      // console.log("LOGOS", Shape.pp(logos));

      // delete logos from layers
      shape = targetShape;
      for (const logo of logos) {
        shape = MyTmam.deletePart(shape, logo);
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
          num = MyTmam.bottomLayerNum(logo);
          if (num == i) {
            partList.push(MyTmam.dropLayers(logo, num));
          }
        }
      }
      // add fifth layer if needed
      if (layers.length == 4) {
        partList.push(...Shape.FLAT_4);
      }
      // console.log("PARTS", Shape.pp(partList));

      // try stacking
      result = { build: partList, logos };
      found = MyTmam.tryBuild(targetShape, result);
      // console.log("");

      iters++;
      num = maxIters[i] || 0;
      maxIters[i] = num + 1;
      i = (i + 1) % numSets;

      if (found) break;
    }
    if (!found) result = null;

    MyTmam.stats.logos[targetShape] = numLogos;
    MyTmam.stats.iters[targetShape] = iters;
    MyTmam.stats.combos[targetShape] = numCombos;
    MyTmam.stats.maxIters[targetShape] = Math.max(...maxIters);
    console.log("ITERS", maxIters.toString());
    console.log("STATS", `${iters} of ${numCombos}`);

    return result;
  }

  /**
   * Returns the values of each quad in an array.
   * @param {*} layer
   * @returns {Array}
   */
  static getQuads(layer) {
    const q1 = layer & 0b0001;
    const q2 = layer & 0b0010;
    const q3 = layer & 0b0100;
    const q4 = layer & 0b1000;
    return [q1, q2, q3, q4];
  }

  /**
   * Simple stack - Just add the top part to the layer above the bottom part.
   */
  static simpleStack(top, bottom) {
    const num = Shape.layerCount(bottom);
    const result = (top << (4 * num)) | bottom;
    return result;
  }

  /**
   * Find flat part
   */
  static findFlat(state) {
    let result;

    const passLayer = state.prevPass.reduce((a, x, i) => a | (+(x > 0) << i), 0);
    const part = MyTmam.deletePart(state.layer, passLayer);
    if (MyTmam.isStable(state.nextLayer, part)) {
      result = part;
    }

    return result;
  }

  static findFlatSimple(state) {
    let part = state.layer & state.nextLayer;
    const passLayer = state.prevPass.reduce((a, x, i) => a | (+(x > 0) << i), 0);
    part = MyTmam.deletePart(part, passLayer);

    return part;
  }

  /**
   * Check if part can be grown as a stack.
   */
  static canStack(state) {
    const quad = state.quadNum;
    const passedDir = state.prevDir[quad];
    const passedPart = state.prevPass[quad];
    const nextQuad = state.nextQuads[quad];

    return nextQuad && (!passedPart || passedDir == OPS.STACK);
  }

  /**
   * Check if part can be grown as a float.
   */
  static canFloat(rule, dir, state) {
    const quad = state.quadNum;
    const onLeft = (quad + 3) % 4;
    const peer = (quad + 2) % 4;
    const onRight = (quad + 1) % 4;
    const prune = rule == RULE.LEFT_PRUNE || rule == RULE.RIGHT_PRUNE;
    let ruleDir;
    if (rule == RULE.LEFT || rule == RULE.LEFT_2 || rule == RULE.LEFT_PRUNE) ruleDir = OPS.LEFT;
    if (rule == RULE.RIGHT || rule == RULE.RIGHT_2 || rule == RULE.RIGHT_PRUNE) ruleDir = OPS.RIGHT;

    const passedDir = state.prevDir[quad];
    const passedPart = state.prevPass[quad];
    const topQuad = state.nextQuads[quad];
    const topPeer = state.nextQuads[peer];
    const passedSize = Shape.layerCount(passedPart);
    const maxSize = (rule == RULE.LEFT_2) | (rule == RULE.RIGHT_2) ? 2 : 5;
    if (passedSize + 1 > maxSize) return false;

    // console.log(`size: ${passedSize}, max: ${maxSize}`);

    const myQuad = state.quads[quad];
    let nextQuad, oppoQuad, peerQuad, sideQuad, prevDir, underPass;
    switch (dir) {
      case OPS.LEFT:
        nextQuad = state.nextQuads[onLeft];
        oppoQuad = state.nextQuads[onRight];
        peerQuad = state.quads[peer];
        sideQuad = state.quads[onLeft];
        underPass = state.prevPass[onLeft];
        prevDir = OPS.RIGHT;
        break;
      case OPS.RIGHT:
        nextQuad = state.nextQuads[onRight];
        oppoQuad = state.nextQuads[onLeft];
        peerQuad = state.quads[peer];
        sideQuad = state.quads[onRight];
        underPass = state.prevPass[onRight];
        prevDir = OPS.LEFT;
        break;
    }

    return (
      myQuad &&
      nextQuad &&
      !(prune && topQuad) &&
      !(oppoQuad && ruleDir == prevDir) && // implements game logic
      (!passedPart || (passedDir == prevDir && !sideQuad)) &&
      // !(sideQuad && !underPass) &&
      !(peerQuad && ruleDir == prevDir && !(prune && topPeer))
    );
  }

  /**
   * Run the rule for one quad.
   * Returns the direction the corner should be passed, or ejected.
   * The direction specified by rule is tried first.  If that fails, the opposite direction is tried.
   */
  static runRule(rule, state) {
    let result = OPS.EJECT;

    const canStack = MyTmam.canStack;
    const canFloat = MyTmam.canFloat;
    switch (rule) {
      case RULE.FLAT:
        result = OPS.EJECT;
        break;
      case RULE.STACK:
        if (canStack(state)) {
          result = OPS.STACK;
        }
        break;
      case RULE.LEFT:
      case RULE.LEFT_2:
      case RULE.LEFT_PRUNE:
        if (canFloat(rule, OPS.LEFT, state)) {
          result = OPS.LEFT;
        } else if (canFloat(rule, OPS.RIGHT, state)) {
          result = OPS.RIGHT;
        }
        break;
      case RULE.RIGHT:
      case RULE.RIGHT_2:
      case RULE.RIGHT_PRUNE:
        if (canFloat(rule, OPS.RIGHT, state)) {
          result = OPS.RIGHT;
        } else if (canFloat(rule, OPS.LEFT, state)) {
          result = OPS.LEFT;
        }
        break;
      default:
        console.warn("Unknown rule:", rule);
        break;
    }

    return result;
  }

  /**
   * Deconstructor - FASTMAM (Skim's method)
   * @param {number} targetShape
   */
  static deconstruct3(targetShape) {
    console.log("Deconstruct");
    console.log(Shape.toShape(targetShape));
    console.log(Shape.pp(targetShape));
    console.log(Shape.graphS1(targetShape));

    const CONFIGS = [
      // { rules: [RULE.FLAT, RULE.FLAT, RULE.FLAT] },
      // { rules: [RULE.STACK, RULE.STACK, RULE.STACK] },
      // { rules: [RULE.LEFT, RULE.RIGHT, RULE.LEFT] },
      // { rules: [RULE.RIGHT, RULE.LEFT, RULE.RIGHT] },
      // { rules: [RULE.LEFT, RULE.RIGHT_PRUNE, RULE.LEFT] },
      // { rules: [RULE.RIGHT, RULE.LEFT_PRUNE, RULE.RIGHT] },
      // { rules: [RULE.RIGHT_PRUNE, RULE.LEFT_2, RULE.RIGHT_PRUNE] },
      // { rules: [RULE.LEFT_PRUNE, RULE.RIGHT_2, RULE.LEFT_PRUNE] },
      { rules: [RULE.RIGHT_PRUNE, RULE.LEFT_PRUNE, RULE.RIGHT_PRUNE] },
      { rules: [RULE.LEFT_PRUNE, RULE.RIGHT_PRUNE, RULE.LEFT_PRUNE] },
      { rules: [RULE.RIGHT, RULE.LEFT, RULE.RIGHT] },
      { rules: [RULE.LEFT, RULE.RIGHT, RULE.LEFT] },
    ];

    let result = null;
    let partList;
    let offsets;
    let flats;
    const layers = Shape.toLayers(targetShape);
    let layer, rule, layerParts, flat, pass, dir;
    let quads, nextLayer, nextQuads;
    let passedPart, op, part, num;

    // passed part and direction per quad
    let prevPass = [0, 0, 0, 0];
    let prevDir = [null, null, null, null];

    for (const config of CONFIGS) {
      console.log("RULES", config.rules.join(""));
      partList = [[], [], [], []]; // ejected parts per layer
      flats = [null, null, null, null]; // flats per layer

      for (const layerNum of [0, 1, 2, 3]) {
        layer = layers[layerNum];
        if (!layer) break;
        rule = config.rules[layerNum] || RULE.FLAT;
        console.log("LAYER", layerNum + 1, rule, Shape.pp(layer));
        nextLayer = layers[layerNum + 1] || 0;
        layerParts = [];

        flat = MyTmam.findFlat({
          prevPass,
          layer,
          nextLayer,
        });
        if (flat) {
          console.log(">FLAT", Shape.pp(flat));
          layerParts.push(flat);
        }

        quads = MyTmam.getQuads(layer);
        nextQuads = MyTmam.getQuads(nextLayer);
        pass = [0, 0, 0, 0];
        dir = [null, null, null, null];

        // Use order 3012 to match game
        for (const quadNum of [3, 0, 1, 2]) {
          part = quads[quadNum];
          if (part == 0 || (part & flat) != 0) continue;

          // If there is a passed part, stack it
          passedPart = prevPass[quadNum];
          if (passedPart) {
            part = MyTmam.simpleStack(part, passedPart);
          }

          // Run rules
          op = MyTmam.runRule(rule, {
            prevPass,
            prevDir,
            quadNum,
            quads,
            nextQuads,
          });
          const onLeft = (quadNum + 3) % 4;
          const onRight = (quadNum + 1) % 4;
          switch (op) {
            case OPS.STACK:
              pass[quadNum] = part;
              dir[quadNum] = OPS.STACK;
              break;
            case OPS.LEFT:
              pass[onLeft] = part;
              dir[onLeft] = OPS.LEFT;
              break;
            case OPS.RIGHT:
              pass[onRight] = part;
              dir[onRight] = OPS.RIGHT;
              break;
            case OPS.EJECT:
              if (passedPart) {
                // floating part
                // partList[layerNum].push(part); // top layer
                // sort parts according to their bottom layer.
                num = Shape.layerCount(part);
                partList[layerNum - num + 1].push(part);
                console.log(">PART", Shape.pp(part));
              } else {
                // single layer part (one corner)
                layerParts.push(part);
                console.log(">QUAD", Shape.pp(part));
              }
              break;
            default:
              console.warn("Unknown rule:", rule);
              break;
          }
        }

        // stack flat parts
        if (layerParts.length != 0) {
          part = layerParts.reduce((a, b) => a | b);
          flats[layerNum] = part;
        }

        console.log("PASS ", Shape.pp(pass));
        console.log("DIR  ", Shape.pp(dir));
        prevPass = pass;
        prevDir = dir;
      }

      // insert flats
      // adding to the start (unshift) improves stacking - makes most shapes work top-down.
      flats.forEach((v, i) => {
        if (v != null) partList[i].unshift(v);
      });

      // make superparts
      // partList = partList.map((parts) =>
      //   parts.length > 0 ? [parts.reduce((a, b) => a | b)] : []
      // );

      // add 5th layer
      // the game always adds 5th to 4 layer parts
      // if (Shape.layerCount(targetShape) == 4) {
      //   partList.push(Shape.FLAT_4);
      // }

      offsets = partList.map((a, i) => a.map((e) => i)).flat();
      console.log("OFFS ", Shape.pp(offsets));
      partList = partList.flat();
      console.log("PARTS", Shape.pp(partList));

      // find stacking order
      const build = { parts: partList, offsets, extra: false };
      let found = MyTmam.tryBuild(targetShape, build);
      // try with 5th layer
      if (!found) {
        partList.push(...Shape.FLAT_4);
        offsets.push(4);
        build.extra = true;
        found = MyTmam.tryBuild(targetShape, build);
      }
      if (found) {
        result = build;
        break;
      }
      console.log("");
    }

    return result;
  }

  /**
   * Wizard deconstructor by Nabby
   * @param {number} shape
   */
  static deconstruct4(shape) {
    console.log("Deconstruct");
    console.log(Shape.pp(shape));

    let part;
    while (!MyTmam.isEmpty(shape)) {
      part = MyTmam.doNabbyMagic(shape);
      MyTmam.outputPart(part);
      shape = MyTmam.deletePart(shape, part);
    }
  }

  static findFloats(shape, positions) {
    const result = [];
    const FLOATS = [];
    const SIZE = 2;
    positions.forEach((pos) => FLOATS.push(...MyTmam.FLOATS[pos][SIZE]));
    for (const { code, mask, dir, pos } of FLOATS) {
      if ((shape & mask) == code) result.push({ code, dir, pos });
    }
    return result;
  }

  /**
   * Makes four patterns, using mirror and rotate twice
   * @param {number} code
   * @param {number} mask
   */
  static makePatterns(code, mask) {
    const mirrors = [];
    mirrors.push({ code, mask });
    mirrors.push({ code: Shape.mirrorCode(code), mask: Shape.mirrorCode(mask) });
    const rotates = [];
    for (let { code, mask } of mirrors) {
      rotates.push({ code: Shape.rotateCode(code, 2), mask: Shape.rotateCode(mask, 2) });
    }
    return [...mirrors, ...rotates];
  }

  /**
   * Checks if the shape has the pattern to solve 0178.
   * - - - -
   * O - X -
   * O - O -
   * - - - O
   * @param {number} shape
   */
  static hatH(shape) {
    const PATTERNS = MyTmam.makePatterns(0x0158, 0x0558);
    for (let { code, mask } of PATTERNS) {
      if ((shape & mask) == code) {
        return true;
      }
    }
    return false;
  }

  /**
   * Checks if the shape has the pattern to solve 0185.
   * - - - -
   * O - - -
   * - - - O
   * O - O -
   *
   * 024a
   * - - - -
   * - O - -
   * - - O -
   * - O - O
   * @param {number} shape
   */
  static threeH(shape) {
    const PATTERNS = MyTmam.makePatterns(0x0185, 0x0185);
    for (let { code, mask } of PATTERNS) {
      if ((shape & mask) == code) {
        return true;
      }
    }
    return false;
  }

  /**
   * Deconstructor by Andrei
   * This deconstructor is functional (does not iterate).
   * Instead of finding a list of parts, it identifies each quad as flat/float-left/float-right.
   * Stacking defaults to top-down but will stack out of order when top-down is not possible.
   * Works on 3 sets of layer pairs, bottom-up.
   * Each layer pair has a different set of rules.
   * Each rule uses positions of quarters and info from lower layer pairs.
   * Rules have priority (or decisions) to determine which one wins. ?
   * The output is 16 op codes, one for each quad.
   * The bottom 3 rows are for the layer pairs (1-2, 2-3, 3-4) and the top row is for the 5th layer.
   * @param {number} goalShape
   */
  static deconstruct5(goalShape) {
    console.log("Deconstruct");
    console.log(Shape.pp(goalShape));
    console.log(Shape.graphS1(goalShape));

    let result = null;
    const ops = [];
    for (let i = 0; i < 16; ++i) {
      ops[i] = OPS.FLAT;
    }

    const CONFIGS = [
      [ARULE.FLAT, ARULE.NO_V, ARULE.HAT_H, ARULE.THREE_H],
      [ARULE.FLAT, ARULE.NO_V],
      [ARULE.FLAT, ARULE.NO_V],
    ];

    const layers = Shape.toLayers(goalShape);
    let above, below, pair, pair_V, pair_H, part, flat, use_H;
    let passedFloat = { code: 0 };
    let floats, floats_V, floats_H;

    for (const pairNum of [0, 1, 2]) {
      below = layers[pairNum] || 0;
      if (below == 0) break;
      above = layers[pairNum + 1] || 0;
      // console.log("Above:", Shape.pp(above));
      // console.log("Below:", Shape.pp(below));
      pair = MyTmam.simpleStack(above, below);

      // Exclude the corner from the passed float
      console.log("Passed:", Shape.pp(passedFloat.code));
      part = passedFloat.code >>> 4;
      below = MyTmam.deletePart(below, part);
      // TODO: Maybe this can be simpler, just delete the part?
      pair_V = passedFloat.pos == 1 || passedFloat.pos == 3 ? MyTmam.deletePart(pair, part) : pair;
      pair_H = passedFloat.pos == 0 || passedFloat.pos == 2 ? MyTmam.deletePart(pair, part) : pair;
      passedFloat.code = 0;

      // Find float parts
      floats_V = MyTmam.findFloats(pair_V, [0, 2]);
      floats_H = MyTmam.findFloats(pair_H, [1, 3]);

      // Run the rules
      flat = false;
      use_H = false;
      for (const rule of CONFIGS[pairNum]) {
        switch (rule) {
          case ARULE.FLAT:
            if (MyTmam.isStable(above, below)) flat = true;
            break;
          case ARULE.NO_V:
            use_H = floats_V.length == 0;
            break;
          case ARULE.HAT_H:
            use_H = MyTmam.hatH(goalShape);
            break;
          case ARULE.THREE_H:
            use_H = MyTmam.threeH(goalShape);
            break;
        }
        if (flat || use_H) break;
      }

      // Update ops
      floats = use_H ? floats_H : floats_V;
      if (flat || floats.length == 0) continue;
      console.log("Floats:", Shape.pp(floats.map((i) => i.code)));
      if (floats.length == 1) passedFloat = floats[0];
      for (let float of floats) {
        ops[4 * pairNum + float.pos] = float.dir;
      }
    }

    // 5th layer
    // TODO: Add 5th layer when needed

    const found = MyTmam.makeShape(goalShape, ops) == goalShape;
    if (found) result = { ops };
    return result;
  }

  static opsChart(ops) {
    let result = "";
    let pos, line;
    for (let layerNum of [3, 2, 1, 0]) {
      pos = 4 * layerNum;
      line = ops.slice(pos, pos + 4).join(" ");
      result += line + "\n";
    }
    return result;
  }

  static FLOAT_LEFT = [
    [1, 4],
    [2, 5],
    [3, 6],
    [0, 7],
    [5, 8],
    [6, 9],
    [7, 10],
    [4, 11],
    [9, 12],
    [10, 13],
    [11, 14],
    [8, 15],
  ];
  static FLOAT_RIGHT = [
    [0, 5],
    [1, 6],
    [2, 7],
    [3, 4],
    [4, 9],
    [5, 10],
    [6, 11],
    [7, 8],
    [8, 13],
    [9, 14],
    [10, 15],
    [11, 12],
  ];

  /**
   * Construct a shape according to the build operations.
   * There are 3 rows of operations and a 4th row that indicates if a 5th layer is needed.
   * Floats are stacked with a scaffold (skipped in this code) and then passed down a layer.
   * After all the floats are passed down to their bottom layer,
   * all parts on each layer are stacked together (superparts).
   * Then all layers are stacked top-down (unless it can't).
   * This version uses a build ops where each column is position (ESWN) and rows are layer pairs.
   * @param {number} goalShape
   * @param {Array<*>} ops
   */
  static makeShape(goalShape, ops) {
    const FLOATS = {};
    FLOATS[OPS.LEFT] = MyTmam.FLOAT_LEFT;
    FLOATS[OPS.RIGHT] = MyTmam.FLOAT_RIGHT;

    let result = 0;
    const parts = [];
    const layers = [];
    for (let i = 0; i < 16; ++i) {
      parts[i] = ((goalShape >>> i) & 1) << i % 4;
    }
    // console.log(Shape.pp(parts));
    // Check for 5th layer
    if (ops[4 * 3] == OPS.FIFTH) {
      layers.push(...Shape.FLAT_4);
    }

    // Perform build ops
    let pos, op, top, bot;
    for (const layerNum of [2, 1, 0]) {
      for (const quad of [0, 1, 2, 3]) {
        pos = 4 * layerNum + quad;
        op = ops[pos];
        if (op == OPS.FLAT) continue;
        [bot, top] = FLOATS[op][pos];
        parts[bot] = MyTmam.simpleStack(parts[top], parts[bot]);
        parts[top] = 0;
      }
    }

    // Stack parts on each layer
    let part, layerPart;
    for (const layerNum of [3, 2, 1, 0]) {
      layerPart = 0;
      for (const quad of [0, 1, 2, 3]) {
        pos = 4 * layerNum + quad;
        part = parts[pos];
        if (part == 0) continue;
        layerPart = Shape.stackS1Code(part, layerPart);
      }
      layers.push(layerPart);
    }

    // Stack layers
    // TODO: reorder parts if top-down stack does not work
    console.log("Layers:", Shape.pp(layers));
    result = layers.shift();
    while (layers.length > 0) {
      part = layers.shift();
      result = Shape.stackS1Code(result, part);
    }
    return result;
  }

  static NEXT_LEFT = [, , , , 1, 2, 3, 0, 5, 6, 7, 4, 9, 10, 11, 8];
  static NEXT_RIGHT = [, , , , 3, 0, 1, 2, 7, 4, 5, 6, 11, 8, 9, 10];

  /**
   * This version uses a build ops list where each position (0..11) is for a spot on the shape.
   */
  static makeShape0(goalShape, ops) {
    let result = 0;
    const parts = [];
    const layers = [];
    for (let i = 0; i < 16; ++i) {
      parts[i] = ((goalShape >>> i) & 1) << i % 4;
    }
    // console.log(Shape.pp(parts));
    // Check for 5th layer
    if (ops[12] == OPS.FIFTH) {
      layers.push(...Shape.FLAT_4);
    }
    // Stack parts on each layer
    let part, pos, op, layerPart, next;
    for (const layerNum of [3, 2, 1, 0]) {
      layerPart = 0;
      for (const quad of [0, 1, 2, 3]) {
        pos = 4 * layerNum + quad;
        part = parts[pos];
        if (part == 0) continue;
        op = layerNum > 0 ? ops[pos - 4] : OPS.FLAT;
        // If flat, stack layer part.
        // If float, stack with next part and pass down.
        switch (op) {
          case OPS.FLAT:
            layerPart |= part;
            break;
          case OPS.LEFT:
            next = MyTmam.NEXT_LEFT[pos];
            parts[next] = MyTmam.simpleStack(part, parts[next]);
            break;
          case OPS.RIGHT:
            next = MyTmam.NEXT_RIGHT[pos];
            parts[next] = MyTmam.simpleStack(part, parts[next]);
            break;
        }
      }
      layers.push(layerPart);
    }
    // Stack layers
    // TODO: reorder parts if top-down stack does not work
    console.log("Layers:", Shape.pp(layers));
    result = layers.shift();
    while (layers.length > 0) {
      part = layers.shift();
      result = Shape.stackS1Code(result, part);
    }
    return result;
  }

  static test() {
    const ALL_FLAT = [];
    for (let i = 0; i < 16; ++i) {
      ALL_FLAT[i] = OPS.FLAT;
    }

    const ROCKET = 0xfe1f;
    let ops1 = ALL_FLAT.slice();
    ops1[4] = OPS.RIGHT;
    let ops2 = ALL_FLAT.slice();
    ops2[7] = OPS.LEFT;

    const TESTS = [
      [ROCKET, ops1],
      [ROCKET, ops2],
    ];
    let result, pass;
    for (let [shape, ops] of TESTS) {
      console.log("Goal shape");
      console.log(Shape.graphS1(shape));

      console.log("Build ops");
      console.log(MyTmam.opsChart(ops));

      result = MyTmam.makeShape(shape, ops);
      console.log("Result shape");
      console.log(Shape.graphS1(result));

      pass = shape == result;
      console.log(pass ? "PASS" : "FAIL");
    }
  }

  static testCombos() {
    const values = [0, 0x0001, 0x0012, 0x0120, 0x1200];
    let result;
    for (const value of values) {
      result = MyTmam.bottomLayerNum(value);
      console.log(`bottomLayerNum(${Shape.pp(value)}) returns ${result}`);
    }

    const size = 8;
    const bits = 4;
    const a1 = [];
    for (let i = 1; i < 5; ++i) {
      a1.push(...MyTmam.hammingCombos1(size, i));
    }
    console.log(`hammingCombos1(${size}, ${bits}) returns ${a1.length} ${Shape.pp(a1)}`);
    const a2 = MyTmam.hammingCombos2(size, bits);
    console.log(`hammingCombos2(${size}, ${bits}) returns ${a2.length} ${Shape.pp(a2)}`);

    // const a = MyTmam.hammingCombos(size, bits);
    // console.log(
    //   `hammingCombos(${size}, ${bits}) returns ${a.length} ${Shape.pp(a)}`
    // );
    // console.log("");
    // let value, pos;
    // for (let i = 0; i < a.length; ++i) {
    //   value = a[i].toString(2).padStart(size, "0");
    //   pos = size - value.lastIndexOf("01") - 2;
    //   console.log(value, pos);
    // }
  }

  static run() {
    Shape.init();
    MyTmam.init();

    /** @type {Map<number, object>} */ // {build: [], order: ""}
    const knownShapes = new Map();
    /** @type {Map<number, object>} */
    const unknownShapes = new Map();

    const possibleShapes = [];
    for (let code = 0; code <= 0xffff; ++code) {
      if (Shape.isPossible(code)) possibleShapes.push(code);
    }
    const complexShapes = possibleShapes.filter((code) => !Shape.canStackAll(code));
    const keyShapes = complexShapes.filter((code) => Shape.keyCode(code) == code);

    const testShapes = [];
    testShapes.push(0x1, 0x21, 0x31, 0x5a5a); // basic test shapes
    // testShapes.push(0x000f, 0xffff); // test shapes
    // testShapes.push(0x004b, 0xfe1f); // logo and rocket
    // testShapes.push(0x3444); // 5th layer shapes
    // testShapes.push(0x0178, 0x0361); // hat and seat
    // testShapes.push(0x3343, 0x334a, 0x334b); // stack order "10234++++"
    // testShapes.push(0x1625, 0x1629, 0x162c, 0x162d); // stack order "10324++++"
    // testShapes.push(0x3425, 0x342c, 0x342d, 0x343c, 0x34a5, 0x35a1]; // stack order?
    // testShapes.push(0x0361, 0x1361, 0x1634, 0x1b61, 0x36c2); // seat joint
    // testShapes.push(0x17a4, 0x37a4); // multiple solutions: strict logo (depending on search order) and seat joint
    // testShapes.push(0x4da1, 0x8e52); // multiple solutions: strict logo (depending on search order) and seat joint
    // testShapes.push(0x167a); // has 2 2-layer logos, but only 1 is needed - 167a [000a,0007,0012,0004] 0123+++
    // testShapes.push(0x34a5, 0x35a4, 0x525a, 0x785a); // slow for binz 2 logosets w/binary combos
    // testShapes.push(0x4a53, 0x4a59); // slow for binz 3 logosets w/binary combos
    // testShapes.push(0x1e5a, 0x2da5, 0x4b5a, 0x87a5); // slow for binz hamming combos
    // testShapes.push(0x5aa5, 0x1c78, 0x4978); // slow for binz 3 logosets w/hamming
    // testShapes.push(0x35a1, 0xf3a1); // problem shapes for 897701215
    // testShapes.push(0x1361, 0x1569, 0x15c3, 0x19c1); // problem for stacking ORDER0
    // testShapes.push(0x13c, 0x0162, 0x0163, 0x0164, 0x0165); // problem for stacking ORDER0
    // testShapes.push(0x1212, 0x2121); // problem for stacking ORDER0
    // testShapes.push(0x0392, 0x0634, 0x0938, 0x0c68); // stacking order "10+"
    // testShapes.push(0x1578, 0x16d2, 0x1792); // working on Skim design
    // testShapes.push(0x35b4, 0x35e1, 0x3a78, 0x3ad2); // working on Skim design
    // testShapes.push(0x0392, 0x0634, 0x0938, 0x0c68); // testing part order
    // testShapes.push(0x1361, 0x8c68, 0x52c8); // testing part order
    // testShapes.push(0x1569, 0x15c3); // testing part order
    // testShapes.push(0x1e5a, 0x1e5b);
    // testShapes.push(0x0126, 0x012e);
    // testShapes.push(0x1165, 0x1265);
    // testShapes.push(0x34c3);
    // testShapes.push(0x27c2, 0x2bc2);
    // testShapes.push(0x0138, 0x0178, 0x0192, 0x01d2); // Testing ATMAM
    // testShapes.push(0x0121, 0x0125, 0x0129, 0x012d); // Testing ATMAM
    // testShapes.push(0x0178, 0x0185, 0x0187, 0x0192); // Testing ATMAM
    // testShapes.push(0x024a, 0x024b, 0x02b4, 0x0361);
    testShapes.push(0x2cb4);

    // possibleShapes.forEach((code) => unknownShapes.set(code, { code }));
    // complexShapes.forEach((code) => unknownShapes.set(code, { code }));
    // keyShapes.forEach((code) => unknownShapes.set(code, { code }));
    testShapes.forEach((code) => unknownShapes.set(code, { code }));

    console.log("Knowns:", knownShapes.size);
    console.log("Unknowns:", unknownShapes.size);
    console.log("");

    for (let shape of Array.from(unknownShapes.keys())) {
      // let result = false;
      let result = MyTmam.deconstruct1(shape);
      if (!result) {
        console.log("NOT FOUND", Shape.pp(shape));
      } else {
        if (result.parts != undefined) {
          console.log("FOUND", Shape.pp(shape), Shape.pp(result.parts), result.order);
          // console.log(Shape.graphParts(result.parts, result.offsets));
        }
        if (result.ops != undefined) {
          console.log("FOUND", Shape.pp(shape));
          console.log(MyTmam.opsChart(result.ops));
        }
        knownShapes.set(shape, result);
        unknownShapes.delete(shape);
      }
      console.log("");
    }

    console.log("Knowns:", knownShapes.size);
    console.log("Unknowns:", unknownShapes.size);
    console.log(Shape.pp([...unknownShapes.keys()]));
    console.log("");

    let chart;
    const logKnown = false;
    if (logKnown) {
      // Log known builds
      console.log("Saving known builds");
      let data = "";
      for (const [key, value] of knownShapes) {
        // const logoCount = value.logos
        //   .map(
        //     (code) =>
        //       Shape.toLayers(MyTmam.dropLayers(code, MyTmam.bottomLayerNum(code)))
        //         .length
        //   )
        //   .sort((a, b) => a - b);
        data += `${Shape.pp(key)} ${Shape.pp(value.parts)} ${value.extra} ${value.order}`;
        // data += ` ${logoCount}`;
        data += "\n";
      }
      Fileops.writeFile("data/known.txt", data);

      let codes = Array.from(knownShapes.keys());
      const parts = [];
      const offsets = [];
      codes.forEach((code) => (parts[code] = knownShapes.get(code).parts));
      codes.forEach((code) => (offsets[code] = knownShapes.get(code).offsets));
      chart = Shape.chart(codes, parts, offsets);
      Fileops.writeFile("data/chart.txt", chart);
    }

    // Log remaining unknowns
    console.log("Saving chart of unknowns");
    chart = Shape.chart(Array.from(unknownShapes.keys()));
    Fileops.writeFile("data/unknown.txt", chart);
    console.log("");

    const logStats = false;
    if (logStats) {
      console.log("Saving stats");
      let statData = "";
      for (let code = 0; code <= 0xffff; ++code) {
        let logos = MyTmam.stats.logos[code];
        let iters = MyTmam.stats.maxIters[code];
        if (!iters) continue;
        if (iters <= 100) continue;
        statData += `${Shape.pp(code)} ${logos} ${iters}`;
        statData += "\n";
      }
      Fileops.writeFile("data/stats.txt", statData);

      console.log("Stats");
      const maxLogos = MyTmam.stats.logos.reduce((a, v) => Math.max(a, v));
      const maxIters = MyTmam.stats.maxIters.reduce((a, v) => Math.max(a, v));
      const totalMaxIters = MyTmam.stats.maxIters.reduce((a, v) => a + v);
      const aveIters = Number(totalMaxIters / knownShapes.size).toFixed(2);
      const totalIters = MyTmam.stats.iters.reduce((a, v) => a + v);
      const totalCombos = MyTmam.stats.combos.reduce((a, v) => a + v);
      console.log("Max logos:", maxLogos);
      console.log("Max iters:", maxIters);
      console.log("Ave iters:", aveIters);
      console.log("Total max iters:", totalMaxIters);
      console.log("Total iters:", `${totalIters} of ${totalCombos}`);
    }
  }
}
