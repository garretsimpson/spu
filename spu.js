/***
 *
 * SPU - This is a state-based Shape Processing Unit
 *
 * Instructions
 *        F - flush state
 *        I - input
 *        O - ouput
 *      <n> - move shape at index <n> to top of state
 *    L,U,R - rotate 90, 180, 270
 *        C - cut
 *        S - state
 *        X - trash
 */

import { Shape } from "./shape.js";

export class Spu {
  // TODO: Use regex
  static OPS = {
    F: "flush",
    I: "input",
    O: "output",
    1: "swap",
    L: "left",
    U: "uturn",
    R: "right",
    C: "cut",
    S: "stack",
    X: "trash",
  };

  constructor() {
    this.state = [];
    this.in = [];
    this.out = [];
  }

  /**
   * @param {Array} data
   */
  setInput(data) {
    this.in = data.reverse();
  }

  flush() {
    this.state.length = 0;
  }

  input() {
    const shape = new Shape(this.in.pop());
    this.state.push(shape);
  }

  output() {
    if (this.state.length < 1) {
      console.error("Output requires 1 entry.");
      return;
    }
    const shape = this.state.pop();
    this.out.push(shape);
  }

  swap() {
    if (this.state.length < 2) {
      console.error("Swap requires 2 entries.");
      return;
    }
    const end = this.state.length - 1;
    const temp = this.state[end];
    this.state[end] = this.state[end - 1];
    this.state[end - 1] = temp;
  }

  left() {
    if (this.state.length < 1) {
      console.error("Left requires 1 entry.");
      return;
    }
    const end = this.state.length - 1;
    this.state[end] = this.state[end].left();
  }

  uturn() {
    if (this.state.length < 1) {
      console.error("Uturn requires 1 entry.");
      return;
    }
    const end = this.state.length - 1;
    this.state[end] = this.state[end].uturn();
  }

  right() {
    if (this.state.length < 1) {
      console.error("Right requires 1 entry.");
      return;
    }
    const end = this.state.length - 1;
    this.state[end] = this.state[end].right();
  }

  cut() {
    if (this.state.length < 1) {
      console.error("Cut requires 1 entry.");
      return;
    }
    const shape = this.state.pop();
    const [left, right] = shape.cut();
    this.state.push(left);
    this.state.push(right);
  }

  stack() {
    if (this.state.length < 2) {
      console.error("Stack requires 2 entries.");
      return;
    }
    const top = this.state.pop();
    const bottom = this.state.pop();
    const shape = bottom.stack(top);
    this.state.push(shape);
  }

  trash() {
    if (this.state.length < 1) {
      console.error("Trash requires 1 entry.");
      return;
    }
    this.state.pop();
  }

  run(prog) {
    console.log("Program:", prog);
    console.log("Input:", Shape.pp(this.in));
    console.log("");

    for (let op of prog) {
      this[Spu.OPS[op]]();
      console.log(op, Spu.OPS[op].padEnd(8), Shape.pp(this.state));
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
      console.log("  expected", EXP);
    }
  }
}
