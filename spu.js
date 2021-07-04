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

  flush() {
    this.state.length = 0;
  }

  input() {
    // Default input shape code
    const CODE = 0x000f;
    this.state.push(new Shape(CODE));
  }

  output() {
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
    const end = this.state.length - 1;
    this.state[end] = this.state[end].left();
  }

  uturn() {
    const end = this.state.length - 1;
    this.state[end] = this.state[end].uturn();
  }

  right() {
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
    for (let op of prog) {
      this[Spu.OPS[op]]();
      console.log(op, Spu.OPS[op], Shape.pp(this.state));
    }
  }

  static runTests() {
    const PROG = "ICLCRS1LSCXIC1XSO";
    const EXP = "RrRr--Rr:----Rg--:--------:--------";

    const spu = new Spu();
    spu.run(PROG);

    const shape = spu.out.pop();
    console.log("\n>>>", shape.toString());
  }
}
