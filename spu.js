/***
 *
 * SPU - State-based Shape Processing Unit
 *
 * Instructions
 *        F - flush stack
 *        I - input
 *        O - ouput
 *      <n> - move shape at index <n> to top of stack
 *    L,U,R - rotate 90, 180, 270
 *        C - cut
 *        S - stack
 *        X - trash
 *
 * Search for shapes
 * - Input: A string of shapes, probably use full one-layer shapes.
 * - Output: List all shapes (codes) that can be made with the input. (possible shapes)
 * - For each possible/canonical shape, list all programs that can build that shape.
 * - Highlight the shortest program.
 * - Count number of possible shapes.
 * - Count number of canonical shapes (key codes).
 * Example
 * - How many (possible) shapes can be made with 4 pieces (one full layer)?
 * - How many unique (canonical) shapes?
 * Secondary
 * - How many different ways to make Logo?
 * - What's the shortest program to do so?
 * Issues
 * - How to measure cost of build?  length of program?  with/without move instructions?
 * - What if cut and/or stack works with ouput / input in the reverse order?
 *
 * Plan
 * - State includes: stack history, program, current input (if not input at the start).
 * - All stacks seen in a build sequence (stack history) are kept to check for loops.
 * - If no loop detected, then save the shape on top of stack and current build (program).
 * - After all programs found, then aggregate the shapes and compute counts.
 */

import { Shape } from "./shape.js";
import Parallel from "paralleljs";

const allShapes = new Map();

class SpuState {
  constructor() {
    this.init();
  }

  init() {
    this.in = [];
    this.out = [];
    this.prog = "";
    this.stack = [];
    this.history = [];
  }

  toString() {
    return this.prog + " " + Shape.pp(this.stack);
  }

  // copy() {
  //   const result = new SpuState();
  //   result.in = this.in.slice();
  //   result.out = this.out.slice();
  //   result.prog = this.prog;
  //   result.stack = this.stack.slice();
  //   result.history = this.history.slice();
  //   return result;
  // }
}

export class Spu {
  static BASE_OPS = {
    F: "flush",
    I: "input",
    O: "output",
    L: "left",
    U: "uturn",
    R: "right",
    C: "cut",
    S: "stack",
    X: "trash",
  };
  static ROTATE_OPS = "LUR";
  static MOVE_OPS = "0123456789abcdef";

  static state = new SpuState();

  static init() {
    Spu.state.init();
  }

  /**
   * @param {Array} data
   */
  static setInput(data) {
    Spu.state.in = data.slice().reverse();
  }

  static getOutput() {
    return Spu.state.out.pop();
  }

  static flush(state) {
    state.stack.length = 0;
  }

  static input(state) {
    const code = state.in.pop();
    state.stack.push(code);
  }

  static output(state) {
    const stack = state.stack;
    if (stack.length < 1) {
      console.error("Output requires 1 entry.");
      return;
    }
    const code = stack.pop();
    state.out.push(code);
  }

  /**
   * Move item at index to top of stack
   * @param {number} index
   */
  static move(state, index) {
    const stack = state.stack;
    const stackLen = stack.length;
    if (stackLen < index) {
      console.error("Move requires", index + 1, "entries.");
      return;
    }
    const end = stackLen - 1;
    const items = stack.splice(end - index, 1);
    stack.push(items[0]);
  }

  static left(state) {
    const stack = state.stack;
    const stackLen = stack.length;
    if (stackLen < 1) {
      console.error("Left requires 1 entry.");
      return;
    }
    const end = stackLen - 1;
    stack[end] = Shape.leftCode(stack[end]);
  }

  static uturn(state) {
    const stack = state.stack;
    const stackLen = stack.length;
    if (stackLen < 1) {
      console.error("Uturn requires 1 entry.");
      return;
    }
    const end = stackLen - 1;
    stack[end] = Shape.uturnCode(stack[end]);
  }

  static right(state) {
    const stack = state.stack;
    const stackLen = stack.length;
    if (stackLen < 1) {
      console.error("Right requires 1 entry.");
      return;
    }
    const end = stackLen - 1;
    stack[end] = Shape.rightCode(stack[end]);
  }

  static cut(state) {
    const stack = state.stack;
    if (stack.length < 1) {
      console.error("Cut requires 1 entry.");
      return;
    }
    const code = stack.pop();
    const [left, right] = Shape.cutCode(code);
    left != 0 && stack.push(left);
    right != 0 && stack.push(right);
  }

  static stack(state) {
    const stack = state.stack;
    if (stack.length < 2) {
      console.error("Stack requires 2 entries.");
      return;
    }
    const top = stack.pop();
    const bottom = stack.pop();
    const code = Shape.stackCode(top, bottom);
    stack.push(code);
  }

  static trash(state) {
    const stack = state.stack;
    if (stack.length < 1) {
      console.error("Trash requires 1 entry.");
      return;
    }
    stack.pop();
  }

  /**
   * Run a program step
   * @param {String} op
   * @param {Array} stack
   */
  static runStep(state, op) {
    const BASE_KEYS = Object.keys(Spu.BASE_OPS);
    let opName = "";
    if (BASE_KEYS.includes(op)) {
      opName = Spu.BASE_OPS[op];
      Spu[opName](state);
    } else if (Spu.MOVE_OPS.includes(op)) {
      opName = "move";
      const index = Spu.MOVE_OPS.indexOf(op);
      Spu[opName](state, index);
    } else {
      console.error("Unknown operation:", op);
      return;
    }
    return opName;
  }

  /**
   * Run a program
   * @param {String} prog
   */
  static run(prog) {
    const state = Spu.state;
    console.log("Program:", prog);
    console.log("Input:", Shape.pp(state.in));
    console.log("");

    for (let op of prog) {
      const opName = Spu.runStep(state, op);
      console.log(op, opName.padEnd(8), Shape.pp(state.stack));
    }
  }

  /**
   * Search for shapes
   * Takes the current state, determines what transitions are possible, and produces a list of new states.
   * The intent is to make this purely functional (no side effects) so that it can be used in parallel.
   * @param {SpuState} state
   */
  static search(state) {
    const result = { states: [], loop: false };
    const prog = state.prog;
    const stack = state.stack;
    const stackLen = stack.length;
    const ops = [];

    const stackStr = Shape.pp(state.in) + " " + Shape.pp(stack);
    const history = state.history;
    const seen = history.includes(stackStr);
    // loop detection - if this state has been seen before, return
    if (seen) {
      result.loop = true;
      return result;
    }
    // else update history
    history.push(stackStr);

    // if stack is empty, return
    if (stackLen == 0) {
      return result;
    }
    // input
    if (state.in.length > 0) {
      ops.push("I");
    }
    // cut
    ops.push("C");

    // rotate - max 1
    const lastOp = prog.slice(-1);
    if (!Spu.ROTATE_OPS.includes(lastOp)) {
      for (let op of Spu.ROTATE_OPS) {
        ops.push(op);
      }
    }

    if (stackLen >= 2) {
      // trash
      ops.push("X");
      // stack
      ops.push("S");
      // move - max 2
      const prevOp = prog.slice(-2, -1);
      if (!(Spu.MOVE_OPS.includes(lastOp) && Spu.MOVE_OPS.includes(prevOp))) {
        for (let i = 1; i < stackLen; i++) {
          ops.push(Spu.MOVE_OPS[i]);
        }
      }
    }

    // run each op
    for (let op of ops) {
      //const newState = state.copy();
      const newState = new SpuState();
      newState.in = state.in.slice();
      newState.out = state.out.slice();
      newState.prog = state.prog + op;
      newState.stack = state.stack.slice();
      newState.history = history;
      Spu.runStep(newState, op);
      result.states.push(newState);
      //state.init();  // help free memory?
    }
    return result;
  }

  static searchAsync(state) {
    return new Promise((resolve) => {
      resolve(Spu.search(state));
    });
  }

  static saveShape(state) {
    // Ouput shape on top of stack
    const stack = state.stack;
    const stackLen = stack.length;
    const code = stack[stackLen - 1];
    const prog = state.prog + "O";
    // console.log("Shape:", Shape.pp(code), prog);

    const oldProg = allShapes.get(code);
    if (oldProg == undefined || prog.length < oldProg.length) {
      allShapes.set(code, prog);
    }
  }

  static async runSearch() {
    const DATA = [0xf, 0xf, 0xf, 0xf];
    const MAX_LENGTH = 8;
    const states = [];
    const stats = { calls: 0, loops: 0, prunes: 0, builds: 0 };

    Spu.init();

    console.log("Searching for shapes...");
    console.log("Max program length:", MAX_LENGTH);
    console.log("Input data:", Shape.pp(DATA));
    console.log("");

    const startTime = Date.now();

    // set initial state with one input
    Spu.setInput(DATA);
    Spu.state.prog = "I";
    Spu.input(Spu.state);
    Spu.saveShape(Spu.state);
    stats.builds++;

    // start the search
    states.push(Spu.state);

    const MAX_STATES = 10;
    while (states.length > 0) {
      const numStates = Math.min(states.length, MAX_STATES);
      stats.calls += numStates;
      const inStates = states.splice(-numStates);
      if (stats.calls % 100 < numStates) {
        console.log(
          stats.calls.toString().padStart(10),
          (states.length + numStates).toString().padStart(6),
          inStates[0].toString()
        );
      }
      // console.log("Input state");
      // console.log(state.toString());
      const p = new Parallel(inStates);
      // p.require("./shape.js");
      // p.require("./spu.js");
      p.require(Shape);
      p.require(SpuState);
      p.require(Spu);
      const results = await p.map((v) => Spu.search(v));
      // const results = await Promise.all(
      //   inStates.map((s) => Spu.searchAsync(s))
      // );
      // console.log("Output states");
      // result.states.map((v) => console.log(v.toString()));
      for (let result of results) {
        if (result.loop) {
          stats.loops++;
          continue;
        }
        for (let state of result.states) {
          Spu.saveShape(state);
          stats.builds++;
          // if program exceeds max length, return
          if (state.prog.length + 1 >= MAX_LENGTH) {
            stats.prunes++;
            continue;
          }
          const newState = new SpuState();
          newState.in = state.in.slice();
          newState.out = state.out.slice();
          newState.prog = state.prog;
          newState.stack = state.stack.slice();
          newState.history = state.history.slice();
          states.push(newState);
        }
      }
    }

    const endTime = Date.now();

    // aggregate results
    let numPieces = 0;
    for (let item of DATA) {
      for (let bit of item.toString(2)) {
        if (bit == 1) numPieces++;
      }
    }
    const unique = new Map();
    for (let [code, prog] of allShapes.entries()) {
      const keyCode = Shape.keyCode(code);
      const progList = unique.get(keyCode);
      if (progList == undefined) {
        unique.set(keyCode, [prog]);
      } else {
        progList.push(prog);
      }
    }

    console.log("Unique shapes");
    const keys = Array.from(unique.keys()).sort((a, b) => a - b);
    for (let key of keys) {
      console.log(Shape.pp(key), JSON.stringify(unique.get(key)));
    }

    const width = 10;
    console.log("\nStats");
    console.log("Calls: ", stats.calls.toString().padStart(width));
    console.log("Builds:", stats.builds.toString().padStart(width));
    console.log("Loops: ", stats.loops.toString().padStart(width));
    console.log("Prunes:", stats.prunes.toString().padStart(width));
    console.log(
      "Time:  ",
      ((endTime - startTime) / 1000).toString().padStart(width),
      "seconds"
    );

    console.log("\nResults");
    console.log("Input data:      ", Shape.pp(DATA));
    console.log("Number of pieces:", numPieces);
    console.log("Max steps:       ", MAX_LENGTH - 2);
    console.log("Shapes found:    ", allShapes.size);
    console.log("Unique shapes:   ", unique.size);

    let prog;
    // look for Logo
    console.log("");
    const logoCode = 0x004b;
    prog = allShapes.get(logoCode);
    if (prog == undefined) {
      console.log("Logo not found");
    } else {
      console.log("Logo", Shape.pp(logoCode), prog);
    }

    // look for Rocket
    console.log("");
    const rocketCode = 0xfe1f;
    prog = allShapes.get(rocketCode);
    if (prog == undefined) {
      console.log("Rocket not found");
    } else {
      console.log("Rocket", Shape.pp(rocketCode), prog);
    }
  }

  static runTests() {
    let DATA, PROG, EXP;
    let code, shape, pass;

    DATA = [0xf, 0xf];
    PROG = "ICLCRS1LSCXIC1XSO";
    EXP = "RrRr--Rr:----Rg--:--------:--------";
    Spu.init();
    Spu.setInput(DATA);
    Spu.run(PROG);
    code = Spu.getOutput();
    shape = Shape.toShape(code);
    console.log("\nOutput:", shape);
    pass = shape == EXP;
    console.log("Test", pass ? "PASS" : "FAIL");
    if (!pass) {
      console.log("  expected:", EXP);
    }
    console.log("");

    DATA = [0xf, 0xf];
    // PROG = "ICRICLSSC2SUOF";
    PROG = "ICLICRSSC2SROF";
    EXP = "RrRr--Rr:----Rg--:--------:--------";
    Spu.init();
    Spu.setInput(DATA);
    Spu.run(PROG);
    code = Spu.getOutput();
    shape = Shape.toShape(code);
    console.log("\nOutput:", shape);
    pass = shape == EXP;
    console.log("Test", pass ? "PASS" : "FAIL");
    if (!pass) {
      console.log("  expected:", EXP);
    }
    console.log("");
  }
}
