const fs = require('fs');
const path = require('path');

const tempDir = 'C:\\Users\\DELL\\.gemini\\antigravity\\brain\\ccae0f15-d6ee-4111-9418-a1bd386bde8d\\.tempmediaStorage';

if (fs.existsSync(tempDir)) {
    const files = fs.readdirSync(tempDir);
    console.log(`Total files in ccae0f15 tempmedia: ${files.length}`);
    for (let file of files) {
        const fullPath = path.join(tempDir, file);
        const stat = fs.statSync(fullPath);
        if (stat.size > 20000) {
            const content = fs.readFileSync(fullPath, 'utf8');
            console.log(`File: ${file} | Size: ${stat.size} bytes`);
            console.log("  Starts with:", content.substring(0, 150).replace(/\r?\n/g, ' '));
            
            // Check if it has real HTML div elements
            const hasDivs = content.includes('<div') && !content.includes('/* SafeConnect Premium Stylesheet */');
            console.log("  Has real HTML divs:", hasDivs);
            if (hasDivs) {
                fs.writeFileSync(`recovered_real_html_${file}.html`, content, 'utf8');
                console.log(`  => Copied to recovered_real_html_${file}.html`);
            }
        }
    }
} else {
    console.log("ccae0f15 tempmedia folder not found.");
}
