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
 */

import { Shape } from "./shape.js";

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

  static MOVE_OPS = "0123456789";

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

  /**
   * Move item at index to top of stack
   * @param {number} index
   */
  move(index) {
    if (this.state.length < index) {
      console.error("Move requires", index, "entries.");
      return;
    }
    const end = this.state.length - 1;
    const items = this.state.splice(end - index, 1);
    this.state.push(items[0]);
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
