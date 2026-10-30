/* ArtEssencia · seasonal catalog backgrounds. Shared by Backoffice and public Catalog. */
(function(g){
 const themes=[
 ['artessencia','ArtEssencia','#fffaf5','#d9bca5','✦','radial-gradient(circle at 18% 18%,#ead7c8 0 2%,transparent 25%),linear-gradient(130deg,#fffaf5,#eee0d1)'],
 ['natal','Natal','#f3e7df','#67806a','🎄','radial-gradient(circle at 15% 18%,#bc494380 0 5%,transparent 20%),radial-gradient(circle at 85% 85%,#4d795680 0 7%,transparent 23%),linear-gradient(125deg,#f8f0e6,#d6e4da)'],
 ['outono','Outono','#f8e6cc','#b36c39','🍁','radial-gradient(ellipse at 20% 30%,#c97a5270 0 5%,transparent 30%),radial-gradient(ellipse at 85% 75%,#dba45380 0 8%,transparent 35%),linear-gradient(125deg,#fff0d4,#ead0b1)'],
 ['halloween','Halloween','#e9ddea','#735274','🎃','radial-gradient(circle at 15% 75%,#ce875170 0 6%,transparent 28%),radial-gradient(circle at 80% 20%,#74527b75 0 8%,transparent 30%),linear-gradient(125deg,#fbecd7,#dbcee6)'],
 ['primavera','Primavera','#f7edf0','#9ebc9a','🌸','radial-gradient(circle at 18% 22%,#eab3c580 0 6%,transparent 26%),radial-gradient(circle at 82% 78%,#9bcca480 0 8%,transparent 35%),linear-gradient(135deg,#fff1f1,#e3f1df)'],
 ['verao','Verão','#fff1da','#80b8c9','☀️','radial-gradient(circle at 85% 15%,#f7cf6980 0 8%,transparent 32%),radial-gradient(circle at 15% 85%,#8ccdd180 0 8%,transparent 33%),linear-gradient(135deg,#fff1cd,#dbf4f0)'],
 ['inverno','Inverno','#edf2f7','#97b4c9','❄️','radial-gradient(circle at 20% 30%,#a6cce280 0 6%,transparent 35%),radial-gradient(circle at 85% 70%,#d8e9f280 0 8%,transparent 35%),linear-gradient(125deg,#f9fbfd,#d6e5f0)'],
 ['namorados','São Valentim','#fae6eb','#cd8797','♥','radial-gradient(circle at 20% 20%,#eaa6ba80 0 8%,transparent 32%),radial-gradient(circle at 80% 80%,#d477a380 0 8%,transparent 30%),linear-gradient(135deg,#fff4f3,#f3d8df)'],
 ['pascoa','Páscoa','#f9efdf','#b0c79c','🐣','radial-gradient(circle at 15% 25%,#eecaa180 0 7%,transparent 30%),radial-gradient(circle at 85% 80%,#b3c6de80 0 8%,transparent 30%),linear-gradient(130deg,#fff5db,#e6edda)'],
 ['dias-santos','Dias Santos','#eee9dc','#b5a47f','🕊️','radial-gradient(circle at 50% 8%,#ebd79d75 0 8%,transparent 35%),linear-gradient(125deg,#f8f4e9,#dfd8c9)'],
 ['santos-populares','Santos Populares','#fff0d8','#e2a470','🎏','repeating-linear-gradient(135deg,transparent 0 45px,#e9a76a30 45px 48px),linear-gradient(125deg,#fdf2d8,#d6e7e0)'],
 ['dia-mae','Dia da Mãe','#f9e5e7','#baac82','💐','radial-gradient(circle at 20% 25%,#e1a4b880 0 8%,transparent 28%),linear-gradient(135deg,#fff3ec,#e6eace)'],
 ['dia-pai','Dia do Pai','#e8eee6','#76938e','🌿','radial-gradient(circle at 80% 20%,#9cb9ad80 0 8%,transparent 30%),linear-gradient(135deg,#eff1e8,#d4e0d7)'],
 ['ano-novo','Ano Novo','#ece6e5','#ae9482','✨','radial-gradient(circle at 80% 20%,#d5bb8880 0 5%,transparent 30%),linear-gradient(120deg,#fffaf1,#e2d9dc)'],
 ['personalizado','Personalizado','#fffaf5','#d9bca5','🎨','linear-gradient(135deg,#fffaf5,#d9bca5)']
 ];
 const entries=themes.map(([id,name,a,b,icon,background])=>({id,name,a,b,icon,background}));
 const map=Object.fromEntries(entries.map(v=>[v.id,v]));
 const validColor=x=>/^#[0-9a-f]{6}$/i.test(String(x||''))?String(x):null;
 const custom=(a,b)=>'radial-gradient(circle at 18% 18%,'+a+'cc 0 5%,transparent 38%),linear-gradient(135deg,'+a+','+b+')';
 const cleanUrl=value=>{const v=String(value||'').trim();if(!v)return '';try{const u=new URL(v);return u.protocol==='https:'?u.href:''}catch{return ''}};
 function resolve(home={}){
  const id=String(home.catalogBackgroundPreset||'').trim();
  const preset=map[id]||null;
  const image=cleanUrl(home.catalogBackgroundImage);
  const mode=preset?(''+id):(image?'imagem':'artessencia');
  const a=validColor(home.catalogBackgroundColor1)||preset?.a||map.artessencia.a;
  const b=validColor(home.catalogBackgroundColor2)||preset?.b||map.artessencia.b;
  const bg=mode==='personalizado'?custom(a,b):mode==='imagem'?'':(preset||map.artessencia).background;
  const strength=Number.isFinite(Number(home.catalogBackgroundStrength))?Math.max(5,Math.min(85,Number(home.catalogBackgroundStrength))):20;
  return {mode,image,position:['center','center top','center bottom','left center','right center'].includes(home.catalogBackgroundPosition)?home.catalogBackgroundPosition:'center',strength,background:bg,a,b};
 }
 g.ArtEssenciaCatalogBackgrounds={entries,map,resolve,cleanUrl,validColor};
})(window);
