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

const allShapes = new Map();

class SpuState {
  constructor(prog = "", stack = [], history = []) {
    this.prog = prog;
    this.stack = stack;
    this.history = history;
  }

  toString() {
    return this.prog + " " + Shape.pp(this.stack);
  }

  copy() {
    return new SpuState(this.prog, this.stack.slice(), this.history.slice());
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
  static MOVE_OPS = "0123456789";

  static MAX_LENGTH = 10;

  constructor() {
    this.in = [];
    this.out = [];
    this.state = [];
  }

  /**
   * @param {Array} data
   */
  setInput(data) {
    this.in = data.slice().reverse();
  }

  flush() {
    this.state.length = 0;
  }

  input(stack) {
    const shape = new Shape(this.in.pop());
    stack.push(shape);
  }

  output(stack) {
    if (stack.length < 1) {
      console.error("Output requires 1 entry.");
      return;
    }
    const shape = stack.pop();
    this.out.push(shape);
  }

  /**
   * Move item at index to top of stack
   * @param {number} index
   */
  move(stack, index) {
    if (stack.length < index) {
      console.error("Move requires", index + 1, "entries.");
      return;
    }
    const end = stack.length - 1;
    const items = stack.splice(end - index, 1);
    stack.push(items[0]);
  }

  left(stack) {
    if (stack.length < 1) {
      console.error("Left requires 1 entry.");
      return;
    }
    const end = stack.length - 1;
    stack[end] = stack[end].left();
  }

  uturn(stack) {
    if (stack.length < 1) {
      console.error("Uturn requires 1 entry.");
      return;
    }
    const end = stack.length - 1;
    stack[end] = stack[end].uturn();
  }

  right(stack) {
    if (stack.length < 1) {
      console.error("Right requires 1 entry.");
      return;
    }
    const end = stack.length - 1;
    stack[end] = stack[end].right();
  }

  cut(stack) {
    if (stack.length < 1) {
      console.error("Cut requires 1 entry.");
      return;
    }
    const shape = stack.pop();
    const [left, right] = shape.cut();
    left.code != 0 && stack.push(left);
    right.code != 0 && stack.push(right);
  }

  stack(stack) {
    if (stack.length < 2) {
      console.error("Stack requires 2 entries.");
      return;
    }
    const top = stack.pop();
    const bottom = stack.pop();
    const shape = bottom.stack(top);
    stack.push(shape);
  }

  trash(stack) {
    if (stack.length < 1) {
      console.error("Trash requires 1 entry.");
      return;
    }
    stack.pop();
  }

  /**
   * Run a program
   * @param {String} prog
   */
  run(prog) {
    console.log("Program:", prog);
    console.log("Input:", Shape.pp(this.in));
    console.log("");

    const BASE_KEYS = Object.keys(Spu.BASE_OPS);
    let opName = "";
    for (let op of prog) {
      if (BASE_KEYS.includes(op)) {
        opName = Spu.BASE_OPS[op];
        this[opName]();
      } else if (Spu.MOVE_OPS.includes(op)) {
        opName = "move";
        const index = Spu.MOVE_OPS.indexOf(op);
        this[opName](index);
      } else {
        console.error("Unknown operation:", op);
        return;
      }
      console.log(op, opName.padEnd(8), Shape.pp(this.state));
    }
  }

  /**
   * Recursive search for shapes
   * @param {SpuState} state
   */
  search(state) {
    // if stack is empty, return
    const stackLen = state.stack.length;
    if (stackLen == 0) {
      return;
    }

    // if program exceeds max length, return
    if (state.prog.length > Spu.MAX_LENGTH) {
      console.log("Max length exceeded");
      return;
    }

    const stackStr = Shape.pp(state.stack);
    const seen = state.history.includes(stackStr);
    // display state
    console.log("state:", state.toString(), seen ? "" : "NEW");

    // loop detection - if this state has been seen before, return
    if (seen) {
      return;
    }
    // else store the state
    state.history.push(stackStr);

    // store shape on top of stack
    const prog = state.prog + "O";
    // TODO: Put this stuff in a function
    const shape = state.stack[state.stack.length - 1];
    const code = shape.code;
    const progList = allShapes.get(code);
    if (progList == undefined) {
      allShapes.set(code, [prog]);
    } else {
      progList.push(prog);
    }

    let newState;
    let lastOp = state.prog.slice(-1);

    // Try rotate - only one of each
    if (!Spu.ROTATE_OPS.includes(lastOp)) {
      newState = state.copy();
      newState.prog += "R";
      this.right(newState.stack);
      this.search(newState);

      newState = state.copy();
      newState.prog += "U";
      this.uturn(newState.stack);
      this.search(newState);

      newState = state.copy();
      newState.prog += "L";
      this.left(newState.stack);
      this.search(newState);
    }

    // Try cut
    newState = state.copy();
    newState.prog += "C";
    this.cut(newState.stack);
    this.search(newState);

    // Try stack
    if (stackLen >= 2) {
      newState = state.copy();
      newState.prog += "S";
      this.stack(newState.stack);
      this.search(newState);
    }

    // Try trash
    if (stackLen >= 2) {
      newState = state.copy();
      newState.prog += "X";
      this.trash(newState.stack);
      this.search(newState);
    }

    // Try move
    for (let i = 1; i < stackLen; i++) {
      newState = state.copy();
      newState.prog += String(i);
      this.move(newState.stack, i);
      this.search(newState);
    }

    // TODO: Delete current state to save memory?
  }

  static runSearch() {
    const DATA = [0xf, 0xf];
    const spu = new Spu();
    const state = new SpuState();

    console.log("Max program length:", Spu.MAX_LENGTH);
    console.log("Input data:", Shape.pp(DATA));
    console.log("");

    // insert all input data
    spu.setInput(DATA);
    const len = DATA.length;
    for (let i = 0; i < len; i++) {
      state.prog += "I";
      spu.input(state.stack);
    }

    // start the search
    spu.search(state);

    // Aggregate results
    let numPieces = 0;
    for (let item of DATA) {
      for (let bit of item.toString(2)) {
        if (bit == 1) numPieces++;
      }
    }
    const unique = new Map();
    for (let [code, progList] of allShapes.entries()) {
      const shape = new Shape(code);
      const keyCode = shape.keyCode();
      let shortProg = unique.get(keyCode);
      for (let prog of progList) {
        if (shortProg == undefined || prog.length < shortProg.length) {
          shortProg = prog;
        }
      }
      unique.set(keyCode, shortProg);
    }

    // display results
    console.log("\nShapes");
    const codes = Array.from(allShapes.keys()).sort((a, b) => a - b);
    for (let code of codes) {
      const shape = new Shape(code);
      console.log(
        Shape.pp(code),
        Shape.pp(shape.keyCode()),
        allShapes.get(code).length.toString().padStart(4)
      );
    }

    console.log("");
    console.log("Input data:", Shape.pp(DATA));
    console.log("Max steps:", Spu.MAX_LENGTH - DATA.length);
    console.log("Number of pieces:", numPieces);
    console.log("Shapes found:", allShapes.size);
    console.log("Unique shapes:", unique.size);

    console.log("\nUnique shapes");
    const keys = Array.from(unique.keys()).sort((a, b) => a - b);
    for (let key of keys) {
      console.log(Shape.pp(key), JSON.stringify(unique.get(key)));
    }
  }

  static runTests() {
    const DATA = [0xf, 0xf];
    const PROG = "ICLCRS1LSCXIC1XSO";
    const EXP = "RrRr--Rr:----Rg--:--------:--------";

    const spu = new Spu();
    spu.setInput(DATA);
    spu.run(PROG);

    const shape = spu.out.pop();
    console.log("\nOutput:", shape.toString());

    const pass = shape.toString() == EXP;
    console.log("Test", pass ? "PASS" : "FAIL");
    if (!pass) {
      console.log("  expected:", EXP);
    }
  }
}
