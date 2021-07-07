/***
 * Shape Processing Unit (SPU)
 * Author: Garret Simpson
 *
 * Created for Shapez.io: https://github.com/tobspr/shapez.io
 *
 */

import { Shape } from "./shape.js";
import { Spu } from "./spu.js";

const APP_NAME = "Shape Processing Unit 0.1";

function main() {
  console.log(APP_NAME);
  console.log(Date());

  // Shape.runTests();
  // Shape.testPerf();
  // Shape.testLogo();
  Spu.runTests();
  Spu.runSearch();
}

main();
