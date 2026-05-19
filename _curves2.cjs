const fs = require('fs');
const f = 'src/pages/admin/CoinPackPurchasesLedger.tsx';
const L = fs.readFileSync(f, 'utf8').split('\n');

function scan(limit) {
  let dO=0,dC=0,sO=0,sC=0;
  for (let i = 0; i < limit; i++) {
    let s = (L[i]||'');
    // scan <div open
    for (let j = 0; j < s.length; j++) {
      if (s[j] !== '<') continue;
      if (s.slice(j+1,j+5) === 'div ' || s.slice(j+1,j+5) === 'div>' || s.slice(j+1,j+6) === 'div /')
        dO++;
      if (s.startsWith('</div>', j)) dC++;
      if (s.startsWith('<', j) && s.slice(j+1,j+9) === 'section '
        || s.startsWith('<', j) && s.slice(j+1,j+9) === 'section>'
        || s.startsWith('<', j) && s.slice(j+1,j+10) === 'section /')
        sO++;
      if (s.startsWith('</section>', j)) sC++;
    }
  }
  return {dO,dC,dNet:dO-dC,sO,sC,sNet:sO-sC};
}

for(let l=955;l<=965;l++){
  const x = scan(l);
  console.log(l.toString().padStart(5)+'| divO='+x.dO+' divC='+x.dC+' divBal='+x.dNet+' | secO='+x.sO+' secC='+x.sC+' secBal='+x.sNet);
}
