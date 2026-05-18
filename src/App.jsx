import { useState, useRef, useCallback } from "react";

function usePersistedState(key, defaultValue) {
  const [state, setStateRaw] = useState(function() {
    try { var s = localStorage.getItem(key); return s ? JSON.parse(s) : defaultValue; }
    catch(e) { return defaultValue; }
  });
  var setState = useCallback(function(valOrFn) {
    setStateRaw(function(prev) {
      var next = typeof valOrFn === "function" ? valOrFn(prev) : valOrFn;
      try { localStorage.setItem(key, JSON.stringify(next)); } catch(e) {}
      return next;
    });
  }, [key]);
  return [state, setState];
}

function clearAllData() {
  ["pt_nlv","pt_stocks","pt_options","pt_spreads","pt_journal"].forEach(function(k) { localStorage.removeItem(k); });
  window.location.reload();
}

var GOAL = 250000;
var AUD_USD = 0.7147;

var SEED_STOCKS = [
  { id:"s1", ticker:"ASTS",  shares:100,   avgPrice:97.00,  lastPrice:72.24,  currency:"USD" },
  { id:"s2", ticker:"GOOG",  shares:100,   avgPrice:310.00, lastPrice:347.65, currency:"USD" },
  { id:"s3", ticker:"SPY",   shares:100,   avgPrice:706.44, lastPrice:712.80, currency:"USD" },
  { id:"s4", ticker:"JEPQ",  shares:200,   avgPrice:51.61,  lastPrice:58.99,  currency:"USD" },
  { id:"s6", ticker:"IMU",   shares:958,   avgPrice:0.126,  lastPrice:0.115,  currency:"AUD" },
  { id:"s7", ticker:"PCI",   shares:10000, avgPrice:1.153,  lastPrice:1.094,  currency:"AUD" },
];

var SEED_OPTIONS = [
  { id:"o1", ticker:"GOOG",  side:"short", type:"call", strike:350, expiry:"2026-08-21", premium:25.55, qty:1, currency:"USD" },
  { id:"o2", ticker:"GOOGL", side:"short", type:"put",  strike:305, expiry:"2026-06-18", premium:3.69,  qty:1, currency:"USD" },
  { id:"o3", ticker:"ASTS",  side:"short", type:"put",  strike:65,  expiry:"2026-05-22", premium:4.45,  qty:1, currency:"USD" },
  { id:"o4", ticker:"ASTS",  side:"short", type:"put",  strike:50,  expiry:"2026-05-29", premium:1.00,  qty:3, currency:"USD" },
  { id:"o5", ticker:"NBIS",  side:"short", type:"put",  strike:100, expiry:"2026-05-22", premium:2.60,  qty:2, currency:"USD" },
  { id:"o6", ticker:"NVDA",  side:"short", type:"put",  strike:140, expiry:"2028-01-21", premium:12.73, qty:1, currency:"USD" },
];

var SEED_SPREADS = [
  { id:"sp1", ticker:"NVDA", strategy:"Bull Put Spread", shortStrike:180, longStrike:175, expiry:"2026-06-05", credit:0.64, currentMark:0.40, qty:5, width:5, currency:"USD", notes:"Post-tariff recovery play.", openDate:"2026-04-28" },
];

var SEED_JOURNAL = [
  { id:"j1", date:"2026-04-27", ticker:"CVL", action:"SELL STOCK", price:1.48, qty:4963, pnl:2691, currency:"AUD", notes:"Sold CVL ASX. 54% gain.", tags:["exit","profit"] },
  { id:"j2", date:"2026-03-17", ticker:"NVDA", action:"SELL PUT", price:19.47, qty:1, pnl:574, currency:"USD", notes:"Sold NVDA Jan 2028 $140 Put. Target 70-80% profit.", tags:["premium","nvda"] },
];

function toUSD(val, cur) { return cur === "AUD" ? val * AUD_USD : val; }
function fmtSign(val, cur) {
  var p = cur === "AUD" ? "A$" : "$";
  var a = Math.abs(val);
  var s = a >= 1000 ? p + (a/1000).toFixed(1) + "k" : p + a.toFixed(0);
  return val < 0 ? "-" + s : "+" + s;
}
function fmtPlain(val, cur) { return (cur === "AUD" ? "A$" : "$") + Math.abs(val).toFixed(2); }
function getDTE(exp) { return Math.max(0, Math.ceil((new Date(exp) - new Date()) / 86400000)); }
function getDteColor(d) { return d <= 7 ? "#ff6b6b" : d <= 21 ? "#ffd166" : d <= 45 ? "#06d6a0" : "#74b9ff"; }
function uid() { return Math.random().toString(36).slice(2,8); }

function parseCSVLine(line) {
  var r=[],cur="",q=false;
  for(var i=0;i<line.length;i++){
    var c=line[i];
    if(c==='"'){q=!q;}
    else if(c===','&&!q){r.push(cur.trim());cur="";}
    else{cur+=c;}
  }
  r.push(cur.trim());
  return r;
}

function parseExpiry(raw) {
  var M={JAN:"01",FEB:"02",MAR:"03",APR:"04",MAY:"05",JUN:"06",JUL:"07",AUG:"08",SEP:"09",OCT:"10",NOV:"11",DEC:"12"};
  if(raw&&raw.length>=7){
    return "20"+raw.slice(5,7)+"-"+(M[raw.slice(2,5).toUpperCase()]||"01")+"-"+raw.slice(0,2);
  }
  return raw;
}

function parseIBKRcsv(text) {
  var lines=text.split("\n"), stocks=[], options=[], spreads=[], trades=[], seen={};
  for(var li=0;li<lines.length;li++){
    var line=lines[li].trim();
    if(!line) continue;
    var c=parseCSVLine(line);
    if(c.length<4) continue;
    if(c[0]==="Open Positions"&&c[1]==="Data"&&c[2]==="Summary"){
      var cat=c[3]||"", cur=c[4]||"USD", sym=c[5]||"";
      var qty=parseFloat((c[6]||"0").replace(/,/g,""))||0;
      var avg=parseFloat((c[8]||"0").replace(/,/g,""))||0;
      var last=parseFloat((c[10]||"0").replace(/,/g,""));
      if(isNaN(last)) last=avg;
      if(cat==="Stocks"){
        stocks.push({id:uid(),ticker:sym,shares:Math.abs(qty),avgPrice:avg,lastPrice:last,currency:cur});
      }
      if(cat.indexOf("Options")!==-1){
        var pts=sym.split(" ");
        if(pts.length>=4){
          var tk=pts[0], exp=parseExpiry(pts[1]), stk=parseFloat(pts[2])||0;
          var ot=pts[3]==="P"?"put":"call", sd=qty<0?"short":"long";
          var sk=tk+"|"+exp;
          if(!seen[sk]) seen[sk]=[];
          seen[sk].push({side:sd,strike:stk,optType:ot,qty:Math.abs(qty),premium:avg,currentMark:last,currency:cur});
        }
      }
    }
    if(c[0]==="Trades"&&c[1]==="Data"&&c[2]==="Order"){
      var tcat=c[3]||"", tcur=c[4]||"USD", tsym=c[5]||"";
      var td=(c[6]||"").slice(0,10).replace(",","").trim();
      var tqty=Math.abs(parseFloat((c[7]||"0").replace(/,/g,""))||0);
      var tprice=parseFloat((c[8]||"0").replace(/,/g,""))||0;
      var tpnl=parseFloat((c[13]||"0").replace(/,/g,""))||0;
      var tqn=parseFloat((c[7]||"0").replace(/,/g,""))||0;
      // Skip rows with no usable trade data (subtotal artifacts, expiry rows with 0 price/qty)
      if(tqty===0||!td||!tsym){ continue; }
      // Skip Forex trades (e.g., AUD.USD)
      if(tcat.indexOf("Forex")!==-1){ continue; }
      var isOpt=tcat.indexOf("Options")!==-1;
      var tact, ticker=tsym, optType=null, strike=null, expiry=null;
      if(isOpt){
        // Parse IBKR option symbol "AMZN 26JUN26 230 P" -> ticker/expiry/strike/type
        var pts=tsym.split(/\s+/);
        if(pts.length>=4){
          ticker=pts[0];
          expiry=parseExpiry(pts[1]);
          strike=parseFloat(pts[2])||null;
          optType=pts[3]==="P"?"PUT":pts[3]==="C"?"CALL":null;
        }
        // Action: SELL PUT / BUY PUT / SELL CALL / BUY CALL
        if(optType){
          tact=(tqn<0?"SELL ":"BUY ")+optType;
        } else {
          tact=tqn<0?"SELL OPTION":"BUY OPTION";
        }
      } else {
        tact=tqn<0?"SELL STOCK":"BUY STOCK";
      }
      var noteDetail=isOpt&&strike?(ticker+" "+(expiry||"")+" $"+strike+" "+(optType||"")):tsym;
      trades.push({id:uid(),date:td,ticker:ticker,action:tact,price:tprice,qty:tqty,pnl:tpnl,currency:tcur,notes:"Imported: "+noteDetail,tags:["imported"],optType:optType,strike:strike,expiry:expiry,rawSymbol:tsym});
    }
  }
  Object.keys(seen).forEach(function(key){
    var legs=seen[key], pts=key.split("|"), tk=pts[0], exp=pts[1];
    var sh=legs.filter(function(l){return l.side==="short";}), lg=legs.filter(function(l){return l.side==="long";});
    if(sh.length>0&&lg.length>0){
      var s=sh[0], l=lg[0];
      var w=parseFloat(Math.abs(s.strike-l.strike).toFixed(2));
      var cr=parseFloat(Math.max(s.premium-l.premium,0).toFixed(4));
      var cm=parseFloat(Math.max(s.currentMark-l.currentMark,0).toFixed(4));
      spreads.push({id:uid(),ticker:tk,strategy:s.optType==="put"?"Bull Put Spread":"Bear Call Spread",shortStrike:s.strike,longStrike:l.strike,expiry:exp,credit:cr,currentMark:cm,qty:s.qty,width:w,currency:s.currency,notes:"Imported from IBKR",openDate:new Date().toISOString().slice(0,10)});
    } else {
      legs.forEach(function(leg){
        options.push({id:uid(),ticker:tk,side:leg.side,type:leg.optType,strike:leg.strike,expiry:exp,premium:leg.premium,qty:leg.qty,currency:leg.currency});
      });
    }
  });
  return {stocks:stocks,options:options,spreads:spreads,trades:trades};
}

var C = {
  bg:"#0a0e1a", surface:"#111827", border:"rgba(255,255,255,0.08)", borderHi:"rgba(99,179,237,0.3)",
  green:"#06d6a0", greenDim:"rgba(6,214,160,0.1)", red:"#ff6b6b", redDim:"rgba(255,107,107,0.1)",
  yellow:"#ffd166", blue:"#74b9ff", text:"#e2e8f0", textMid:"#a0aec0", textDim:"#718096", textFaint:"#4a5568"
};

var S = {
  app:    {minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"'IBM Plex Mono','Courier New',monospace",paddingBottom:48},
  card:   {background:C.surface,border:"1px solid "+C.border,borderRadius:6,padding:20,position:"relative",overflow:"hidden",marginBottom:12},
  lbl:    {fontSize:9,letterSpacing:"0.14em",textTransform:"uppercase",color:C.textDim,marginBottom:4},
  big:    {fontFamily:"'Bebas Neue',sans-serif",fontSize:26,letterSpacing:"0.05em",lineHeight:1},
  ticker: {color:C.green,fontWeight:600,fontSize:12},
  inp:    {background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",color:C.text,fontFamily:"'IBM Plex Mono',monospace",fontSize:11,padding:"7px 10px",borderRadius:4,width:"100%",outline:"none"},
  btn:    {background:"rgba(6,214,160,0.12)",border:"1px solid rgba(6,214,160,0.35)",color:C.green,fontFamily:"'IBM Plex Mono',monospace",fontSize:10,letterSpacing:"0.08em",padding:"7px 16px",borderRadius:4,cursor:"pointer"},
  btnRed: {background:"rgba(255,107,107,0.1)",border:"1px solid rgba(255,107,107,0.3)",color:C.red,fontFamily:"'IBM Plex Mono',monospace",fontSize:10,padding:"4px 9px",borderRadius:4,cursor:"pointer"},
  pbar:   {height:5,background:"rgba(255,255,255,0.07)",borderRadius:3,overflow:"hidden"},
  tag:    {display:"inline-block",background:"rgba(116,185,255,0.12)",border:"1px solid rgba(116,185,255,0.25)",color:C.blue,fontSize:9,padding:"1px 6px",borderRadius:2,marginRight:4},
  modalBg:{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:16},
  modal:  {background:"#0d1420",border:"1px solid rgba(6,214,160,0.25)",borderRadius:8,padding:24,width:"100%",maxWidth:500,maxHeight:"90vh",overflowY:"auto"},
};

function BarFill(props) {
  var pct = Math.min(Math.max(props.pct||0,0),100);
  return (
    <div style={S.pbar}>
      <div style={{height:"100%",width:pct+"%",background:props.gradient||("linear-gradient(90deg,"+C.green+","+C.blue+")"),borderRadius:3,transition:"width 0.8s ease",position:"relative"}}>
        <div style={{position:"absolute",right:0,top:-3,bottom:-3,width:2,background:"white",borderRadius:2,boxShadow:"0 0 8px rgba(6,214,160,0.9)"}} />
      </div>
    </div>
  );
}

function Card(props) {
  return (
    <div style={Object.assign({},S.card,props.style||{})}>
      <div style={{position:"absolute",top:0,left:0,right:0,height:1,background:"linear-gradient(90deg,transparent,rgba(6,214,160,0.3),transparent)"}} />
      {props.children}
    </div>
  );
}

function Btn(props) { return <button style={Object.assign({},S.btn,props.style||{})} onClick={props.onClick}>{props.children}</button>; }
function BtnRed(props) { return <button style={S.btnRed} onClick={props.onClick}>{props.children}</button>; }
function Inp(props) { return <input style={S.inp} type={props.type||"text"} value={props.value} onChange={props.onChange} placeholder={props.placeholder||""} />; }
function Field(props) { return <div style={{marginBottom:12}}><div style={S.lbl}>{props.label}</div>{props.children}</div>; }
function DtePill(props) {
  var color=getDteColor(props.dte);
  return <span style={{display:"inline-block",padding:"3px 8px",borderRadius:3,fontSize:9,fontWeight:600,background:color+"20",color:color,border:"1px solid "+color+"40"}}>{props.dte}d</span>;
}
function ModalHeader(props) {
  return (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
      <div style={{fontSize:11,letterSpacing:"0.15em",textTransform:"uppercase",color:C.green}}>{props.title}</div>
      <BtnRed onClick={props.onClose}>Close</BtnRed>
    </div>
  );
}

function NLVModal(props) {
  var [val,setVal]=useState(props.nlv);
  return (<div><ModalHeader title="Update Net Liq Value" onClose={props.onClose} /><Field label="NLV (USD)"><Inp type="number" value={val} onChange={function(e){setVal(+e.target.value);}} /></Field><Btn style={{width:"100%",marginTop:8}} onClick={function(){props.onSave(val);}}>Save</Btn></div>);
}

function StockModal(props) {
  var [f,setF]=useState({ticker:"",shares:"",avgPrice:"",lastPrice:"",currency:"USD"});
  function upd(k,v){setF(function(p){return Object.assign({},p,{[k]:v});});}
  return (
    <div>
      <ModalHeader title="Add Stock Position" onClose={props.onClose} />
      <Field label="Ticker"><Inp value={f.ticker} onChange={function(e){upd("ticker",e.target.value.toUpperCase());}} /></Field>
      <div style={{display:"flex",gap:10}}>
        <div style={{flex:1}}><Field label="Shares"><Inp type="number" value={f.shares} onChange={function(e){upd("shares",+e.target.value);}} /></Field></div>
        <div style={{flex:1}}><Field label="Currency"><select style={S.inp} value={f.currency} onChange={function(e){upd("currency",e.target.value);}}><option>USD</option><option>AUD</option></select></Field></div>
      </div>
      <div style={{display:"flex",gap:10}}>
        <div style={{flex:1}}><Field label="Avg Price"><Inp type="number" value={f.avgPrice} onChange={function(e){upd("avgPrice",+e.target.value);}} /></Field></div>
        <div style={{flex:1}}><Field label="Last Price"><Inp type="number" value={f.lastPrice} onChange={function(e){upd("lastPrice",+e.target.value);}} /></Field></div>
      </div>
      <Btn style={{width:"100%",marginTop:8}} onClick={function(){if(f.ticker)props.onSave(f);}}>Add Position</Btn>
    </div>
  );
}

function OptionModal(props) {
  var [f,setF]=useState({ticker:"",side:"short",type:"put",strike:"",expiry:"",premium:"",qty:1,currency:"USD"});
  function upd(k,v){setF(function(p){return Object.assign({},p,{[k]:v});});}
  return (
    <div>
      <ModalHeader title="Add Option Position" onClose={props.onClose} />
      <div style={{display:"flex",gap:10}}>
        <div style={{flex:1}}><Field label="Ticker"><Inp value={f.ticker} onChange={function(e){upd("ticker",e.target.value.toUpperCase());}} /></Field></div>
        <div style={{flex:1}}><Field label="Side"><select style={S.inp} value={f.side} onChange={function(e){upd("side",e.target.value);}}><option>short</option><option>long</option></select></Field></div>
        <div style={{flex:1}}><Field label="Type"><select style={S.inp} value={f.type} onChange={function(e){upd("type",e.target.value);}}><option>put</option><option>call</option></select></Field></div>
      </div>
      <div style={{display:"flex",gap:10}}>
        <div style={{flex:1}}><Field label="Strike"><Inp type="number" value={f.strike} onChange={function(e){upd("strike",+e.target.value);}} /></Field></div>
        <div style={{flex:1}}><Field label="Qty"><Inp type="number" value={f.qty} onChange={function(e){upd("qty",+e.target.value);}} /></Field></div>
      </div>
      <div style={{display:"flex",gap:10}}>
        <div style={{flex:1}}><Field label="Expiry"><Inp type="date" value={f.expiry} onChange={function(e){upd("expiry",e.target.value);}} /></Field></div>
        <div style={{flex:1}}><Field label="Premium"><Inp type="number" value={f.premium} onChange={function(e){upd("premium",+e.target.value);}} /></Field></div>
      </div>
      <Btn style={{width:"100%",marginTop:8}} onClick={function(){if(f.ticker)props.onSave(f);}}>Add Option</Btn>
    </div>
  );
}

function SpreadModal(props) {
  var [f,setF]=useState({ticker:"",strategy:"Bull Put Spread",shortStrike:"",longStrike:"",expiry:"",credit:"",currentMark:"",qty:1,currency:"USD",notes:"",openDate:new Date().toISOString().slice(0,10)});
  function upd(k,v){setF(function(p){return Object.assign({},p,{[k]:v});});}
  var width=f.shortStrike&&f.longStrike?parseFloat(Math.abs(+f.shortStrike-+f.longStrike).toFixed(2)):0;
  var maxP=f.credit&&f.qty?(+f.credit*+f.qty*100).toFixed(0):null;
  var maxL=width&&f.credit&&f.qty?((width-+f.credit)*+f.qty*100).toFixed(0):null;
  var ror=width&&f.credit?((+f.credit/width)*100).toFixed(1):null;
  return (
    <div>
      <ModalHeader title="Add Spread Position" onClose={props.onClose} />
      <div style={{display:"flex",gap:10}}>
        <div style={{flex:1}}><Field label="Ticker"><Inp value={f.ticker} onChange={function(e){upd("ticker",e.target.value.toUpperCase());}} /></Field></div>
        <div style={{flex:2}}><Field label="Strategy"><select style={S.inp} value={f.strategy} onChange={function(e){upd("strategy",e.target.value);}}><option>Bull Put Spread</option><option>Bear Call Spread</option><option>Iron Condor</option><option>Debit Spread</option></select></Field></div>
      </div>
      <div style={{display:"flex",gap:10}}>
        <div style={{flex:1}}><Field label="Short Strike"><Inp type="number" value={f.shortStrike} onChange={function(e){upd("shortStrike",+e.target.value);}} /></Field></div>
        <div style={{flex:1}}><Field label="Long Strike"><Inp type="number" value={f.longStrike} onChange={function(e){upd("longStrike",+e.target.value);}} /></Field></div>
        <div style={{flex:1}}><Field label="Width"><div style={Object.assign({},S.inp,{color:C.textDim,cursor:"default"})}>{width||""}</div></Field></div>
      </div>
      <div style={{display:"flex",gap:10}}>
        <div style={{flex:1}}><Field label="Credit"><Inp type="number" value={f.credit} onChange={function(e){upd("credit",+e.target.value);}} /></Field></div>
        <div style={{flex:1}}><Field label="Current Mark"><Inp type="number" value={f.currentMark} onChange={function(e){upd("currentMark",+e.target.value);}} /></Field></div>
        <div style={{flex:1}}><Field label="Qty"><Inp type="number" value={f.qty} onChange={function(e){upd("qty",+e.target.value);}} /></Field></div>
      </div>
      <Field label="Expiry"><Inp type="date" value={f.expiry} onChange={function(e){upd("expiry",e.target.value);}} /></Field>
      {width>0&&f.credit>0&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,padding:12,background:C.greenDim,border:"1px solid rgba(6,214,160,0.15)",borderRadius:4,marginBottom:12}}>
          <div><div style={S.lbl}>Max Profit</div><div style={{fontSize:12,color:C.green}}>+${maxP}</div></div>
          <div><div style={S.lbl}>Max Loss</div><div style={{fontSize:12,color:C.red}}>-${maxL}</div></div>
          <div><div style={S.lbl}>RoR</div><div style={{fontSize:12,color:C.yellow}}>{ror}%</div></div>
        </div>
      )}
      <Field label="Notes"><textarea style={Object.assign({},S.inp,{resize:"vertical"})} rows={2} value={f.notes} onChange={function(e){upd("notes",e.target.value);}} /></Field>
      <Btn style={{width:"100%",marginTop:4}} onClick={function(){if(f.ticker&&f.expiry)props.onSave(Object.assign({},f,{width:width}));}}>Add Spread</Btn>
    </div>
  );
}

function JournalModal(props) {
  var [f,setF]=useState({date:new Date().toISOString().slice(0,10),ticker:"",action:"SELL PUT",price:"",qty:"",pnl:"",currency:"USD",notes:"",tagInput:"",tags:[]});
  function upd(k,v){setF(function(p){return Object.assign({},p,{[k]:v});});}
  function addTag(){if(f.tagInput.trim()){setF(function(p){return Object.assign({},p,{tags:[].concat(p.tags,[p.tagInput.trim().toLowerCase()]),tagInput:""});});}}
  return (
    <div>
      <ModalHeader title="Add Journal Entry" onClose={props.onClose} />
      <div style={{display:"flex",gap:10}}>
        <div style={{flex:1}}><Field label="Date"><Inp type="date" value={f.date} onChange={function(e){upd("date",e.target.value);}} /></Field></div>
        <div style={{flex:1}}><Field label="Ticker"><Inp value={f.ticker} onChange={function(e){upd("ticker",e.target.value.toUpperCase());}} /></Field></div>
      </div>
      <div style={{display:"flex",gap:10}}>
        <div style={{flex:2}}><Field label="Action"><select style={S.inp} value={f.action} onChange={function(e){upd("action",e.target.value);}}><option>SELL PUT</option><option>BUY PUT</option><option>SELL CALL</option><option>BUY CALL</option><option>BUY STOCK</option><option>SELL STOCK</option><option>SELL SPREAD</option><option>CLOSE SPREAD</option><option>ROLL OPTION</option><option>ASSIGNMENT</option><option>EXPIRY</option></select></Field></div>
        <div style={{flex:1}}><Field label="Currency"><select style={S.inp} value={f.currency} onChange={function(e){upd("currency",e.target.value);}}><option>USD</option><option>AUD</option></select></Field></div>
      </div>
      <div style={{display:"flex",gap:10}}>
        <div style={{flex:1}}><Field label="Price"><Inp type="number" value={f.price} onChange={function(e){upd("price",+e.target.value);}} /></Field></div>
        <div style={{flex:1}}><Field label="Qty"><Inp type="number" value={f.qty} onChange={function(e){upd("qty",+e.target.value);}} /></Field></div>
        <div style={{flex:1}}><Field label="PnL"><Inp type="number" value={f.pnl} onChange={function(e){upd("pnl",+e.target.value);}} /></Field></div>
      </div>
      <Field label="Notes"><textarea style={Object.assign({},S.inp,{resize:"vertical"})} rows={2} value={f.notes} onChange={function(e){upd("notes",e.target.value);}} /></Field>
      <Field label="Tags">
        <div style={{marginBottom:6}}>{f.tags.map(function(t,i){return(<span key={i} style={S.tag}>{t}<span style={{cursor:"pointer",marginLeft:3}} onClick={function(){setF(function(p){return Object.assign({},p,{tags:p.tags.filter(function(_,j){return j!==i;})});});}}>x</span></span>);})}</div>
        <div style={{display:"flex",gap:6}}><Inp placeholder="add tag" value={f.tagInput} onChange={function(e){upd("tagInput",e.target.value);}} /><Btn onClick={addTag}>Add</Btn></div>
      </Field>
      <Btn style={{width:"100%",marginTop:4}} onClick={function(){if(f.ticker)props.onSave(f);}}>Save Entry</Btn>
    </div>
  );
}

function SpreadCard(props) {
  var sp=props.sp;
  var dte=getDTE(sp.expiry);
  var maxProfit=sp.credit*sp.qty*100;
  var maxLoss=(sp.width-sp.credit)*sp.qty*100;
  var breakEven=sp.shortStrike-sp.credit;
  var ror=sp.width>0?((sp.credit/sp.width)*100).toFixed(1):"0";
  var hasMark=sp.currentMark!==undefined&&sp.currentMark!==null;
  var currentPnl=hasMark?(sp.credit-sp.currentMark)*sp.qty*100:null;
  var pctOfMax=hasMark&&maxProfit>0?(currentPnl/maxProfit)*100:null;
  var premDecay=hasMark&&sp.credit>0?((sp.credit-sp.currentMark)/sp.credit)*100:null;
  var statusLabel="", statusColor=C.textDim;
  if(pctOfMax!==null){
    if(pctOfMax>=75){statusLabel="Close to target";statusColor=C.green;}
    else if(pctOfMax>=50){statusLabel="On track";statusColor=C.green;}
    else if(pctOfMax>=25){statusLabel="Progressing";statusColor=C.yellow;}
    else if(currentPnl<0){statusLabel="Losing";statusColor=C.red;}
    else{statusLabel="Early days";statusColor=C.blue;}
  }
  var pnlColor=currentPnl===null?C.textMid:currentPnl>0?C.green:currentPnl<0?C.red:C.textMid;
  var barGrad=pctOfMax>=50?"linear-gradient(90deg,"+C.green+","+C.blue+")":pctOfMax>=0?"linear-gradient(90deg,"+C.yellow+","+C.green+")":C.red;

  return (
    <Card>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={Object.assign({},S.ticker,{fontSize:15})}>{sp.ticker}</span>
          <span style={{fontSize:11,color:C.textMid,background:"rgba(255,255,255,0.06)",padding:"2px 8px",borderRadius:3}}>{sp.strategy}</span>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <DtePill dte={dte} />
          <BtnRed onClick={props.onDelete}>x</BtnRed>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:16}}>
        {[
          {label:"Short Strike",val:"$"+sp.shortStrike},
          {label:"Long Strike", val:"$"+sp.longStrike},
          {label:"Width",       val:"$"+parseFloat(sp.width).toFixed(2)},
          {label:"Credit",      val:fmtPlain(sp.credit),color:C.green},
          {label:"Qty",         val:sp.qty},
          {label:"Expiry",      val:sp.expiry.slice(5)},
        ].map(function(m,i){
          return (
            <div key={i}>
              <div style={S.lbl}>{m.label}</div>
              <div style={{fontSize:13,color:m.color||C.text,fontWeight:m.color?"600":"400"}}>{m.val}</div>
            </div>
          );
        })}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,padding:"12px 0",borderTop:"1px solid "+C.border,borderBottom:hasMark?"1px solid "+C.border:"none",marginBottom:hasMark?16:0}}>
        <div><div style={S.lbl}>Max Profit</div><div style={{fontSize:12,color:C.green,fontWeight:600}}>+${maxProfit.toFixed(0)}</div></div>
        <div><div style={S.lbl}>Max Loss</div><div style={{fontSize:12,color:C.red,fontWeight:600}}>-${maxLoss.toFixed(0)}</div></div>
        <div><div style={S.lbl}>Break Even</div><div style={{fontSize:12}}>${breakEven.toFixed(2)}</div></div>
        <div><div style={S.lbl}>RoR</div><div style={{fontSize:12,color:C.yellow,fontWeight:600}}>{ror}%</div></div>
      </div>

      {hasMark&&(
        <div style={{background:"rgba(6,214,160,0.05)",border:"1px solid rgba(6,214,160,0.15)",borderRadius:4,padding:14}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div style={{fontSize:9,letterSpacing:"0.14em",textTransform:"uppercase",color:C.textDim}}>Current Performance</div>
            <div style={{fontSize:11,color:statusColor,fontWeight:600,letterSpacing:"0.05em"}}>{statusLabel}</div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:12}}>
            <div><div style={S.lbl}>Current Mark</div><div style={{fontSize:13,color:C.textMid}}>${sp.currentMark.toFixed(2)}</div></div>
            <div><div style={S.lbl}>PnL</div><div style={{fontSize:13,color:pnlColor,fontWeight:600}}>{currentPnl>=0?"+":""}{currentPnl!==null?currentPnl.toFixed(0):"na"}</div></div>
            <div><div style={S.lbl}>% of Max</div><div style={{fontSize:13,color:pnlColor,fontWeight:600}}>{pctOfMax!==null?pctOfMax.toFixed(1):"na"}%</div></div>
            <div><div style={S.lbl}>Premium Decay</div><div style={{fontSize:13,color:pnlColor}}>{premDecay!==null?premDecay.toFixed(1):"na"}%</div></div>
          </div>
          <BarFill pct={pctOfMax||0} gradient={barGrad} />
          <div style={{display:"flex",justifyContent:"space-between",fontSize:8,color:C.textFaint,marginTop:4}}>
            <span>$0</span>
            <span>50% = ${(maxProfit*0.5).toFixed(0)}</span>
            <span>Max +${maxProfit.toFixed(0)}</span>
          </div>
        </div>
      )}

      {sp.notes&&<div style={{fontSize:10,color:C.textDim,fontStyle:"italic",marginTop:hasMark?10:0,paddingTop:hasMark?0:10}}>{sp.notes}</div>}
    </Card>
  );
}

export default function App() {
  var [nlv,setNlv]=usePersistedState("pt_nlv",182069);
  var [stocks,setStocks]=usePersistedState("pt_stocks",SEED_STOCKS);
  var [options,setOptions]=usePersistedState("pt_options",SEED_OPTIONS);
  var [spreads,setSpreads]=usePersistedState("pt_spreads",SEED_SPREADS);
  var [journal,setJournal]=usePersistedState("pt_journal",SEED_JOURNAL);
  // Hybrid cash-flow income: premium received on opens, PnL on closes/rolls.
  // EXPIRY and ASSIGNMENT = $0 (premium already counted at open).
  function cashFlowFor(j) {
    var price = +j.price || 0;
    var qty = +j.qty || 0;
    var pnl = +j.pnl || 0;
    var contractValue = price * qty * 100;
    switch (j.action) {
      case "SELL PUT":
      case "SELL CALL":
      case "SELL OPTION":
        return contractValue;       // cash in
      case "BUY PUT":
      case "BUY CALL":
      case "BUY OPTION":
        return -contractValue;      // cash out
      case "SELL SPREAD":
      case "CLOSE SPREAD":
      case "ROLL OPTION":
        return pnl;                  // net of the action, signed
      case "EXPIRY":
      case "ASSIGNMENT":
        return 0;                    // already counted at open
      default:
        return 0;                    // stocks etc don't count as options income
    }
  }
  var income = (function() {
    var buckets = {};
    journal.forEach(function(j) {
      var cf = cashFlowFor(j);
      if (cf === 0) return;
      var month = (j.date||"").slice(0,7);
      if (!month) return;
      var cfUsd = toUSD(cf, j.currency||"USD");
      if (!buckets[month]) {
        var d = new Date(month+"-01");
        buckets[month] = { month:month, label:d.toLocaleString("default",{month:"short",year:"2-digit"}), premium:0 };
      }
      buckets[month].premium += cfUsd;
    });
    return Object.keys(buckets).sort().map(function(k){
      return Object.assign({}, buckets[k], { premium: Math.round(buckets[k].premium) });
    });
  })();
  var [tab,setTab]=useState("overview");
  var [modal,setModal]=useState(null);
  var [importMsg,setImportMsg]=useState("");
  var [showReset,setShowReset]=useState(false);
  var [incomeYear,setIncomeYear]=useState("all");
  var [incomeMode,setIncomeMode]=useState("alltime");
  var fileRef=useRef();

  var stockPL=stocks.reduce(function(s,p){return s+toUSD((p.lastPrice-p.avgPrice)*p.shares,p.currency);},0);
  // Available years derived from income data, plus 'all'
  var availableYears = (function(){
    var ys = {};
    income.forEach(function(m){ if(m.month) ys[m.month.slice(0,4)] = true; });
    return Object.keys(ys).sort();
  })();
  // Filtered income for the chart and totals
  var filteredIncome = incomeYear==="all"
    ? income
    : income.filter(function(m){ return m.month && m.month.slice(0,4)===incomeYear; });
  // For "trailing 3mo": last 3 months by calendar date from filteredIncome (or zero-fill if fewer)
  function getTrailingMonths(arr, n){
    if (!arr.length) return [];
    var sorted = arr.slice().sort(function(a,b){ return a.month<b.month?-1:1; });
    return sorted.slice(-n);
  }
  var trailingMonths = getTrailingMonths(filteredIncome, 3);
  var totalIncome = filteredIncome.reduce(function(s,m){return s+m.premium;},0);
  var alltimeAvg = filteredIncome.length ? Math.round(totalIncome/filteredIncome.length) : 0;
  var trailingAvg = trailingMonths.length ? Math.round(trailingMonths.reduce(function(s,m){return s+m.premium;},0)/trailingMonths.length) : 0;
  var avgIncome = incomeMode==="trailing" ? trailingAvg : alltimeAvg;
  var monthlyYield = nlv>0 ? ((avgIncome/nlv)*100).toFixed(2) : "0";
  var annualYield = nlv>0 ? ((avgIncome*12/nlv)*100).toFixed(2) : "0";
  var progress=Math.min((nlv/GOAL)*100,100);
  var remaining=GOAL-nlv;

  var handleFile=useCallback(function(e){
    var file=e.target.files&&e.target.files[0];
    if(!file) return;
    var reader=new FileReader();
    reader.onload=function(ev){
      try{
        var r=parseIBKRcsv(ev.target.result);
        if(r.stocks.length) setStocks(r.stocks);
        if(r.options.length) setOptions(r.options);
        if(r.spreads.length) setSpreads(r.spreads);
        if(r.trades.length){
          setJournal(function(prev){
            function dkey(j){ return (j.date||"")+"|"+(j.rawSymbol||j.ticker||"")+"|"+(j.price||0)+"|"+(j.qty||0); }
            var ex=new Set(prev.filter(function(j){return j.tags&&j.tags.indexOf("imported")!==-1;}).map(dkey));
            return r.trades.filter(function(t){return !ex.has(dkey(t));}).concat(prev);
          });
        }
        setImportMsg("Imported: "+r.stocks.length+" stocks, "+r.options.length+" options, "+r.spreads.length+" spreads, "+r.trades.length+" trades.");
      }catch(err){setImportMsg("Error: "+err.message);}
    };
    reader.readAsText(file);
    e.target.value="";
  },[setStocks,setOptions,setSpreads,setJournal]);

  var tabs=["overview","positions","options","spreads","income","journal","import"];
  function closeModal(){setModal(null);}
  function delSpread(id){setSpreads(function(p){return p.filter(function(x){return x.id!==id;});});}
  function delOption(id){setOptions(function(p){return p.filter(function(x){return x.id!==id;});});}
  function delStock(id){setStocks(function(p){return p.filter(function(x){return x.id!==id;});});}
  function delJournal(id){setJournal(function(p){return p.filter(function(x){return x.id!==id;});});}

  return (
    <div style={S.app}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600&family=Bebas+Neue&display=swap');*{box-sizing:border-box;}select option{background:#0d1420;}`}</style>

      <div style={{borderBottom:"1px solid "+C.border,padding:"24px 24px 0"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,flexWrap:"wrap",gap:12}}>
          <div>
            <div style={{fontSize:9,letterSpacing:"0.2em",color:C.textFaint,marginBottom:4}}>PORTFOLIO TERMINAL v2</div>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:32,letterSpacing:"0.08em",color:C.text}}>TRADING DESK</div>
            <div style={{display:"flex",gap:10,alignItems:"center",marginTop:4}}>
              <div style={{fontSize:9,color:C.textDim}}>AUD/USD {AUD_USD}</div>
              <div style={{fontSize:9,color:C.green,letterSpacing:"0.05em"}}>* AUTO-SAVED</div>
            </div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:9,letterSpacing:"0.14em",textTransform:"uppercase",color:C.textDim,marginBottom:4}}>NET LIQ VALUE</div>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:52,letterSpacing:"0.05em",color:C.text,lineHeight:1}}>${nlv.toLocaleString()}</div>
            <div style={{fontSize:11,color:stockPL>=0?C.green:C.red,marginTop:2}}>{fmtSign(stockPL)} stock PnL</div>
            <button style={Object.assign({},S.btn,{marginTop:8,fontSize:9,padding:"3px 10px"})} onClick={function(){setModal("nlv");}}>Update NLV</button>
          </div>
        </div>
        <div style={{display:"flex",overflowX:"auto",gap:0}}>
          {tabs.map(function(t){
            var active=tab===t;
            return (
              <button key={t} onClick={function(){setTab(t);}} style={{background:"none",border:"none",borderBottom:active?"2px solid "+C.green:"2px solid transparent",cursor:"pointer",fontFamily:"'IBM Plex Mono',monospace",fontSize:10,letterSpacing:"0.15em",textTransform:"uppercase",padding:"10px 16px",color:active?C.green:C.textMid,whiteSpace:"nowrap",transition:"color 0.2s"}}>
                {t}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{padding:"20px 24px"}}>

        {tab==="overview"&&(
          <div>
            <Card>
              <div style={{fontSize:9,letterSpacing:"0.14em",textTransform:"uppercase",color:C.textDim,marginBottom:12}}>Goal Progress to $250,000</div>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:12,alignItems:"flex-end"}}>
                <div><div style={S.lbl}>Current</div><div style={Object.assign({},S.big,{color:C.green,fontSize:32})}>${nlv.toLocaleString()}</div></div>
                <div style={{textAlign:"center"}}><div style={S.lbl}>Progress</div><div style={Object.assign({},S.big,{fontSize:22})}>{progress.toFixed(1)}%</div></div>
                <div style={{textAlign:"right"}}><div style={S.lbl}>Remaining</div><div style={Object.assign({},S.big,{fontSize:22,color:C.textDim})}>${remaining.toLocaleString()}</div></div>
              </div>
              <BarFill pct={progress} />
              <div style={{display:"flex",justifyContent:"space-between",marginTop:6,fontSize:9,color:C.textFaint}}>
                <span>$0</span><span style={{color:C.green}}>${remaining.toLocaleString()} to go</span><span>$250k</span>
              </div>
            </Card>

            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:12}}>
              <Card><div style={S.lbl}>Premium YTD</div><div style={Object.assign({},S.big,{color:C.green,fontSize:24})}>${totalIncome.toLocaleString()}</div></Card>
              <Card>
                <div style={S.lbl}>Monthly Yield</div>
                <div style={Object.assign({},S.big,{color:C.blue,fontSize:24})}>{monthlyYield}%</div>
                <div style={{fontSize:9,color:C.textDim,marginTop:2}}>${avgIncome}/mo on NLV</div>
              </Card>
              <Card>
                <div style={S.lbl}>Annual Yield</div>
                <div style={Object.assign({},S.big,{color:C.yellow,fontSize:24})}>{annualYield}%</div>
                <div style={{fontSize:9,color:C.textDim,marginTop:2}}>${(avgIncome*12).toLocaleString()}/yr projected</div>
              </Card>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:12}}>
              <Card><div style={S.lbl}>Avg / Month</div><div style={Object.assign({},S.big,{fontSize:22})}>${avgIncome.toLocaleString()}</div></Card>
              <Card><div style={S.lbl}>Open Options</div><div style={Object.assign({},S.big,{fontSize:22})}>{options.length}</div></Card>
              <Card><div style={S.lbl}>Open Spreads</div><div style={Object.assign({},S.big,{fontSize:22})}>{spreads.length}</div></Card>
            </div>

            <Card>
              <div style={{fontSize:9,letterSpacing:"0.14em",textTransform:"uppercase",color:C.textDim,marginBottom:8}}>Income Replacement Target $8,000/mo</div>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:8,fontSize:11}}>
                <span style={{color:C.textMid}}>Current avg</span><span style={{color:C.green}}>${avgIncome}/mo</span>
              </div>
              <BarFill pct={Math.min((avgIncome/8000)*100,100)} gradient={"linear-gradient(90deg,"+C.blue+","+C.green+")"} />
              <div style={{fontSize:9,color:C.textFaint,marginTop:5,textAlign:"right"}}>{((avgIncome/8000)*100).toFixed(1)}% of $8,000 target</div>
            </Card>

            <Card>
              <div style={{fontSize:9,letterSpacing:"0.14em",textTransform:"uppercase",color:C.textDim,marginBottom:12}}>Upcoming Expiries</div>
              {[].concat(
                options.map(function(o){return Object.assign({},o,{dte:getDTE(o.expiry),dispLabel:"$"+o.strike+" "+o.type});}),
                spreads.map(function(s){return Object.assign({},s,{dte:getDTE(s.expiry),dispLabel:s.strategy});})
              ).sort(function(a,b){return a.dte-b.dte;}).slice(0,6).map(function(o,i){
                return (
                  <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:i<5?"1px solid "+C.border:"none"}}>
                    <div style={{display:"flex",gap:10,alignItems:"center"}}>
                      <span style={S.ticker}>{o.ticker}</span>
                      <span style={{fontSize:10,color:C.textDim}}>{o.dispLabel}</span>
                    </div>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      <span style={{fontSize:9,color:C.textFaint}}>{o.expiry}</span>
                      <DtePill dte={o.dte} />
                    </div>
                  </div>
                );
              })}
            </Card>
          </div>
        )}

        {tab==="positions"&&(
          <Card>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div style={{fontSize:9,letterSpacing:"0.14em",textTransform:"uppercase",color:C.textDim}}>Stock Positions</div>
              <Btn onClick={function(){setModal("stock");}}>+ Add</Btn>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"80px 70px 80px 80px 80px 36px",gap:6,fontSize:9,color:C.textFaint,paddingBottom:8,borderBottom:"1px solid "+C.border}}>
              <span>Ticker</span><span>Shares</span><span>Avg</span><span>Last</span><span>PnL</span><span></span>
            </div>
            {stocks.map(function(p){
              var pl=(p.lastPrice-p.avgPrice)*p.shares, px=p.currency==="AUD"?"A$":"$";
              return (
                <div key={p.id} style={{display:"grid",gridTemplateColumns:"80px 70px 80px 80px 80px 36px",gap:6,alignItems:"center",fontSize:11,padding:"10px 0",borderBottom:"1px solid "+C.border}}>
                  <span style={S.ticker}>{p.ticker}</span>
                  <span style={{color:C.textMid}}>{p.shares.toLocaleString()}</span>
                  <span style={{color:C.textDim}}>{px}{p.avgPrice.toFixed(2)}</span>
                  <span>{px}{p.lastPrice.toFixed(2)}</span>
                  <span style={{color:pl>=0?C.green:C.red,fontWeight:600}}>{fmtSign(pl,p.currency)}</span>
                  <BtnRed onClick={function(){delStock(p.id);}}>x</BtnRed>
                </div>
              );
            })}
            <div style={{display:"grid",gridTemplateColumns:"80px 70px 80px 80px 80px 36px",gap:6,alignItems:"center",marginTop:10,paddingTop:10,borderTop:"1px solid rgba(255,255,255,0.1)",fontSize:11}}>
              <span style={{fontSize:9,color:C.textFaint}}>TOTAL</span><span/><span/><span/>
              <span style={{color:stockPL>=0?C.green:C.red,fontWeight:700}}>{fmtSign(stockPL)}</span><span/>
            </div>
          </Card>
        )}

        {tab==="options"&&(
          <Card>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div style={{fontSize:9,letterSpacing:"0.14em",textTransform:"uppercase",color:C.textDim}}>Single-Leg Options</div>
              <Btn onClick={function(){setModal("option");}}>+ Add</Btn>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"70px 50px 50px 70px 60px 50px 36px",gap:6,fontSize:9,color:C.textFaint,paddingBottom:8,borderBottom:"1px solid "+C.border}}>
              <span>Ticker</span><span>Side</span><span>Type</span><span>Strike</span><span>Expiry</span><span>DTE</span><span></span>
            </div>
            {[].concat(options).sort(function(a,b){return getDTE(a.expiry)-getDTE(b.expiry);}).map(function(o){
              var dte=getDTE(o.expiry);
              return (
                <div key={o.id} style={{display:"grid",gridTemplateColumns:"70px 50px 50px 70px 60px 50px 36px",gap:6,alignItems:"center",fontSize:11,padding:"10px 0",borderBottom:"1px solid "+C.border}}>
                  <span style={S.ticker}>{o.ticker}</span>
                  <span style={{color:o.side==="short"?C.red:C.green,fontSize:10}}>{o.side}</span>
                  <span style={{color:o.type==="call"?C.yellow:C.blue,fontSize:10}}>{o.type}</span>
                  <span>${o.strike}</span>
                  <span style={{fontSize:9,color:C.textDim}}>{o.expiry.slice(5)}</span>
                  <DtePill dte={dte} />
                  <BtnRed onClick={function(){delOption(o.id);}}>x</BtnRed>
                </div>
              );
            })}
          </Card>
        )}

        {tab==="spreads"&&(
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div style={{fontSize:9,letterSpacing:"0.14em",textTransform:"uppercase",color:C.textDim}}>Spread Positions</div>
              <Btn onClick={function(){setModal("spread");}}>+ Add Spread</Btn>
            </div>
            {spreads.length===0&&(
              <Card><div style={{textAlign:"center",color:C.textFaint,fontSize:11,padding:40}}>No spreads yet. Import your IBKR CSV or click + Add Spread.</div></Card>
            )}
            {spreads.map(function(sp){
              return <SpreadCard key={sp.id} sp={sp} onDelete={function(){delSpread(sp.id);}} />;
            })}
          </div>
        )}

        {tab==="income"&&(
          <div>
            <Card style={{padding:"12px 16px",marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:9,letterSpacing:"0.14em",textTransform:"uppercase",color:C.textDim}}>Year</span>
                  <select style={Object.assign({},S.inp,{width:"auto",padding:"5px 10px",fontSize:11})} value={incomeYear} onChange={function(e){setIncomeYear(e.target.value);}}>
                    <option value="all">All</option>
                    {availableYears.map(function(y){return <option key={y} value={y}>{y}</option>;})}
                  </select>
                </div>
                <div style={{display:"flex",gap:0,border:"1px solid "+C.border,borderRadius:4,overflow:"hidden"}}>
                  {[{k:"alltime",l:"All-time"},{k:"trailing",l:"Trailing 3mo"}].map(function(opt){
                    var active=incomeMode===opt.k;
                    return (
                      <button key={opt.k} onClick={function(){setIncomeMode(opt.k);}} style={{background:active?"rgba(6,214,160,0.15)":"transparent",border:"none",color:active?C.green:C.textDim,fontFamily:"'IBM Plex Mono',monospace",fontSize:10,letterSpacing:"0.08em",padding:"6px 14px",cursor:"pointer"}}>{opt.l}</button>
                    );
                  })}
                </div>
              </div>
            </Card>

            <Card>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                <div style={{fontSize:9,letterSpacing:"0.14em",textTransform:"uppercase",color:C.textDim}}>Monthly Premium Income</div>
                <div style={{fontSize:9,color:C.textFaint,fontStyle:"italic"}}>cash flow from journal</div>
              </div>
              {filteredIncome.length>0?(function(){
                var maxVal=Math.max.apply(null,filteredIncome.map(function(m){return Math.abs(m.premium);}));
                return (
                  <div>
                    <div style={{display:"flex",alignItems:"flex-end",gap:8,height:130,marginBottom:10}}>
                      {filteredIncome.map(function(m,i){
                        var pct=maxVal>0?(Math.abs(m.premium)/maxVal)*100:0;
                        var isLast=i===filteredIncome.length-1;
                        var isNeg=m.premium<0;
                        return (
                          <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",height:"100%",justifyContent:"flex-end"}}>
                            <div style={{fontSize:9,color:isNeg?C.red:C.green,marginBottom:4}}>${m.premium}</div>
                            <div style={{width:"100%",height:pct+"%",background:isNeg?"rgba(255,107,107,0.2)":(isLast?"linear-gradient(180deg,"+C.green+",rgba(6,214,160,0.2))":"rgba(6,214,160,0.2)"),border:"1px solid "+(isNeg?"rgba(255,107,107,0.3)":"rgba(6,214,160,0.3)"),borderRadius:"3px 3px 0 0"}} />
                          </div>
                        );
                      })}
                    </div>
                    <div style={{display:"flex",gap:8}}>{filteredIncome.map(function(m,i){return <div key={i} style={{flex:1,textAlign:"center",fontSize:8,color:C.textFaint}}>{m.label}</div>;})}</div>
                  </div>
                );
              })():(
                <div style={{textAlign:"center",color:C.textFaint,fontSize:11,padding:40}}>No options activity{incomeYear!=="all"?" in "+incomeYear:""}. Log SELL PUT, SELL CALL, BUY OPTION, SELL/CLOSE/ROLL SPREAD entries to populate.</div>
              )}
            </Card>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:12}}>
              <Card><div style={S.lbl}>Total{incomeYear==="all"?"":" "+incomeYear}</div><div style={Object.assign({},S.big,{color:C.green,fontSize:24})}>${totalIncome.toLocaleString()}</div></Card>
              <Card><div style={S.lbl}>{incomeMode==="trailing"?"3mo Avg":"Monthly Avg"}</div><div style={Object.assign({},S.big,{fontSize:24})}>${avgIncome.toLocaleString()}</div></Card>
              <Card><div style={S.lbl}>Annual Run Rate</div><div style={Object.assign({},S.big,{color:C.yellow,fontSize:24})}>${(avgIncome*12).toLocaleString()}</div></Card>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
              <Card><div style={S.lbl}>Monthly Yield on NLV</div><div style={Object.assign({},S.big,{color:C.blue,fontSize:24})}>{monthlyYield}%</div></Card>
              <Card><div style={S.lbl}>Annual Yield on NLV</div><div style={Object.assign({},S.big,{color:C.yellow,fontSize:24})}>{annualYield}%</div></Card>
            </div>
            <Card>
              <div style={{fontSize:9,letterSpacing:"0.14em",textTransform:"uppercase",color:C.textDim,marginBottom:10}}>Path to $8,000/mo</div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:8}}>
                <span style={{color:C.textMid}}>{incomeMode==="trailing"?"3mo avg":"All-time avg"}</span><span style={{color:C.green}}>${avgIncome}/mo</span>
              </div>
              <BarFill pct={Math.min((avgIncome/8000)*100,100)} gradient={"linear-gradient(90deg,"+C.blue+","+C.green+")"} />
              <div style={{fontSize:9,color:C.textFaint,marginTop:5,textAlign:"right"}}>{((avgIncome/8000)*100).toFixed(1)}% of $8,000 target</div>
            </Card>
          </div>
        )}

        {tab==="journal"&&(
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div style={{fontSize:9,letterSpacing:"0.14em",textTransform:"uppercase",color:C.textDim}}>Trade Journal</div>
              <Btn onClick={function(){setModal("journal");}}>+ Add Entry</Btn>
            </div>
            {journal.map(function(j){
              return (
                <Card key={j.id}>
                  <div style={{position:"absolute",top:14,right:14}}><BtnRed onClick={function(){delJournal(j.id);}}>x</BtnRed></div>
                  <div style={{display:"flex",gap:10,alignItems:"baseline",marginBottom:10,paddingRight:40}}>
                    <span style={Object.assign({},S.ticker,{fontSize:14})}>{j.ticker}</span>
                    <span style={{fontSize:10,color:C.textMid,background:"rgba(255,255,255,0.06)",padding:"2px 7px",borderRadius:3}}>{j.action}</span>
                    <span style={{fontSize:9,color:C.textFaint,marginLeft:"auto"}}>{j.date}</span>
                  </div>
                  <div style={{display:"flex",gap:20,marginBottom:10,fontSize:11}}>
                    <div><div style={S.lbl}>Price</div><span>{fmtPlain(j.price,j.currency)}</span></div>
                    <div><div style={S.lbl}>Qty</div><span>{j.qty}</span></div>
                    <div><div style={S.lbl}>PnL</div><span style={{color:j.pnl>=0?C.green:C.red,fontWeight:600}}>{fmtSign(j.pnl,j.currency)}</span></div>
                  </div>
                  {j.notes&&<div style={{fontSize:10,color:C.textDim,fontStyle:"italic",marginBottom:8,lineHeight:1.6}}>{j.notes}</div>}
                  <div>{(j.tags||[]).map(function(t,i){return <span key={i} style={S.tag}>{t}</span>;})}</div>
                </Card>
              );
            })}
          </div>
        )}

        {tab==="import"&&(
          <div>
            <Card>
              <div style={{fontSize:9,letterSpacing:"0.14em",textTransform:"uppercase",color:C.textDim,marginBottom:12}}>Import IBKR Activity Statement</div>
              <div style={{fontSize:11,color:C.textDim,marginBottom:14,lineHeight:1.8}}>Export your Activity Statement from IBKR as a CSV file. Positions will be fully replaced on import. New trades are added to your journal without duplicates.</div>
              <div style={{fontSize:10,color:C.textFaint,marginBottom:10}}>In IBKR: Reports &gt; Activity &gt; Statements &gt; Activity Statement &gt; CSV</div>
              <div onClick={function(){fileRef.current&&fileRef.current.click();}} style={{border:"1px dashed rgba(6,214,160,0.35)",borderRadius:6,padding:28,textAlign:"center",cursor:"pointer",background:"rgba(6,214,160,0.04)"}}>
                <div style={{fontSize:28,marginBottom:8}}>^</div>
                <div style={{fontSize:12,color:C.textMid}}>Tap to upload IBKR Activity Statement CSV</div>
                <div style={{fontSize:9,color:C.textFaint,marginTop:4}}>Imports: Stocks, Options, Spreads, Trades</div>
                <input ref={fileRef} type="file" accept=".csv" style={{display:"none"}} onChange={handleFile} />
              </div>
              {importMsg&&<div style={{marginTop:12,padding:"10px 14px",background:C.greenDim,border:"1px solid rgba(6,214,160,0.25)",borderRadius:4,fontSize:11,color:C.green}}>{importMsg}</div>}
            </Card>
            <Card>
              <div style={{fontSize:9,letterSpacing:"0.14em",textTransform:"uppercase",color:C.textDim,marginBottom:10}}>Manual NLV Update</div>
              <div style={{fontSize:11,color:C.textDim,marginBottom:12}}>Update your Net Liquidation Value directly from your IBKR portfolio screen.</div>
              <Btn onClick={function(){setModal("nlv");}}>Update NLV</Btn>
            </Card>
            <Card>
              <div style={{fontSize:9,letterSpacing:"0.14em",textTransform:"uppercase",color:C.textDim,marginBottom:10}}>Current Data Summary</div>
              {[{label:"Stock positions",val:stocks.length},{label:"Option positions",val:options.length},{label:"Spread positions",val:spreads.length},{label:"Journal entries",val:journal.length},{label:"Income months",val:income.length}].map(function(r,i){
                return <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:i<4?"1px solid "+C.border:"none",fontSize:11}}><span style={{color:C.textDim}}>{r.label}</span><span style={{color:C.green}}>{r.val}</span></div>;
              })}
            </Card>
            <Card>
              <div style={{fontSize:9,letterSpacing:"0.14em",textTransform:"uppercase",color:C.textDim,marginBottom:10}}>Reset All Data</div>
              <div style={{fontSize:11,color:C.textDim,marginBottom:12}}>Clears all data from this device. <span style={{color:C.red}}>Cannot be undone.</span></div>
              {!showReset
                ?<BtnRed onClick={function(){setShowReset(true);}}>Reset Portfolio Data</BtnRed>
                :<div style={{display:"flex",gap:8,alignItems:"center"}}><span style={{fontSize:11,color:C.red}}>Are you sure?</span><BtnRed onClick={clearAllData}>Yes, Reset</BtnRed><Btn onClick={function(){setShowReset(false);}}>Cancel</Btn></div>
              }
            </Card>
          </div>
        )}
      </div>

      {modal&&(
        <div style={S.modalBg} onClick={function(e){if(e.target===e.currentTarget)closeModal();}}>
          <div style={S.modal}>
            {modal==="nlv"     &&<NLVModal     nlv={nlv} onSave={function(v){setNlv(v);closeModal();}} onClose={closeModal} />}
            {modal==="stock"   &&<StockModal   onSave={function(s){setStocks(function(p){return p.concat([Object.assign({},s,{id:uid()})]);});closeModal();}} onClose={closeModal} />}
            {modal==="option"  &&<OptionModal  onSave={function(o){setOptions(function(p){return p.concat([Object.assign({},o,{id:uid()})]);});closeModal();}} onClose={closeModal} />}
            {modal==="spread"  &&<SpreadModal  onSave={function(s){setSpreads(function(p){return p.concat([Object.assign({},s,{id:uid()})]);});closeModal();}} onClose={closeModal} />}
            {modal==="journal" &&<JournalModal onSave={function(j){setJournal(function(p){return [Object.assign({},j,{id:uid()})].concat(p);});closeModal();}} onClose={closeModal} />}
          </div>
        </div>
      )}

      <div style={{padding:"14px 24px",borderTop:"1px solid "+C.border,display:"flex",justifyContent:"space-between",fontSize:9,color:C.textFaint}}>
        <span>PORTFOLIO TERMINAL v2.0</span>
        <span style={{color:C.green}}>* AUTO-SAVED TO DEVICE</span>
        <span>AUD/USD {AUD_USD}</span>
      </div>
    </div>
  );
}
