const fs = require('fs');

const files = [
    'recovered_dom_all_.tempmediaStorage_dom_1783351099113.txt.html',
    'recovered_dom_all_.tempmediaStorage_dom_1783351181003.txt.html',
    'recovered_dom_all_.tempmediaStorage_dom_1783351288604.txt.html',
    'recovered_dom_all_.tempmediaStorage_dom_1783351297500.txt.html',
    'recovered_dom_all_.tempmediaStorage_dom_1783351402490.txt.html'
];

for (let file of files) {
    if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf8');
        console.log(`=== FILE: ${file} ===`);
        console.log("Length:", content.length);
        // Find index of <current_dom>
        const idx = content.indexOf('<current_dom>');
        if (idx !== -1) {
            console.log("Snippet after <current_dom>:");
            console.log(content.substring(idx + 13, idx + 400));
        } else {
            console.log("Snippet (start):");
            console.log(content.substring(0, 400));
        }
        console.log("\n");
    }
}
