const $=s=>document.querySelector(s);const nav=$('#nav');$('#menuBtn')?.addEventListener('click',()=>nav.classList.toggle('open'));
async function loadJSON(path,fallback){try{const r=await fetch(path);if(!r.ok)throw new Error('no');return await r.json()}catch(e){return fallback}}
const ideasFallback=[{pair:'XAU/USD',type:'SELL',entry:'4040–4050',sl:'4097',tp:'4000 / 3975',risk:'Mediu',note:'Așteaptă confirmare M5/M15 înainte de intrare.'},{pair:'EUR/USD',type:'BUY',entry:'1.0870',sl:'1.0820',tp:'1.0950',risk:'Scăzut',note:'Valabil doar dacă USD slăbește după știri.'},{pair:'GBP/USD',type:'WATCH',entry:'1.2700',sl:'-',tp:'-',risk:'Observare',note:'Așteptăm break clar peste rezistență.'}];
const reportsFallback=[{symbol:'XAU/USD',price:'4,040.52',change:'-65.19 (-1.59%)',dir:'red'},{symbol:'XAG/USD',price:'57.762',change:'-2.20 (-3.66%)',dir:'red'},{symbol:'EUR/USD',price:'1.08956',change:'+0.00123 (+0.11%)',dir:'green'},{symbol:'GBP/USD',price:'1.27034',change:'+0.00215 (+0.17%)',dir:'green'}];
function cardIdea(x){const cls=(x.type||'').toLowerCase()==='buy'?'buy':(x.type||'').toLowerCase()==='sell'?'sell':'watch';
const meta=[x.date?`<span>📅 ${x.date}</span>`:'',x.timeframe?`<span>⏱ ${x.timeframe}</span>`:'',x.status?`<span class="status-chip ${x.status.toLowerCase()}">${x.status}</span>`:''].join('');
return `<article class="glass market-card"><h3>${x.pair}<span class="badge ${cls}">${x.type}</span></h3><div class="idea-meta">${meta}</div><p><b>Intrare:</b> ${x.entry}<br><b>SL:</b> ${x.sl}<br><b>TP:</b> ${x.tp}<br><b>Risc:</b> ${x.risk}</p><p>${x.note}</p></article>`}
function cardReport(x){return `<article class="glass market-card"><h3>${x.symbol}</h3><p class="price">${x.price}</p><p class="${x.dir}">${x.change}</p><a class="outline" href="#">Analiză săptămânală</a></article>`}
async function render(){const ideas=await loadJSON('data/ideas.json',ideasFallback);$('#ideasGrid').innerHTML=ideas.map(cardIdea).join('');const reports=await loadJSON('data/reports.json',reportsFallback);$('#reportsGrid').innerHTML=reports.map(cardReport).join('')}render();
$('#unlockIdeas')?.addEventListener('click',()=>{const pass=$('#memberPass').value.trim();if(pass==='treidingsb'){document.querySelector('.access-panel').classList.add('hidden');$('#ideasContent').classList.remove('hidden');$('#ideasContent').classList.add('reveal');}else{$('#loginMsg').textContent='Parolă greșită. Încearcă din nou.'}});
$('#subscribeForm')?.addEventListener('submit',async(e)=>{e.preventDefault();
const input=$('#subscribeForm input[type=email]');const msg=$('#subscribeMsg');const btn=$('#subscribeForm button');
const email=(input.value||'').trim();
if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){msg.textContent='Adresa de email este invalida.';msg.style.color='#ff8a8a';return}
btn.disabled=true;msg.textContent='Se trimite...';msg.style.color='#c8d4e8';
try{const r=await fetch('/api/send-email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({to:email,type:'welcome',lang:'ro'})});
const d=await r.json();
if(d&&d.success){msg.textContent='Te-ai abonat cu succes! Verifica-ti emailul.';msg.style.color='#2ee6a0';input.value=''}
else{msg.textContent='Eroare la abonare. Incearca din nou.';msg.style.color='#ff8a8a'}}
catch(err){msg.textContent='Eroare la abonare. Incearca din nou.';msg.style.color='#ff8a8a'}
btn.disabled=false});
