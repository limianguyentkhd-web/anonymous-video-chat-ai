const fs = require('fs');

const filePath = '📊 So sánh SafeConnect với Azar Live.txt';

if (!fs.existsSync(filePath)) {
    console.error("File not found!");
    process.exit(1);
}

const buffer = fs.readFileSync(filePath);
console.log("File length:", buffer.length);
console.log("Magic bytes:", buffer.slice(0, 4).toString('hex'), buffer.slice(0, 4).toString());

// Check for ZIP magic bytes (504b0304 or "PK\x03\x04")
if (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) {
    console.log("This is a ZIP file (probably DOCX)!");
    // Rename to .zip and try to unzip
    fs.writeFileSync('comparison_doc.zip', buffer);
    console.log("Saved as comparison_doc.zip");
} else {
    console.log("This is not a ZIP file.");
    // Print first 500 characters
    console.log("Text preview:", buffer.slice(0, 500).toString('utf8'));
}
