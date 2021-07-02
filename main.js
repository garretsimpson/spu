//
// Shape Processing Unit
// Author: Garret Simpson
//
// Created for Shapez.io: https://github.com/tobspr/shapez.io
//

const APP_NAME = "Shape Processing Unit 0.1";

const CIRC = "C";
const RECT = "R";
const STAR = "S";
const WIND = "W";

const FULL_CIRC = "CuCuCuCu";
const HALF_RECT = "RuRu----";
const LOGO = "RuCw--Cw:----Ru--";  // 0x004B
const ROCKET = "CbCuCbCu:Sr------:--CrSrCr:CwCwCwCw";  // 0xFE1F

function codeToHex(code) {
    const hex = code.toString(16).padStart(4, "0");
    return "0x" + hex;
}

/**
 * Convert shape code to a shapez constant value.
 * Uses a fixed shape for each piece and a different color for each layer.
 * @param {Number} code
 * @returns {String}
 */
function codeToShape(code) {
    const COLORS = ['r', 'g', 'b', 'y'];
    const SHAPE = RECT;
    const EMPTY = "--";
    const SEP = ":";

    const bin = code.toString(2).padStart(16, "0");
    let result = "";
    for (let i = 0; i < 16; i++) {
        let val = EMPTY;
        if (bin[15 - i] == 1) {
            const layer = Math.trunc(i / 4);
            const color = COLORS[layer];
            val = SHAPE + color;
        }
        if (i == 4 || i == 8 || i == 12) {
            result += SEP;
        }
        result += val;
    }
    return result;
}

function baseCode(code) {
    let fcode = flip(code);
    let result = Math.min(code, fcode);

    for (let i = 1; i < 4; i++) {
        result = Math.min(result, rotate(code, i));
        result = Math.min(result, rotate(fcode, i));
    }
    return result;
}

function rotate(code, steps) {
    const lShift = steps & 0x3;
    const rShift = 4 - lShift;
    const mask = (0xF >>> rShift) * 0x1111;
    const result = (code >>> rShift & mask) | (code << lShift & ~mask & 0xFFFF);
    return result;
}

function right(code) {
    return rotate(code, 1);
}

function uturn(code) {
    return rotate(code, 2);
}

function left(code) {
    return rotate(code, 3);
}

function flip(code) {
    let result = 0;
    for (let i = 0; i < 4; i++) {
        result = result << 1 | (code & 0x1111);
        code >>>= 1;
    }
    return result;
}

function main() {
    console.log(APP_NAME);
    console.log(Date());
    console.log();

    runTests();

    let code = 0x4321;
    console.debug(codeToHex(code), codeToShape(code));
    code = baseCode(code);
    console.debug(codeToHex(code), codeToShape(code));
}

function runTests() {
    const TESTS = [
        [left, 0x0001, 0x0008],
        [right, 0x0001, 0x0002],
        [uturn, 0x0001, 0x0004],
        [left, 0x1248, 0x8124],
        [flip, 0x1234, 0x84C2],
    ];

    let testNum = 0;
    for (const [op, arg, exp] of TESTS) {
        testNum++;
        const result = op(arg);
        const pass = (result == exp);
        console.log("#" + testNum, pass ? "PASS" : "FAIL", op.name + "(" + codeToHex(arg) + ") returned", codeToHex(result));
        if (!pass) {
            console.log("  expected", codeToHex(exp));
            console.log(codeToHex(arg), codeToShape(arg));
            console.log(codeToHex(result), codeToShape(result));
            console.log(codeToHex(exp), codeToShape(exp));
        }
    }
}

main();
