let MAX = 256;
let PAD = 4;

let x, y, value, result = '';
for (y = 1; y<=MAX; y*=3) {
  for (x = 1; x<=MAX; x*=2) {
    value = x * y;
    if (value > MAX) value = '---';
    value = value.toString().padStart(PAD);
    result += value;
  }
  result += "\n";
}

console.log(result);