/***
 * Shape Processing Unit (SPU)
 * Author: Garret Simpson
 *
 * Created for Shapez.io: https://github.com/tobspr/shapez.io
 *
 */

import { Shape } from "./shape.js";
import { Spu } from "./spu.js";
import { Ops } from "./ops.js";
import { MyTmam } from "./mytmam0.js";

const APP_NAME = "Shape Processing Tools";

function main() {
  console.log(APP_NAME);
  console.log(Date());
  console.log("");

  // Shape.runTests();
  // Shape.testAllShapes();
  // Shape.testPerf();
  // Shape.testLogo();
  // Spu.runTests();
  // Spu.runSearch();
  // Ops.runMultiOps();
  // Ops.dbToText("data/db_no5.bin");
  MyTmam.test();
}

main();
