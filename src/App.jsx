import { useState, useRef, useCallback } from "react";

function usePersistedState(key, defaultValue) {
  const [state, setStateRaw] = useState(function() {
    try {
      var stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch(e) {
      return defaultValue;
    }
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
  ["pt_nlv","pt_stocks","pt_options","pt_spreads","pt_journal","pt_income"].forEach(function(k) {
    localStorage.removeItem(k);
  });
  window.location.reload();
}

var GOAL = 250000;
var AUD_USD = 0.7147;

var SEED_STOCKS = [
  { id:"s1", ticker:"ASTS",  shares:100,   avgPrice:97.00,  lastPrice:72.24,  currency:"USD" },
  { id:"s2", ticker:"GOOG",  shares:100,   avgPrice:310.00, lastPrice:347.65, currency:"USD" },
  { id:"s3", ticker:"SPY",   shares:100,   avgPrice:706.44, lastPrice:712.80, currency:"USD" },
  { id:"s4", ticker:"JEPQ",  shares:200,   avgPrice:51.61,  lastPrice:58.99,  currency:"USD" },
  { id:"s5", ticker:"FSCO",  shares:1058,  avgPrice:6.76,   lastPrice:5.22,   currency:"USD" },
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
  { id:"o7", ticker:"QQQ",   side:"short", type:"put",  strike:579, expiry:"2026-05-29", premium:2.00,  qty:1, currency:"USD" },
];

var SEED_SPREADS = [
  {
    id:"sp1", ticker:"NVDA", strategy:"Bull Put Spread",
    shortStrike:180, longStrike:175, expiry:"2026-06-05",
    credit:0.64, qty:5, width:5, currency:"USD",
    notes:"Post-tariff recovery play. Earnings May 21 - watch closely.",
    openDate:"2026-04-28",
  },
];

var SEED_JOURNAL = [
  {
    id:"j1", date:"2026-04-27", ticker:"CVL", action:"SELL STOCK",
    price:1.48, qty:4963, pnl:2691, currency:"AUD",
    notes:"Sold CVL ASX. 54% gain. Proceeds to clear IBKR margin debt.",
    tags:["exit","profit","portfolio-cleanup"],
  },
  {
    id:"j2", date:"2026-03-17", ticker:"NVDA", action:"SELL PUT",
    price:19.47, qty:1, pnl:574, currency:"USD",
    notes:"Sold NVDA Jan 2028 $140 Put into tariff selloff. Target 70-80% profit before closing.",
    tags:["premium","long-dated","nvda"],
  },
  {
    id:"j3", date:"2026-04-15", ticker:"GOOG", action:"ROLL CALL",
    price:0, qty:1, pnl:0, currency:"USD",
    notes:"Rolled $320 CC to $350 Aug 21 for small credit. 118 DTE.",
    tags:["roll","covered-call","goog"],
  },
];

var SEED_INCOME = [
  { month:"2026-01", label:"Jan 26", premium:420 },
  { month:"2026-02", label:"Feb 26", premium:680 },
  { month:"2026-03", label:"Mar 26", premium:1240 },
  { month:"2026-04", label:"Apr 26", premium:890 },
];

function toUSD(val, currency) {
  return currency === "AUD" ? val * AUD_USD : val;
}

function fmtMoney(val, currency) {
  var prefix = currency === "AUD" ? "A$" : "$";
  var abs = Math.abs(val);
  var s = abs >= 1000 ? prefix + (abs / 1000).toFixed(1) + "k" : prefix + abs.toFixed(0);
  return val < 0 ? "-" + s : "+" + s;
}

function fmtPlain(val, currency) {
  var prefix = currency === "AUD" ? "A$" : "$";
  return prefix + Math.abs(val).toFixed(2);
}

function getDTE(expiry) {
  var diff = new Date(expiry) - new Date();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function getDteColor(dte) {
  if (dte <= 7)  return "#ff4444";
  if (dte <= 21) return "#ffaa00";
  if (dte <= 45) return "#00d4aa";
  return "#6b7fa3";
}

function uid() {
  return Math.random().toString(36).slice(2, 8);
}

function parseIBKRcsv(text) {
  var lines = text.split("\n").map(function(l) { return l.trim(); }).filter(Boolean);
  var stocks = []; var options = []; var trades = [];
  var section = "";
  for (var li = 0; li < lines.length; li++) {
    var cols = lines[li].split(",").map(function(c) { return c.replace(/^"|"$/g, "").trim(); });
    if (cols[0] === "Open Positions" && cols[1] === "Header") { section = "positions"; continue; }
    if (cols[0] === "Trades" && cols[1] === "Header") { section = "trades"; continue; }
    if (cols[1] === "Data") {
      if (section === "positions") {
        var cat = cols[2] || "";
        if (cat === "Stocks" || cat === "Equity") {
          stocks.push({ id:uid(), ticker:cols[3], shares:parseFloat(cols[5])||0, avgPrice:parseFloat(cols[6])||0, lastPrice:parseFloat(cols[7])||0, currency:cols[4]||"USD" });
        }
      }
      if (section === "trades") {
        trades.push({ id:uid(), date:(cols[6]||"").slice(0,10), ticker:cols[3], action:cols[2], price:parseFloat(cols[8])||0, qty:Math.abs(parseFloat(cols[7])||0), pnl:parseFloat(cols[11])||0, currency:cols[4]||"USD", notes:"Imported from IBKR", tags:["imported"] });
      }
    }
  }
  return { stocks:stocks, options:options, trades:trades };
}

var STYLES = {
  app: { minHeight:"100vh", background:"#080c14", color:"#e2e8f0", fontFamily:"'IBM Plex Mono', 'Courier New', monospace", paddingBottom:40 },
  card: { background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:4, padding:18, position:"relative", overflow:"hidden", marginBottom:12 },
  sectionTitle: { fontSize:9, letterSpacing:"0.18em", textTransform:"uppercase", color:"#4a5568", marginBottom:14 },
  lbl: { fontSize:9, letterSpacing:"0.12em", textTransform:"uppercase", color:"#4a5568", marginBottom:4 },
  metricVal: { fontFamily:"'Bebas Neue', sans-serif", fontSize:26, letterSpacing:"0.05em", lineHeight:1 },
  ticker: { color:"#00d4aa", fontWeight:600, fontSize:11 },
  inp: { background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color:"#e2e8f0", fontFamily:"'IBM Plex Mono', monospace", fontSize:11, padding:"6px 10px", borderRadius:3, width:"100%", outline:"none" },
  btn: { background:"rgba(0,212,170,0.1)", border:"1px solid rgba(0,212,170,0.3)", color:"#00d4aa", fontFamily:"'IBM Plex Mono', monospace", fontSize:10, letterSpacing:"0.1em", padding:"6px 14px", borderRadius:3, cursor:"pointer" },
  btnRed: { background:"rgba(255,68,68,0.1)", border:"1px solid rgba(255,68,68,0.3)", color:"#ff4444", fontFamily:"'IBM Plex Mono', monospace", fontSize:10, padding:"3px 8px", borderRadius:3, cursor:"pointer" },
  progressBar: { height:5, background:"rgba(255,255,255,0.07)", borderRadius:3, overflow:"hidden" },
  tag: { display:"inline-block", background:"rgba(0,168,255,0.12)", border:"1px solid rgba(0,168,255,0.25)", color:"#00a8ff", fontSize:9, padding:"1px 6px", borderRadius:2, marginRight:4 },
  modalBg: { position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:16 },
  modal: { background:"#0d1420", border:"1px solid rgba(0,212,170,0.2)", borderRadius:6, padding:24, width:"100%", maxWidth:480, maxHeight:"90vh", overflowY:"auto" },
};

function Card(props) {
  return (
    <div style={STYLES.card}>
      <div style={{ position:"absolute", top:0, left:0, right:0, height:1, background:"linear-gradient(90deg,transparent,rgba(0,212,170,0.25),transparent)" }} />
      {props.children}
    </div>
  );
}

function Btn(props) {
  return <button style={Object.assign({}, STYLES.btn, props.style || {})} onClick={props.onClick}>{props.children}</button>;
}

function BtnRed(props) {
  return <button style={STYLES.btnRed} onClick={props.onClick}>{props.children}</button>;
}

function Inp(props) {
  return <input style={STYLES.inp} type={props.type || "text"} value={props.value} onChange={props.onChange} placeholder={props.placeholder || ""} />;
}

function Lbl(props) {
  return <div style={STYLES.lbl}>{props.children}</div>;
}

function Field(props) {
  return (
    <div style={{ marginBottom:12 }}>
      <Lbl>{props.label}</Lbl>
      {props.children}
    </div>
  );
}

function DtePill(props) {
  var color = getDteColor(props.dte);
  return (
    <span style={{ display:"inline-block", padding:"2px 7px", borderRadius:2, fontSize:9, fontWeight:600, background:color+"18", color:color, border:"1px solid "+color+"33" }}>
      {props.dte}d
    </span>
  );
}

function ProgressBar(props) {
  return (
    <div style={STYLES.progressBar}>
      <div style={{ height:"100%", width:props.pct+"%", background:props.gradient || "linear-gradient(90deg,#00d4aa,#00a8ff)", borderRadius:3, transition:"width 0.8s ease", position:"relative" }}>
        <div style={{ position:"absolute", right:0, top:-3, bottom:-3, width:2, background:"white", borderRadius:2, boxShadow:"0 0 8px rgba(0,212,170,0.9)" }} />
      </div>
    </div>
  );
}

function ModalHeader(props) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
      <div style={{ fontSize:11, letterSpacing:"0.15em", textTransform:"uppercase", color:"#00d4aa" }}>{props.title}</div>
      <BtnRed onClick={props.onClose}>Close</BtnRed>
    </div>
  );
}

function NLVModal(props) {
  var [val, setVal] = useState(props.nlv);
  return (
    <div>
      <ModalHeader title="Update Net Liq Value" onClose={props.onClose} />
      <Field label="NLV (USD)">
        <Inp type="number" value={val} onChange={function(e) { setVal(+e.target.value); }} />
      </Field>
      <Btn style={{ width:"100%", marginTop:8 }} onClick={function() { props.onSave(val); }}>Save</Btn>
    </div>
  );
}

function StockModal(props) {
  var [f, setF] = useState({ ticker:"", shares:"", avgPrice:"", lastPrice:"", currency:"USD" });
  function upd(k, v) { setF(function(p) { return Object.assign({}, p, { [k]:v }); }); }
  return (
    <div>
      <ModalHeader title="Add Stock Position" onClose={props.onClose} />
      <Field label="Ticker">
        <Inp value={f.ticker} onChange={function(e) { upd("ticker", e.target.value.toUpperCase()); }} />
      </Field>
      <div style={{ display:"flex", gap:10 }}>
        <div style={{ flex:1 }}>
          <Field label="Shares">
            <Inp type="number" value={f.shares} onChange={function(e) { upd("shares", +e.target.value); }} />
          </Field>
        </div>
        <div style={{ flex:1 }}>
          <Field label="Currency">
            <select style={STYLES.inp} value={f.currency} onChange={function(e) { upd("currency", e.target.value); }}>
              <option>USD</option>
              <option>AUD</option>
            </select>
          </Field>
        </div>
      </div>
      <div style={{ display:"flex", gap:10 }}>
        <div style={{ flex:1 }}>
          <Field label="Avg Price">
            <Inp type="number" value={f.avgPrice} onChange={function(e) { upd("avgPrice", +e.target.value); }} />
          </Field>
        </div>
        <div style={{ flex:1 }}>
          <Field label="Last Price">
            <Inp type="number" value={f.lastPrice} onChange={function(e) { upd("lastPrice", +e.target.value); }} />
          </Field>
        </div>
      </div>
      <Btn style={{ width:"100%", marginTop:8 }} onClick={function() { if (f.ticker) props.onSave(f); }}>Add Position</Btn>
    </div>
  );
}

function OptionModal(props) {
  var [f, setF] = useState({ ticker:"", side:"short", type:"put", strike:"", expiry:"", premium:"", qty:1, currency:"USD" });
  function upd(k, v) { setF(function(p) { return Object.assign({}, p, { [k]:v }); }); }
  return (
    <div>
      <ModalHeader title="Add Option Position" onClose={props.onClose} />
      <div style={{ display:"flex", gap:10 }}>
        <div style={{ flex:1 }}>
          <Field label="Ticker">
            <Inp value={f.ticker} onChange={function(e) { upd("ticker", e.target.value.toUpperCase()); }} />
          </Field>
        </div>
        <div style={{ flex:1 }}>
          <Field label="Side">
            <select style={STYLES.inp} value={f.side} onChange={function(e) { upd("side", e.target.value); }}>
              <option>short</option><option>long</option>
            </select>
          </Field>
        </div>
        <div style={{ flex:1 }}>
          <Field label="Type">
            <select style={STYLES.inp} value={f.type} onChange={function(e) { upd("type", e.target.value); }}>
              <option>put</option><option>call</option>
            </select>
          </Field>
        </div>
      </div>
      <div style={{ display:"flex", gap:10 }}>
        <div style={{ flex:1 }}>
          <Field label="Strike">
            <Inp type="number" value={f.strike} onChange={function(e) { upd("strike", +e.target.value); }} />
          </Field>
        </div>
        <div style={{ flex:1 }}>
          <Field label="Qty">
            <Inp type="number" value={f.qty} onChange={function(e) { upd("qty", +e.target.value); }} />
          </Field>
        </div>
      </div>
      <div style={{ display:"flex", gap:10 }}>
        <div style={{ flex:1 }}>
          <Field label="Expiry">
            <Inp type="date" value={f.expiry} onChange={function(e) { upd("expiry", e.target.value); }} />
          </Field>
        </div>
        <div style={{ flex:1 }}>
          <Field label="Premium">
            <Inp type="number" value={f.premium} onChange={function(e) { upd("premium", +e.target.value); }} />
          </Field>
        </div>
      </div>
      <Btn style={{ width:"100%", marginTop:8 }} onClick={function() { if (f.ticker) props.onSave(f); }}>Add Option</Btn>
    </div>
  );
}

function SpreadModal(props) {
  var [f, setF] = useState({ ticker:"", strategy:"Bull Put Spread", shortStrike:"", longStrike:"", expiry:"", credit:"", qty:1, currency:"USD", notes:"", openDate:new Date().toISOString().slice(0,10) });
  function upd(k, v) { setF(function(p) { return Object.assign({}, p, { [k]:v }); }); }
  var width = f.shortStrike && f.longStrike ? Math.abs(f.shortStrike - f.longStrike) : 0;
  var ror = width && f.credit ? ((+f.credit / width) * 100).toFixed(1) : null;
  var maxProfit = f.credit && f.qty ? (+f.credit * +f.qty * 100).toFixed(0) : null;
  var maxLoss = width && f.credit && f.qty ? ((width - +f.credit) * +f.qty * 100).toFixed(0) : null;
  return (
    <div>
      <ModalHeader title="Add Spread Position" onClose={props.onClose} />
      <div style={{ display:"flex", gap:10 }}>
        <div style={{ flex:1 }}>
          <Field label="Ticker">
            <Inp value={f.ticker} onChange={function(e) { upd("ticker", e.target.value.toUpperCase()); }} />
          </Field>
        </div>
        <div style={{ flex:2 }}>
          <Field label="Strategy">
            <select style={STYLES.inp} value={f.strategy} onChange={function(e) { upd("strategy", e.target.value); }}>
              <option>Bull Put Spread</option>
              <option>Bear Call Spread</option>
              <option>Iron Condor</option>
              <option>Debit Spread</option>
            </select>
          </Field>
        </div>
      </div>
      <div style={{ display:"flex", gap:10 }}>
        <div style={{ flex:1 }}>
          <Field label="Short Strike">
            <Inp type="number" value={f.shortStrike} onChange={function(e) { upd("shortStrike", +e.target.value); }} />
          </Field>
        </div>
        <div style={{ flex:1 }}>
          <Field label="Long Strike">
            <Inp type="number" value={f.longStrike} onChange={function(e) { upd("longStrike", +e.target.value); }} />
          </Field>
        </div>
        <div style={{ flex:1 }}>
          <Field label="Width">
            <Inp value={width || ""} onChange={function(){}} />
          </Field>
        </div>
      </div>
      <div style={{ display:"flex", gap:10 }}>
        <div style={{ flex:1 }}>
          <Field label="Credit">
            <Inp type="number" value={f.credit} onChange={function(e) { upd("credit", +e.target.value); }} />
          </Field>
        </div>
        <div style={{ flex:1 }}>
          <Field label="Qty">
            <Inp type="number" value={f.qty} onChange={function(e) { upd("qty", +e.target.value); }} />
          </Field>
        </div>
        <div style={{ flex:1 }}>
          <Field label="Expiry">
            <Inp type="date" value={f.expiry} onChange={function(e) { upd("expiry", e.target.value); }} />
          </Field>
        </div>
      </div>
      {width > 0 && f.credit > 0 && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, padding:12, background:"rgba(0,212,170,0.05)", border:"1px solid rgba(0,212,170,0.15)", borderRadius:3, marginBottom:12 }}>
          <div><Lbl>Max Profit</Lbl><div style={{ color:"#00d4aa", fontSize:12 }}>+${maxProfit}</div></div>
          <div><Lbl>Max Loss</Lbl><div style={{ color:"#ff4444", fontSize:12 }}>-${maxLoss}</div></div>
          <div><Lbl>RoR</Lbl><div style={{ color:"#ffaa00", fontSize:12 }}>{ror}%</div></div>
        </div>
      )}
      <Field label="Notes">
        <textarea style={Object.assign({}, STYLES.inp, { resize:"vertical" })} rows={3} value={f.notes} onChange={function(e) { upd("notes", e.target.value); }} />
      </Field>
      <Btn style={{ width:"100%", marginTop:4 }} onClick={function() { if (f.ticker && f.expiry) props.onSave(Object.assign({}, f, { width:width })); }}>Add Spread</Btn>
    </div>
  );
}

function JournalModal(props) {
  var [f, setF] = useState({ date:new Date().toISOString().slice(0,10), ticker:"", action:"SELL PUT", price:"", qty:"", pnl:"", currency:"USD", notes:"", tagInput:"", tags:[] });
  function upd(k, v) { setF(function(p) { return Object.assign({}, p, { [k]:v }); }); }
  function addTag() {
    if (f.tagInput.trim()) {
      setF(function(p) { return Object.assign({}, p, { tags:[].concat(p.tags, [p.tagInput.trim().toLowerCase()]), tagInput:"" }); });
    }
  }
  return (
    <div>
      <ModalHeader title="Add Journal Entry" onClose={props.onClose} />
      <div style={{ display:"flex", gap:10 }}>
        <div style={{ flex:1 }}>
          <Field label="Date">
            <Inp type="date" value={f.date} onChange={function(e) { upd("date", e.target.value); }} />
          </Field>
        </div>
        <div style={{ flex:1 }}>
          <Field label="Ticker">
            <Inp value={f.ticker} onChange={function(e) { upd("ticker", e.target.value.toUpperCase()); }} />
          </Field>
        </div>
      </div>
      <div style={{ display:"flex", gap:10 }}>
        <div style={{ flex:2 }}>
          <Field label="Action">
            <select style={STYLES.inp} value={f.action} onChange={function(e) { upd("action", e.target.value); }}>
              <option>SELL PUT</option>
              <option>SELL CALL</option>
              <option>BUY STOCK</option>
              <option>SELL STOCK</option>
              <option>SELL SPREAD</option>
              <option>CLOSE SPREAD</option>
              <option>ROLL OPTION</option>
              <option>ASSIGNMENT</option>
              <option>EXPIRY</option>
            </select>
          </Field>
        </div>
        <div style={{ flex:1 }}>
          <Field label="Currency">
            <select style={STYLES.inp} value={f.currency} onChange={function(e) { upd("currency", e.target.value); }}>
              <option>USD</option>
              <option>AUD</option>
            </select>
          </Field>
        </div>
      </div>
      <div style={{ display:"flex", gap:10 }}>
        <div style={{ flex:1 }}>
          <Field label="Price">
            <Inp type="number" value={f.price} onChange={function(e) { upd("price", +e.target.value); }} />
          </Field>
        </div>
        <div style={{ flex:1 }}>
          <Field label="Qty">
            <Inp type="number" value={f.qty} onChange={function(e) { upd("qty", +e.target.value); }} />
          </Field>
        </div>
        <div style={{ flex:1 }}>
          <Field label="PnL">
            <Inp type="number" value={f.pnl} onChange={function(e) { upd("pnl", +e.target.value); }} />
          </Field>
        </div>
      </div>
      <Field label="Notes">
        <textarea style={Object.assign({}, STYLES.inp, { resize:"vertical" })} rows={3} value={f.notes} onChange={function(e) { upd("notes", e.target.value); }} />
      </Field>
      <Field label="Tags">
        <div style={{ marginBottom:6 }}>
          {f.tags.map(function(t, i) {
            return (
              <span key={i} style={STYLES.tag}>
                {t}
                <span style={{ cursor:"pointer", marginLeft:3 }} onClick={function() {
                  setF(function(p) { return Object.assign({}, p, { tags:p.tags.filter(function(_,j) { return j !== i; }) }); });
                }}>x</span>
              </span>
            );
          })}
        </div>
        <div style={{ display:"flex", gap:6 }}>
          <Inp placeholder="e.g. premium, roll" value={f.tagInput} onChange={function(e) { upd("tagInput", e.target.value); }} />
          <Btn onClick={addTag}>Add</Btn>
        </div>
      </Field>
      <Btn style={{ width:"100%", marginTop:4 }} onClick={function() { if (f.ticker) props.onSave(f); }}>Save Entry</Btn>
    </div>
  );
}

function IncomeModal(props) {
  var [f, setF] = useState({ month:"", label:"", premium:"" });
  function upd(k, v) { setF(function(p) { return Object.assign({}, p, { [k]:v }); }); }
  return (
    <div>
      <ModalHeader title="Add Income Month" onClose={props.onClose} />
      <Field label="Month (YYYY-MM)">
        <Inp type="month" value={f.month} onChange={function(e) {
          var d = new Date(e.target.value + "-01");
          upd("month", e.target.value);
          upd("label", d.toLocaleString("default", { month:"short", year:"2-digit" }));
        }} />
      </Field>
      <Field label="Premium Collected (USD)">
        <Inp type="number" value={f.premium} onChange={function(e) { upd("premium", +e.target.value); }} />
      </Field>
      <Btn style={{ width:"100%", marginTop:8 }} onClick={function() { if (f.month && f.premium) props.onSave(f); }}>Add Month</Btn>
    </div>
  );
}

export default function App() {
  var [nlv, setNlv] = usePersistedState("pt_nlv", 182069);
  var [stocks, setStocks] = usePersistedState("pt_stocks", SEED_STOCKS);
  var [options, setOptions] = usePersistedState("pt_options", SEED_OPTIONS);
  var [spreads, setSpreads] = usePersistedState("pt_spreads", SEED_SPREADS);
  var [journal, setJournal] = usePersistedState("pt_journal", SEED_JOURNAL);
  var [income, setIncome] = usePersistedState("pt_income", SEED_INCOME);
  var [tab, setTab] = useState("overview");
  var [modal, setModal] = useState(null);
  var [importMsg, setImportMsg] = useState("");
  var [showReset, setShowReset] = useState(false);
  var fileRef = useRef();

  var stockPL = stocks.reduce(function(s, p) { return s + toUSD((p.lastPrice - p.avgPrice) * p.shares, p.currency); }, 0);
  var totalIncome = income.reduce(function(s, m) { return s + m.premium; }, 0);
  var avgIncome = income.length ? Math.round(totalIncome / income.length) : 0;
  var progress = Math.min((nlv / GOAL) * 100, 100);
  var remaining = GOAL - nlv;

  var handleFile = useCallback(function(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
      try {
        var result = parseIBKRcsv(ev.target.result);
        if (result.stocks.length) {
          setStocks(function(prev) {
            var tickers = new Set(prev.map(function(x) { return x.ticker; }));
            return prev.concat(result.stocks.filter(function(x) { return !tickers.has(x.ticker); }));
          });
        }
        if (result.trades.length) {
          setJournal(function(prev) { return result.trades.concat(prev); });
        }
        setImportMsg("Imported " + result.stocks.length + " stocks, " + result.trades.length + " trades from IBKR");
      } catch(err) {
        setImportMsg("Could not parse file. Ensure it is an IBKR Activity Statement CSV.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }, [setStocks, setJournal]);

  var tabs = ["overview", "positions", "options", "spreads", "income", "journal", "import"];

  function closeModal() { setModal(null); }

  return (
    <div style={STYLES.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600&family=Bebas+Neue&display=swap');
        * { box-sizing: border-box; }
        select option { background: #0d1420; }
      `}</style>

      <div style={{ borderBottom:"1px solid rgba(255,255,255,0.07)", padding:"20px 20px 0" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16, flexWrap:"wrap", gap:12 }}>
          <div>
            <div style={{ fontSize:9, letterSpacing:"0.2em", color:"#2d3748", marginBottom:4 }}>PORTFOLIO TERMINAL v2</div>
            <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:28, letterSpacing:"0.08em", color:"#fff" }}>TRADING DESK</div>
            <div style={{ display:"flex", gap:8, alignItems:"center", marginTop:4 }}>
              <div style={{ fontSize:9, color:"#4a5568" }}>AUD/USD {AUD_USD}</div>
              <div style={{ fontSize:9, color:"#00d4aa", letterSpacing:"0.05em" }}>* AUTO-SAVED</div>
            </div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={STYLES.lbl}>NET LIQ VALUE</div>
            <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:48, letterSpacing:"0.05em", color:"#fff", lineHeight:1 }}>${nlv.toLocaleString()}</div>
            <div style={{ fontSize:10, color: stockPL >= 0 ? "#00d4aa" : "#ff4444", marginTop:2 }}>
              {fmtMoney(stockPL)} stock PnL
            </div>
            <button style={Object.assign({}, STYLES.btn, { marginTop:6, fontSize:9, padding:"3px 8px" })} onClick={function() { setModal("nlv"); }}>Update NLV</button>
          </div>
        </div>
        <div style={{ display:"flex", overflowX:"auto", gap:0 }}>
          {tabs.map(function(t) {
            var isActive = tab === t;
            return (
              <button key={t} onClick={function() { setTab(t); }} style={{ background:"none", border:"none", borderBottom: isActive ? "2px solid #00d4aa" : "2px solid transparent", cursor:"pointer", fontFamily:"'IBM Plex Mono', monospace", fontSize:10, letterSpacing:"0.15em", textTransform:"uppercase", padding:"8px 14px", color: isActive ? "#00d4aa" : "#4a5568", whiteSpace:"nowrap" }}>
                {t}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ padding:"16px 20px" }}>

        {tab === "overview" && (
          <div>
            <Card>
              <div style={STYLES.sectionTitle}>Goal Progress to $250,000</div>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10, alignItems:"flex-end" }}>
                <div>
                  <div style={STYLES.lbl}>Current</div>
                  <div style={Object.assign({}, STYLES.metricVal, { color:"#00d4aa" })}>${nlv.toLocaleString()}</div>
                </div>
                <div style={{ textAlign:"center" }}>
                  <div style={STYLES.lbl}>Progress</div>
                  <div style={Object.assign({}, STYLES.metricVal, { fontSize:20 })}>{progress.toFixed(1)}%</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={STYLES.lbl}>Remaining</div>
                  <div style={Object.assign({}, STYLES.metricVal, { fontSize:20, color:"#6b7fa3" })}>${remaining.toLocaleString()}</div>
                </div>
              </div>
              <ProgressBar pct={progress} />
              <div style={{ display:"flex", justifyContent:"space-between", marginTop:6, fontSize:9, color:"#2d3748" }}>
                <span>$0</span>
                <span style={{ color:"#00d4aa" }}>${remaining.toLocaleString()} to go</span>
                <span>$250k</span>
              </div>
            </Card>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
              {[
                { label:"Premium YTD",  val:"$"+totalIncome.toLocaleString(), color:"#00d4aa" },
                { label:"Avg / Month",  val:"$"+avgIncome.toLocaleString(),   color:"#00a8ff" },
                { label:"Open Options", val:options.length,                    color:"#e2e8f0" },
                { label:"Open Spreads", val:spreads.length,                    color:"#e2e8f0" },
              ].map(function(m, i) {
                return (
                  <Card key={i}>
                    <div style={STYLES.lbl}>{m.label}</div>
                    <div style={Object.assign({}, STYLES.metricVal, { color:m.color, fontSize:22 })}>{m.val}</div>
                  </Card>
                );
              })}
            </div>

            <Card>
              <div style={STYLES.sectionTitle}>Income Replacement Target $8,000/mo</div>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8, fontSize:11 }}>
                <span style={{ color:"#a0aec0" }}>Current avg</span>
                <span style={{ color:"#00d4aa" }}>${avgIncome}/mo</span>
              </div>
              <ProgressBar pct={Math.min((avgIncome/8000)*100, 100)} gradient="linear-gradient(90deg,#00a8ff,#00d4aa)" />
              <div style={{ fontSize:9, color:"#4a5568", marginTop:5, textAlign:"right" }}>
                {((avgIncome/8000)*100).toFixed(1)}% of target
              </div>
            </Card>

            <Card>
              <div style={STYLES.sectionTitle}>Upcoming Expiries</div>
              {[].concat(
                options.map(function(o) { return Object.assign({}, o, { dte:getDTE(o.expiry), label:"$"+o.strike+" "+o.type }); }),
                spreads.map(function(s) { return Object.assign({}, s, { dte:getDTE(s.expiry), label:s.strategy }); })
              ).sort(function(a,b) { return a.dte - b.dte; }).slice(0,6).map(function(o, i) {
                return (
                  <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom: i < 5 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                    <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                      <span style={STYLES.ticker}>{o.ticker}</span>
                      <span style={{ fontSize:10, color:"#6b7fa3" }}>{o.label}</span>
                    </div>
                    <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                      <span style={{ fontSize:9, color:"#4a5568" }}>{o.expiry}</span>
                      <DtePill dte={o.dte} />
                    </div>
                  </div>
                );
              })}
            </Card>
          </div>
        )}

        {tab === "positions" && (
          <Card>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <div style={STYLES.sectionTitle}>Stock Positions</div>
              <Btn onClick={function() { setModal("stock"); }}>+ Add</Btn>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"70px 60px 70px 70px 70px 36px", gap:6, fontSize:9, color:"#2d3748", paddingBottom:6, borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
              <span>Ticker</span><span>Shares</span><span>Avg</span><span>Last</span><span>PnL</span><span></span>
            </div>
            {stocks.map(function(p) {
              var pl = (p.lastPrice - p.avgPrice) * p.shares;
              var prefix = p.currency === "AUD" ? "A$" : "$";
              return (
                <div key={p.id} style={{ display:"grid", gridTemplateColumns:"70px 60px 70px 70px 70px 36px", gap:6, alignItems:"center", fontSize:11, padding:"8px 0", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                  <span style={STYLES.ticker}>{p.ticker}</span>
                  <span style={{ color:"#a0aec0" }}>{p.shares.toLocaleString()}</span>
                  <span style={{ color:"#6b7fa3" }}>{prefix}{p.avgPrice.toFixed(2)}</span>
                  <span>{prefix}{p.lastPrice.toFixed(2)}</span>
                  <span style={{ color: pl >= 0 ? "#00d4aa" : "#ff4444", fontWeight:600 }}>{fmtMoney(pl, p.currency)}</span>
                  <BtnRed onClick={function() { setStocks(function(prev) { return prev.filter(function(x) { return x.id !== p.id; }); }); }}>x</BtnRed>
                </div>
              );
            })}
            <div style={{ display:"grid", gridTemplateColumns:"70px 60px 70px 70px 70px 36px", gap:6, alignItems:"center", marginTop:10, paddingTop:10, borderTop:"1px solid rgba(255,255,255,0.08)", fontSize:11 }}>
              <span style={{ fontSize:9, color:"#4a5568" }}>TOTAL</span>
              <span /><span /><span />
              <span style={{ color: stockPL >= 0 ? "#00d4aa" : "#ff4444", fontWeight:700 }}>{fmtMoney(stockPL)}</span>
              <span />
            </div>
          </Card>
        )}

        {tab === "options" && (
          <Card>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <div style={STYLES.sectionTitle}>Single-Leg Options</div>
              <Btn onClick={function() { setModal("option"); }}>+ Add</Btn>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"60px 44px 50px 60px 50px 44px 36px", gap:6, fontSize:9, color:"#2d3748", paddingBottom:6, borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
              <span>Ticker</span><span>Side</span><span>Type</span><span>Strike</span><span>Expiry</span><span>DTE</span><span></span>
            </div>
            {[].concat(options).sort(function(a,b) { return getDTE(a.expiry) - getDTE(b.expiry); }).map(function(o) {
              var dte = getDTE(o.expiry);
              return (
                <div key={o.id} style={{ display:"grid", gridTemplateColumns:"60px 44px 50px 60px 50px 44px 36px", gap:6, alignItems:"center", fontSize:11, padding:"8px 0", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                  <span style={STYLES.ticker}>{o.ticker}</span>
                  <span style={{ color: o.side === "short" ? "#ff4444" : "#00a8ff", fontSize:10 }}>{o.side}</span>
                  <span style={{ color: o.type === "call" ? "#ffaa00" : "#00a8ff", fontSize:10 }}>{o.type}</span>
                  <span>${o.strike}</span>
                  <span style={{ fontSize:9, color:"#6b7fa3" }}>{o.expiry.slice(5)}</span>
                  <DtePill dte={dte} />
                  <BtnRed onClick={function() { setOptions(function(prev) { return prev.filter(function(x) { return x.id !== o.id; }); }); }}>x</BtnRed>
                </div>
              );
            })}
          </Card>
        )}

        {tab === "spreads" && (
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <div style={STYLES.sectionTitle}>Spread Positions</div>
              <Btn onClick={function() { setModal("spread"); }}>+ Add Spread</Btn>
            </div>
            {spreads.length === 0 && (
              <Card>
                <div style={{ textAlign:"center", color:"#4a5568", fontSize:11, padding:32 }}>No spreads yet. Click + Add Spread to get started.</div>
              </Card>
            )}
            {spreads.map(function(sp) {
              var dte = getDTE(sp.expiry);
              var maxProfit = sp.credit * sp.qty * 100;
              var maxLoss = (sp.width - sp.credit) * sp.qty * 100;
              var breakEven = sp.shortStrike - sp.credit;
              var ror = ((sp.credit / sp.width) * 100).toFixed(1);
              return (
                <Card key={sp.id}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
                    <div>
                      <span style={Object.assign({}, STYLES.ticker, { fontSize:13 })}>{sp.ticker}</span>
                      <span style={{ fontSize:11, color:"#a0aec0", marginLeft:8 }}>{sp.strategy}</span>
                    </div>
                    <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                      <DtePill dte={dte} />
                      <BtnRed onClick={function() { setSpreads(function(prev) { return prev.filter(function(x) { return x.id !== sp.id; }); }); }}>x</BtnRed>
                    </div>
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:12 }}>
                    {[
                      { label:"Short Strike", val:"$"+sp.shortStrike },
                      { label:"Long Strike",  val:"$"+sp.longStrike },
                      { label:"Width",        val:"$"+sp.width },
                      { label:"Credit",       val:fmtPlain(sp.credit), color:"#00d4aa" },
                      { label:"Qty",          val:sp.qty },
                      { label:"Expiry",       val:sp.expiry.slice(5) },
                    ].map(function(m, i) {
                      return (
                        <div key={i}>
                          <div style={STYLES.lbl}>{m.label}</div>
                          <div style={{ fontSize:12, color:m.color || "#e2e8f0" }}>{m.val}</div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:8, padding:"10px 0", borderTop:"1px solid rgba(255,255,255,0.06)" }}>
                    <div><div style={STYLES.lbl}>Max Profit</div><div style={{ fontSize:12, color:"#00d4aa" }}>+${maxProfit.toFixed(0)}</div></div>
                    <div><div style={STYLES.lbl}>Max Loss</div><div style={{ fontSize:12, color:"#ff4444" }}>-${maxLoss.toFixed(0)}</div></div>
                    <div><div style={STYLES.lbl}>Break Even</div><div style={{ fontSize:12 }}>${breakEven.toFixed(2)}</div></div>
                    <div><div style={STYLES.lbl}>RoR</div><div style={{ fontSize:12, color:"#ffaa00" }}>{ror}%</div></div>
                  </div>
                  {sp.notes && (
                    <div style={{ marginTop:10, padding:"8px 10px", background:"rgba(255,255,255,0.03)", borderRadius:3, fontSize:10, color:"#6b7fa3", fontStyle:"italic" }}>
                      {sp.notes}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {tab === "income" && (
          <div>
            <Card>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                <div style={STYLES.sectionTitle}>Monthly Premium Income</div>
                <Btn onClick={function() { setModal("income"); }}>+ Add Month</Btn>
              </div>
              {income.length > 0 && (function() {
                var maxVal = Math.max.apply(null, income.map(function(m) { return m.premium; }));
                return (
                  <div>
                    <div style={{ display:"flex", alignItems:"flex-end", gap:8, height:120, marginBottom:8 }}>
                      {income.map(function(m, i) {
                        var pct = (m.premium / maxVal) * 100;
                        var isLast = i === income.length - 1;
                        return (
                          <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", height:"100%", justifyContent:"flex-end" }}>
                            <div style={{ fontSize:9, color:"#00d4aa", marginBottom:3 }}>${m.premium}</div>
                            <div style={{ width:"100%", height:pct+"%", background: isLast ? "linear-gradient(180deg,#00d4aa,rgba(0,168,255,0.27))" : "rgba(0,212,170,0.2)", border:"1px solid rgba(0,212,170,0.25)", borderRadius:"2px 2px 0 0" }} />
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ display:"flex", gap:8 }}>
                      {income.map(function(m, i) {
                        return <div key={i} style={{ flex:1, textAlign:"center", fontSize:8, color:"#4a5568" }}>{m.label}</div>;
                      })}
                    </div>
                  </div>
                );
              })()}
            </Card>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
              <Card>
                <div style={STYLES.lbl}>Total YTD</div>
                <div style={Object.assign({}, STYLES.metricVal, { color:"#00d4aa", fontSize:24 })}>${totalIncome.toLocaleString()}</div>
              </Card>
              <Card>
                <div style={STYLES.lbl}>Monthly Avg</div>
                <div style={Object.assign({}, STYLES.metricVal, { fontSize:24 })}>${avgIncome.toLocaleString()}</div>
              </Card>
            </div>
            <Card>
              <div style={STYLES.sectionTitle}>Path to $8,000/mo</div>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginBottom:8 }}>
                <span style={{ color:"#a0aec0" }}>Current avg</span>
                <span style={{ color:"#00d4aa" }}>${avgIncome}/mo</span>
              </div>
              <ProgressBar pct={Math.min((avgIncome/8000)*100, 100)} gradient="linear-gradient(90deg,#00a8ff,#00d4aa)" />
              <div style={{ fontSize:9, color:"#4a5568", marginTop:5, textAlign:"right" }}>
                {((avgIncome/8000)*100).toFixed(1)}% of $8,000 target
              </div>
            </Card>
          </div>
        )}

        {tab === "journal" && (
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <div style={STYLES.sectionTitle}>Trade Journal</div>
              <Btn onClick={function() { setModal("journal"); }}>+ Add Entry</Btn>
            </div>
            {journal.map(function(j) {
              return (
                <Card key={j.id}>
                  <div style={{ position:"absolute", top:12, right:12 }}>
                    <BtnRed onClick={function() { setJournal(function(prev) { return prev.filter(function(x) { return x.id !== j.id; }); }); }}>x</BtnRed>
                  </div>
                  <div style={{ display:"flex", gap:10, alignItems:"baseline", marginBottom:8, paddingRight:40 }}>
                    <span style={Object.assign({}, STYLES.ticker, { fontSize:13 })}>{j.ticker}</span>
                    <span style={{ fontSize:10, color:"#a0aec0" }}>{j.action}</span>
                    <span style={{ fontSize:9, color:"#4a5568", marginLeft:"auto" }}>{j.date}</span>
                  </div>
                  <div style={{ display:"flex", gap:16, marginBottom:10, fontSize:11 }}>
                    <div><div style={STYLES.lbl}>Price</div><span>{fmtPlain(j.price, j.currency)}</span></div>
                    <div><div style={STYLES.lbl}>Qty</div><span>{j.qty}</span></div>
                    <div><div style={STYLES.lbl}>PnL</div><span style={{ color: j.pnl >= 0 ? "#00d4aa" : "#ff4444", fontWeight:600 }}>{fmtMoney(j.pnl, j.currency)}</span></div>
                  </div>
                  {j.notes && <div style={{ fontSize:10, color:"#a0aec0", fontStyle:"italic", marginBottom:8, lineHeight:1.5 }}>{j.notes}</div>}
                  <div>
                    {(j.tags || []).map(function(t, i) { return <span key={i} style={STYLES.tag}>{t}</span>; })}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {tab === "import" && (
          <div>
            <Card>
              <div style={STYLES.sectionTitle}>Import IBKR Activity Statement</div>
              <div style={{ fontSize:11, color:"#6b7fa3", marginBottom:16, lineHeight:1.7 }}>
                Export your Activity Statement from IBKR as a CSV file, then upload it below. New positions will be merged without duplicating existing tickers.
              </div>
              <div style={{ fontSize:10, color:"#4a5568", marginBottom:8 }}>
                In IBKR: Reports &gt; Activity &gt; Statements &gt; Activity Statement &gt; CSV
              </div>
              <div
                onClick={function() { fileRef.current && fileRef.current.click(); }}
                style={{ border:"1px dashed rgba(0,212,170,0.3)", borderRadius:4, padding:24, textAlign:"center", cursor:"pointer", background:"rgba(0,212,170,0.03)" }}
              >
                <div style={{ fontSize:24, marginBottom:8 }}>^</div>
                <div style={{ fontSize:11, color:"#a0aec0" }}>Tap to upload IBKR Activity Statement CSV</div>
                <div style={{ fontSize:9, color:"#4a5568", marginTop:4 }}>Parses: Open Positions, Trades</div>
                <input ref={fileRef} type="file" accept=".csv" style={{ display:"none" }} onChange={handleFile} />
              </div>
              {importMsg && (
                <div style={{ marginTop:12, padding:"8px 12px", background:"rgba(0,212,170,0.08)", border:"1px solid rgba(0,212,170,0.2)", borderRadius:3, fontSize:11, color:"#00d4aa" }}>
                  {importMsg}
                </div>
              )}
            </Card>

            <Card>
              <div style={STYLES.sectionTitle}>Manual NLV Update</div>
              <div style={{ fontSize:11, color:"#6b7fa3", marginBottom:12 }}>Update your Net Liquidation Value directly from your IBKR portfolio screen.</div>
              <Btn onClick={function() { setModal("nlv"); }}>Update NLV</Btn>
            </Card>

            <Card>
              <div style={STYLES.sectionTitle}>Reset All Data</div>
              <div style={{ fontSize:11, color:"#6b7fa3", marginBottom:12 }}>
                Clears all positions and journal entries from this device.
                <span style={{ color:"#ff4444" }}> This cannot be undone.</span>
              </div>
              {!showReset
                ? <BtnRed onClick={function() { setShowReset(true); }}>Reset Portfolio Data</BtnRed>
                : (
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    <span style={{ fontSize:11, color:"#ff4444" }}>Are you sure?</span>
                    <BtnRed onClick={clearAllData}>Yes, Reset Everything</BtnRed>
                    <Btn onClick={function() { setShowReset(false); }}>Cancel</Btn>
                  </div>
                )
              }
            </Card>

            <Card>
              <div style={STYLES.sectionTitle}>Current Data Summary</div>
              {[
                { label:"Stock positions",  val:stocks.length },
                { label:"Option positions", val:options.length },
                { label:"Spread positions", val:spreads.length },
                { label:"Journal entries",  val:journal.length },
                { label:"Income months",    val:income.length },
              ].map(function(r, i) {
                return (
                  <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom: i < 4 ? "1px solid rgba(255,255,255,0.04)" : "none", fontSize:11 }}>
                    <span style={{ color:"#6b7fa3" }}>{r.label}</span>
                    <span style={{ color:"#00d4aa" }}>{r.val}</span>
                  </div>
                );
              })}
            </Card>
          </div>
        )}
      </div>

      {modal && (
        <div style={STYLES.modalBg} onClick={function(e) { if (e.target === e.currentTarget) closeModal(); }}>
          <div style={STYLES.modal}>
            {modal === "nlv"     && <NLVModal     nlv={nlv}       onSave={function(v) { setNlv(v);    closeModal(); }} onClose={closeModal} />}
            {modal === "stock"   && <StockModal               onSave={function(s) { setStocks(function(p) { return p.concat([Object.assign({},s,{id:uid()})]);  }); closeModal(); }} onClose={closeModal} />}
            {modal === "option"  && <OptionModal              onSave={function(o) { setOptions(function(p) { return p.concat([Object.assign({},o,{id:uid()})]); }); closeModal(); }} onClose={closeModal} />}
            {modal === "spread"  && <SpreadModal              onSave={function(s) { setSpreads(function(p) { return p.concat([Object.assign({},s,{id:uid()})]); }); closeModal(); }} onClose={closeModal} />}
            {modal === "journal" && <JournalModal             onSave={function(j) { setJournal(function(p) { return [Object.assign({},j,{id:uid()})].concat(p); }); closeModal(); }} onClose={closeModal} />}
            {modal === "income"  && <IncomeModal              onSave={function(m) { setIncome(function(p)  { return p.concat([m]);                               }); closeModal(); }} onClose={closeModal} />}
          </div>
        </div>
      )}

      <div style={{ padding:"12px 20px", borderTop:"1px solid rgba(255,255,255,0.05)", display:"flex", justifyContent:"space-between", fontSize:9, color:"#2d3748" }}>
        <span>PORTFOLIO TERMINAL v2.0</span>
        <span style={{ color:"#00d4aa" }}>* AUTO-SAVED TO DEVICE</span>
        <span>AUD/USD {AUD_USD}</span>
      </div>
    </div>
  );
}
