const fs = require('fs');

const path = 'C:\\Users\\DELL\\.gemini\\antigravity\\brain\\b028d320-2bff-47d4-bfb3-ae707ba1ae54\\.tempmediaStorage\\dom_1783354412608.txt';

if (fs.existsSync(path)) {
    console.log(fs.readFileSync(path, 'utf8'));
} else {
    console.log("File not found.");
}
