/***
 * Shape Processing Unit (SPU)
 * Author: Garret Simpson
 *
 * Created for Shapez.io: https://github.com/tobspr/shapez.io
 *
 */

import { Shape } from "./shape.js";
import { Shape2 } from "./shape2.js";
import { Spu } from "./spu.js";
import { Ops } from "./ops.js";
import { MyTmam } from "./mytmam.js";

const APP_NAME = "Shape Processing Tools";

function main() {
  console.log(APP_NAME);
  console.log(Date());
  console.log("");

  Shape.runTests();
  // Shape2.runTests();
  // Shape.testAllShapes();
  // Shape.testPerf();
  // Shape.testLogo();
  // Shape.countParts();
  // Shape.testChart();
  // Spu.runTests();
  // Spu.runSearch();
  Ops.runMultiOps();
  // Ops.dbToText("data/db_no5.bin");
  // MyTmam.test();
  // MyTmam.run();
}

main();
