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
 * - Use a recursive function to search all possible programs.
 * - Store the state on the (Javascript) stack.
 * - State includes: stack history, program, current input (if not input at the start).
 * - All stacks seen in a build sequence (stack history) are kept to check for loops.
 * - If no loop detected, then save the shape on top of stack and current build (program).
 * - After all programs found, then aggregate the shapes and compute counts.
 */

import { Shape } from "./shape.js";
import Parallel from "paralleljs";

const DEFAULT_MAX_LENGTH = 8;

const allShapes = new Map();

const stats = { loops: 0, nodes: 0, prunes: 0, builds: 0 };

class SpuState {
  constructor(prog = "", stack = [], history = []) {
    this.prog = prog;
    this.stack = stack;
    this.history = history;
    this.in = [];
    this.out = [];
    this.maxLength = DEFAULT_MAX_LENGTH;
  }

  toString() {
    return this.prog + " " + Shape.pp(this.stack);
  }

  copy() {
    const result = new SpuState(
      this.prog,
      this.stack.slice(),
      this.history.slice()
    );
    result.maxLength = this.maxLength;
    return result;
  }

  clear() {
    this.prog = "";
    this.stack = [];
    this.history = [];
    this.in = [];
    this.out = [];
  }
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

  static clearState() {
    Spu.state = {
      prog: "",
      stack: [],
      history: [],
      in: [],
      out: [],
      maxLength: Spu.DEFAULT_MAX_LENGTH,
    };
  }

  static init() {
    // Spu.clearState();
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

  static flush(stack) {
    stack.length = 0;
  }

  static input(stack) {
    const code = Spu.state.in.pop();
    stack.push(code);
  }

  static output(stack) {
    if (stack.length < 1) {
      console.error("Output requires 1 entry.");
      return;
    }
    const code = stack.pop();
    Spu.state.out.push(code);
  }

  /**
   * Move item at index to top of stack
   * @param {number} index
   */
  static move(stack, index) {
    if (stack.length < index) {
      console.error("Move requires", index + 1, "entries.");
      return;
    }
    const end = stack.length - 1;
    const items = stack.splice(end - index, 1);
    stack.push(items[0]);
  }

  static left(stack) {
    if (stack.length < 1) {
      console.error("Left requires 1 entry.");
      return;
    }
    const end = stack.length - 1;
    stack[end] = Shape.leftCode(stack[end]);
  }

  static uturn(stack) {
    if (stack.length < 1) {
      console.error("Uturn requires 1 entry.");
      return;
    }
    const end = stack.length - 1;
    stack[end] = Shape.uturnCode(stack[end]);
  }

  static right(stack) {
    if (stack.length < 1) {
      console.error("Right requires 1 entry.");
      return;
    }
    const end = stack.length - 1;
    stack[end] = Shape.rightCode(stack[end]);
  }

  static cut(stack) {
    if (stack.length < 1) {
      console.error("Cut requires 1 entry.");
      return;
    }
    const code = stack.pop();
    const [left, right] = Shape.cutCode(code);
    left != 0 && stack.push(left);
    right != 0 && stack.push(right);
  }

  static stack(stack) {
    if (stack.length < 2) {
      console.error("Stack requires 2 entries.");
      return;
    }
    const top = stack.pop();
    const bottom = stack.pop();
    const code = Shape.stackCode(top, bottom);
    stack.push(code);
  }

  static trash(stack) {
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
  static runStep(op, stack) {
    const BASE_KEYS = Object.keys(Spu.BASE_OPS);
    let opName = "";
    if (BASE_KEYS.includes(op)) {
      opName = Spu.BASE_OPS[op];
      Spu[opName](stack);
    } else if (Spu.MOVE_OPS.includes(op)) {
      opName = "move";
      const index = Spu.MOVE_OPS.indexOf(op);
      Spu[opName](stack, index);
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
    console.log("");
    console.log("Program:", prog);
    console.log("Input:", Shape.pp(Spu.state.in));
    console.log("");

    const stack = Spu.state.stack;
    for (let op of prog) {
      const opName = Spu.runStep(op, stack);
      console.log(op, opName.padEnd(8), Shape.pp(stack));
    }
  }

  /**
   * Recursive search for shapes
   * @param {SpuState} state
   */
  static search(state) {
    const stackLen = state.stack.length;
    // if stack is empty, return
    if (stackLen == 0) {
      return;
    }
    stats.nodes++;

    const stackStr = Shape.pp(state.stack);
    const seen = state.history.includes(stackStr);
    // display state
    if (stats.nodes % 10000000 == 0) {
      console.log(stats.nodes, state.prog, stackStr, seen ? "" : "NEW");
    }

    // loop detection - if this state has been seen before, return
    if (seen) {
      stats.loops++;
      return;
    }
    // else store the state
    state.history.push(stackStr);

    // store shape on top of stack
    const prog = state.prog + "O";
    const code = state.stack[state.stack.length - 1];
    const oldProg = allShapes.get(code);
    if (oldProg == undefined || prog.length < oldProg.length) {
      allShapes.set(code, prog);
    }
    stats.builds++;

    // if program exceeds max length, return
    if (state.prog.length + 1 >= state.maxLength) {
      stats.prunes++;
      return;
    }

    let lastOp = state.prog.slice(-1);
    let prevOp = state.prog.slice(-2, -1);
    const ops = [];

    // Try rotate - max 1
    if (!Spu.ROTATE_OPS.includes(lastOp)) {
      for (let op of Spu.ROTATE_OPS) {
        ops.push(op);
      }
    }

    // Try cut
    ops.push("C");

    // Try stack
    if (stackLen >= 2) {
      ops.push("S");
    }

    // Try trash
    if (stackLen >= 2) {
      ops.push("X");
    }

    // Try move - max 2
    if (
      state.prog.length > 1 &&
      !(Spu.MOVE_OPS.includes(lastOp) && Spu.MOVE_OPS.includes(prevOp))
    ) {
      for (let i = 1; i < stackLen; i++) {
        ops.push(Spu.MOVE_OPS[i]);
      }
    }

    // run each op
    for (let op of ops) {
      const newState = state.copy();
      this.runStep(op, newState.stack);
      newState.prog += op;
      this.search(newState);
      newState.clear(); // attempt to save memory
    }
  }

  static runSearch() {
    const DATA = [0xf, 0xf];
    const MAX_LENGTH = 14;

    Spu.init();
    const state = Spu.state;
    state.maxLength = MAX_LENGTH;

    console.log("");
    console.log("Searching for shapes...");
    console.log("Max program length:", MAX_LENGTH);
    console.log("Input data:", Shape.pp(DATA));

    // insert all input data
    Spu.setInput(DATA);
    for (let i = 0; i < DATA.length; i++) {
      state.prog += "I";
      Spu.input(state.stack);
    }

    // start the search
    const startTime = Date.now();
    Spu.search(state);
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

    console.log("\nUnique shapes");
    const keys = Array.from(unique.keys()).sort((a, b) => a - b);
    for (let key of keys) {
      console.log(Shape.pp(key), JSON.stringify(unique.get(key)));
    }

    const width = 10;
    console.log("\nStats");
    console.log("Nodes: ", stats.nodes.toString().padStart(width));
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
    console.log("Max steps:       ", MAX_LENGTH - DATA.length - 1);
    console.log("Shapes found:    ", allShapes.size);
    console.log("Unique shapes:   ", unique.size);

    // look for Logo
    console.log("");
    const logoCode = 0x4b;
    const prog = allShapes.get(logoCode);
    if (prog == undefined) {
      console.log("Logo not found");
    } else {
      console.log("Logo", Shape.pp(logoCode), prog);
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

    DATA = [0xf, 0xf];
    PROG = "IICR2CLSSC2SUOF";
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
  }
}
