import fs from 'fs';

let html = fs.readFileSync('index.html', 'utf8');

const startStr = 'const templateHtml = `<html';
const endStr = '</html>`;';

const startIdx = html.indexOf(startStr);
if (startIdx !== -1) {
  const endIdx = html.indexOf(endStr, startIdx);
  if (endIdx !== -1) {
    const originalBlock = html.slice(startIdx, endIdx + endStr.length);
    const escapedBlock = originalBlock.replace(/<(\/)?(html|head|body)\b/gi, (match) => {
      return '<' + match.slice(1);
    });
    // For example <html -> '<' + 'html, <body> -> '<' + 'body, </body> -> '<' + '/body
    html = html.slice(0, startIdx) + escapedBlock + html.slice(endIdx + endStr.length);
  }
}

fs.writeFileSync('index.html', html, 'utf8');
console.log('Fixed templateHtml regex!');
