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
        console.log(`=== ${file} ===`);
        console.log("Includes <body:", content.includes('<body'));
        console.log("Includes <div:", content.includes('<div'));
        console.log("Includes <script:", content.includes('<script'));
        console.log("Includes <header:", content.includes('<header'));
        console.log("Includes <section:", content.includes('<section'));
    }
}
