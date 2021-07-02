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
const FULL_RECT = "RuRuRuRu";
const LOGO = "RuCw--Cw:----Ru--";
const ROCKET = "CbCuCbCu:Sr------:--CrSrCr:CwCwCwCw";

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

    let code = 0x4321;
    console.debug(codeToHex(code), codeToShape(code));
    code = baseCode(code);
    console.debug(codeToHex(code), codeToShape(code));
}

main();
