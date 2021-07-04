/***
 * Shape Processing Unit (SPU)
 * Author: Garret Simpson
 *
 * Created for Shapez.io: https://github.com/tobspr/shapez.io
 *
 */

import { Shape } from "./shape.js";

const APP_NAME = "Shape Processing Unit 0.1";

function main() {
  console.log(APP_NAME);
  console.log(Date());
  console.log();

  Shape.runTests();
  Shape.testLogo();
}

main();