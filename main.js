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

function keyCode(code) {
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
        result = (result << 1) | (code & 0x1111);
        code >>>= 1;
    }
    return result;
}

function cut(code) {
    let left = 0;
    let right = 0;
    let val = 0;

    // remove empty layers
    for (let i = 0; i < 4; i++) {
        val = code & 0x3000;
        if (val != 0) {
            left = (left << 4) | (val >>> 12);
        }
        val = code & 0xC000;
        if (val != 0) {
            right = (right << 4) | (val >>> 12);
        }
        code <<= 4;
    }
    return [left, right];
}

function main() {
    console.log(APP_NAME);
    console.log(Date());
    console.log();

    runTests();
}

// pretty print
function pp(value) {
    if (typeof value === "number") {
        return codeToHex(value);
    }
    if (typeof value === "object" && Array.isArray(value)) {
        return '[' + value.map(v => pp(v)).join() + ']';
    }
    return JSON.stringify(value);
}

function runTests() {
    const TESTS = [
        [left, 0x0001, 0x0008],
        [right, 0x0001, 0x0002],
        [uturn, 0x0001, 0x0004],
        [left, 0x1248, 0x8124],
        [flip, 0x1234, 0x84C2],
        [keyCode, 0x4321, 0x1624],
        [codeToShape, 0x004B, "RrRr--Rr:----Rg--:--------:--------"],
        [cut, 0x5AFF, [0x1233, 0x48CC]],
        [cut, 0x936C, [0x0132, 0x084C]],
    ];

    let testNum = 0;
    for (let [op, arg, exp] of TESTS) {
        testNum++;
        let result = op(arg);
        const pass = (JSON.stringify(result) == JSON.stringify(exp));

        console.log("#" + testNum, pass ? "PASS" : "FAIL", op.name + "(" + pp(arg) + ") returned", pp(result));
        if (!pass) {
            console.log("  expected", pp(exp));
            // console.log(codeToHex(arg), codeToShape(arg));
            // console.log(codeToHex(result), codeToShape(result));
            // console.log(codeToHex(exp), codeToShape(exp));
        }
    }
}

main();
