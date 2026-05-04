import { useState, useRef, useCallback, useEffect } from "react";

// PERSISTENT STATE HOOK
function usePersistedState(key, defaultValue) {
  const [state, setStateRaw] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch {
      return defaultValue;
    }
  });
  const setState = useCallback((valOrFn) => {
    setStateRaw(prev => {
      const next = typeof valOrFn === "function" ? valOrFn(prev) : valOrFn;
      try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [key]);
  return [state, setState];
}

// RESET HELPER (clears all app data from localStorage)
function clearAllData() {
  ["pt_nlv","pt_stocks","pt_options","pt_spreads","pt_journal","pt_income"].forEach(k => localStorage.removeItem(k));
  window.location.reload();
}

// INITIAL SEED DATA (your real positions)
const GOAL = 250000;

const SEED_STOCKS = [
  { id: "s1", ticker: "ASTS",  shares: 100,   avgPrice: 97.00,  lastPrice: 72.24,  currency: "USD" },
  { id: "s2", ticker: "GOOG",  shares: 100,   avgPrice: 310.00, lastPrice: 347.65, currency: "USD" },
  { id: "s3", ticker: "SPY",   shares: 100,   avgPrice: 706.44, lastPrice: 712.80, currency: "USD" },
  { id: "s4", ticker: "JEPQ",  shares: 200,   avgPrice: 51.61,  lastPrice: 58.99,  currency: "USD" },
  { id: "s5", ticker: "FSCO",  shares: 1058,  avgPrice: 6.76,   lastPrice: 5.22,   currency: "USD" },
  { id: "s6", ticker: "IMU",   shares: 958,   avgPrice: 0.126,  lastPrice: 0.115,  currency: "AUD" },
  { id: "s7", ticker: "PCI",   shares: 10000, avgPrice: 1.153,  lastPrice: 1.094,  currency: "AUD" },
];

const SEED_OPTIONS = [
  { id: "o1", ticker: "GOOG",  side: "short", type: "call", strike: 350, expiry: "2026-08-21", premium: 25.55,  qty: 1,  currency: "USD" },
  { id: "o2", ticker: "GOOGL", side: "short", type: "put",  strike: 305, expiry: "2026-06-18", premium: 3.69,   qty: 1,  currency: "USD" },
  { id: "o3", ticker: "ASTS",  side: "short", type: "put",  strike: 65,  expiry: "2026-05-22", premium: 4.45,   qty: 1,  currency: "USD" },
  { id: "o4", ticker: "ASTS",  side: "short", type: "put",  strike: 50,  expiry: "2026-05-29", premium: 1.00,   qty: 3,  currency: "USD" },
  { id: "o5", ticker: "NBIS",  side: "short", type: "put",  strike: 100, expiry: "2026-05-22", premium: 2.60,   qty: 2,  currency: "USD" },
  { id: "o6", ticker: "NVDA",  side: "short", type: "put",  strike: 140, expiry: "2028-01-21", premium: 12.73,  qty: 1,  currency: "USD" },
  { id: "o7", ticker: "QQQ",   side: "short", type: "put",  strike: 579, expiry: "2026-05-29", premium: 2.00,   qty: 1,  currency: "USD" },
];

const SEED_SPREADS = [
  {
    id: "sp1", ticker: "NVDA", strategy: "Bull Put Spread",
    shortStrike: 180, longStrike: 175, expiry: "2026-06-05",
    credit: 0.64, qty: 5, width: 5, currency: "USD",
    notes: "Post-tariff recovery play. Earnings May 21 - watch closely.",
    openDate: "2026-04-28",
  },
];

const SEED_JOURNAL = [
  {
    id: "j1", date: "2026-04-27", ticker: "CVL", action: "SELL STOCK",
    price: 1.48, qty: 4963, pnl: 2691, currency: "AUD",
    notes: "Sold CVL ASX. 54% gain. Proceeds to clear IBKR margin debt. Strategy pivot away from ASX stocks toward options selling.",
    tags: ["exit", "profit", "portfolio-cleanup"],
  },
  {
    id: "j2", date: "2026-03-17", ticker: "NVDA", action: "SELL PUT",
    price: 19.47, qty: 1, pnl: 574, currency: "USD",
    notes: "Sold NVDA Jan 2028 $140 Put into tariff selloff fear. High IV environment. Target 70-80% profit before closing.",
    tags: ["premium", "long-dated", "nvda"],
  },
  {
    id: "j3", date: "2026-04-15", ticker: "GOOG", action: "ROLL CALL",
    price: 0, qty: 1, pnl: 0, currency: "USD",
    notes: "Rolled $320 CC to $350 Aug 21 for small credit. Bought breathing room after assignment risk. 118 DTE.",
    tags: ["roll", "covered-call", "goog"],
  },
];

const SEED_INCOME = [
  { month: "2026-01", label: "Jan '26", premium: 420 },
  { month: "2026-02", label: "Feb '26", premium: 680 },
  { month: "2026-03", label: "Mar '26", premium: 1240 },
  { month: "2026-04", label: "Apr '26", premium: 890 },
];

// HELPERS
const AUD_USD = 0.7147;
const toUSD = (val, currency) => currency === "AUD" ? val * AUD_USD : val;
const fmt = (val, currency = "USD") => {
  const prefix = currency === "AUD" ? "A$" : "$";
  const abs = Math.abs(val);
  const s = abs >= 1000 ? `${prefix}${(abs / 1000).toFixed(1)}k` : `${prefix}${abs.toFixed(0)}`;
  return val < 0 ? `-${s}` : `+${s}`;
};
const fmtPlain = (val, currency = "USD") => {
  const prefix = currency === "AUD" ? "A$" : "$";
  return `${prefix}${Math.abs(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
const getDTE = (expiry) => {
  const diff = new Date(expiry) - new Date();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};
const getDteColor = (dte) => {
  if (dte <= 7)  return "#ff4444";
  if (dte <= 21) return "#ffaa00";
  if (dte <= 45) return "#00d4aa";
  return "#6b7fa3";
};
const uid = () => Math.random().toString(36).slice(2, 8);

// IBKR CSV PARSER
function parseIBKRcsv(text) {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const stocks = []; const options = []; const trades = [];
  let section = "";
  for (const line of lines) {
    const cols = line.split(",").map(c => c.replace(/^"|"$/g, "").trim());
    if (cols[0] === "Positions" && cols[1] === "Header") { section = ""; continue; }
    if (cols[0] === "Trades"    && cols[1] === "Header") { section = "trades"; continue; }
    if (cols[0] === "Open Positions" && cols[1] === "Header") { section = "positions"; continue; }
    if (cols[1] === "Data") {
      if (section === "positions") {
        const assetCat = cols[2] || "";
        if (assetCat === "Stocks" || assetCat === "Equity") {
          stocks.push({ id: uid(), ticker: cols[3], shares: parseFloat(cols[5]) || 0, avgPrice: parseFloat(cols[6]) || 0, lastPrice: parseFloat(cols[7]) || 0, currency: cols[4] || "USD" });
        }
        if (assetCat === "Options") {
          const desc = cols[3] || "";
          const parts = desc.split(" ");
          const ticker = parts[0];
          const strike = parseFloat(parts[parts.length - 2]) || 0;
          const type   = (parts[parts.length - 1] || "").toLowerCase() === "c" ? "call" : "put";
          const expRaw = parts[1] || "";
          options.push({ id: uid(), ticker, side: parseFloat(cols[5]) < 0 ? "short" : "long", type, strike, expiry: expRaw, premium: parseFloat(cols[7]) || 0, qty: Math.abs(parseFloat(cols[5]) || 1), currency: cols[4] || "USD" });
        }
      }
      if (section === "trades") {
        trades.push({ id: uid(), date: cols[6]?.slice(0,10) || "", ticker: cols[3], action: cols[2], price: parseFloat(cols[8]) || 0, qty: Math.abs(parseFloat(cols[7]) || 0), pnl: parseFloat(cols[11]) || 0, currency: cols[4] || "USD", notes: "Imported from IBKR", tags: ["imported"] });
      }
    }
  }
  return { stocks, options, trades };
}

// STYLES
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,300;0,400;0,500;0,600;1,400&family=Bebas+Neue&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
body{background:#080c14;}
.scanline{position:fixed;top:0;left:0;right:0;bottom:0;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,212,170,.012) 2px,rgba(0,212,170,.012) 4px);pointer-events:none;z-index:0;}
.card{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:4px;padding:18px;position:relative;overflow:hidden;}
.card::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(0,212,170,.25),transparent);}
.tab-btn{background:none;border:none;cursor:pointer;font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.15em;text-transform:uppercase;padding:8px 14px;color:#4a5568;border-bottom:2px solid transparent;transition:all .2s;white-space:nowrap;}
.tab-btn.active{color:#00d4aa;border-bottom-color:#00d4aa;}
.tab-btn:hover{color:#a0aec0;}
.btn{background:rgba(0,212,170,.1);border:1px solid rgba(0,212,170,.3);color:#00d4aa;font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.1em;padding:6px 14px;border-radius:3px;cursor:pointer;transition:all .2s;}
.btn:hover{background:rgba(0,212,170,.2);}
.btn-red{background:rgba(255,68,68,.1);border-color:rgba(255,68,68,.3);color:#ff4444;}
.btn-red:hover{background:rgba(255,68,68,.2);}
.btn-sm{padding:3px 8px;font-size:9px;}
.inp{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:#e2e8f0;font-family:'IBM Plex Mono',monospace;font-size:11px;padding:6px 10px;border-radius:3px;width:100%;}
.inp:focus{outline:none;border-color:rgba(0,212,170,.4);}
.lbl{font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:#4a5568;margin-bottom:4px;}
.row{display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap;}
.progress-bar{height:5px;background:rgba(255,255,255,.07);border-radius:3px;overflow:hidden;}
.progress-fill{height:100%;border-radius:3px;transition:width .8s ease;position:relative;}
.progress-fill::after{content:'';position:absolute;right:0;top:-3px;bottom:-3px;width:2px;background:#fff;border-radius:2px;box-shadow:0 0 8px rgba(0,212,170,.9);}
.tag{display:inline-block;background:rgba(0,168,255,.12);border:1px solid rgba(0,168,255,.25);color:#00a8ff;font-size:9px;padding:1px 6px;border-radius:2px;letter-spacing:.05em;}
.dte-pill{display:inline-block;padding:2px 7px;border-radius:2px;font-size:9px;font-weight:600;letter-spacing:.05em;}
.tbl-hdr{font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:#2d3748;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.05);}
.tbl-row{padding:9px 0;border-bottom:1px solid rgba(255,255,255,.04);transition:background .15s;}
.tbl-row:hover{background:rgba(255,255,255,.02);}
.tbl-row:last-child{border-bottom:none;}
.modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:100;display:flex;align-items:center;justify-content:center;padding:16px;}
.modal{background:#0d1420;border:1px solid rgba(0,212,170,.2);border-radius:6px;padding:24px;width:100%;max-width:480px;max-height:90vh;overflow-y:auto;}
.section-title{font-size:9px;letter-spacing:.18em;text-transform:uppercase;color:#4a5568;margin-bottom:14px;}
.nlv{font-family:'Bebas Neue',sans-serif;font-size:48px;letter-spacing:.05em;color:#fff;line-height:1;}
.metric-val{font-family:'Bebas Neue',sans-serif;font-size:26px;letter-spacing:.05em;line-height:1;}
.header-title{font-family:'Bebas Neue',sans-serif;font-size:28px;letter-spacing:.08em;color:#fff;}
.upload-zone{border:1px dashed rgba(0,212,170,.3);border-radius:4px;padding:24px;text-align:center;cursor:pointer;transition:all .2s;background:rgba(0,212,170,.03);}
.upload-zone:hover{border-color:rgba(0,212,170,.6);background:rgba(0,212,170,.07);}
.chip{display:inline-flex;align-items:center;gap:4px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:2px;font-size:9px;padding:2px 6px;color:#a0aec0;}
`;

// MAIN APP
export default function App() {
  const [nlv, setNlv]         = usePersistedState("pt_nlv",     182069);
  const [stocks, setStocks]   = usePersistedState("pt_stocks",  SEED_STOCKS);
  const [options, setOptions] = usePersistedState("pt_options", SEED_OPTIONS);
  const [spreads, setSpreads] = usePersistedState("pt_spreads", SEED_SPREADS);
  const [journal, setJournal] = usePersistedState("pt_journal", SEED_JOURNAL);
  const [income, setIncome]   = usePersistedState("pt_income",  SEED_INCOME);
  const [tab, setTab]         = useState("overview");
  const [modal, setModal]     = useState(null);
  const [importMsg, setImportMsg] = useState("");
  const [showReset, setShowReset] = useState(false);
  const fileRef = useRef();

  // derived
  const stockPL  = stocks.reduce((s,p) => s + toUSD((p.lastPrice - p.avgPrice) * p.shares, p.currency), 0);
  const optionPL = options.reduce((s,o) => {
    const current = o.premium;
    const openPremium = o.premium; // simplified -- shows current mark
    return s + (o.side === "short" ? 0 : 0); // P&L tracked via journal
  }, 0);
  const totalIncome = income.reduce((s,m) => s + m.premium, 0);
  const avgIncome   = income.length ? Math.round(totalIncome / income.length) : 0;
  const progress    = Math.min((nlv / GOAL) * 100, 100);
  const remaining   = GOAL - nlv;

  // IBKR import
  const handleFile = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const { stocks: s, options: o, trades: t } = parseIBKRcsv(ev.target.result);
        if (s.length) setStocks(prev => {
          const tickers = new Set(prev.map(x => x.ticker));
          return [...prev, ...s.filter(x => !tickers.has(x.ticker))];
        });
        if (o.length) setOptions(prev => [...prev, ...o]);
        if (t.length) setJournal(prev => [...t.map(x => ({...x, tags: x.tags || []})), ...prev]);
        setImportMsg(`v Imported ${s.length} stocks, ${o.length} options, ${t.length} trades from IBKR`);
      } catch {
        setImportMsg("! Could not parse file. Ensure it's an IBKR Activity Statement CSV.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }, []);

  const tabs = ["overview","positions","options","spreads","income","journal","import"];

  return (
    <div style={{ minHeight:"100vh", background:"#080c14", color:"#e2e8f0", fontFamily:"'IBM Plex Mono',monospace", paddingBottom:40 }}>
      <style>{CSS}</style>
      <div className="scanline"/>

      {/* HEADER */}
      <div style={{ position:"relative", zIndex:1, borderBottom:"1px solid rgba(255,255,255,.07)", padding:"20px 20px 0" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16, flexWrap:"wrap", gap:12 }}>
          <div>
            <div style={{ fontSize:9, letterSpacing:".2em", color:"#2d3748", marginBottom:4 }}>PORTFOLIO TERMINAL v2</div>
            <div className="header-title">TRADING DESK</div>
            <div style={{ display:"flex", gap:8, alignItems:"center", marginTop:4 }}>
              <div style={{ fontSize:9, color:"#4a5568" }}>AUD/USD {AUD_USD}</div>
              <div style={{ fontSize:9, color:"#00d4aa", letterSpacing:".05em" }}>* AUTO-SAVED</div>
            </div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div className="lbl">NET LIQ VALUE</div>
            <div className="nlv">${nlv.toLocaleString()}</div>
            <div style={{ fontSize:10, color: stockPL >= 0 ? "#00d4aa" : "#ff4444", marginTop:2 }}>
              {fmt(stockPL)} stock P&L
            </div>
            <button className="btn btn-sm" style={{ marginTop:6 }} onClick={() => setModal("nlv")}>Update NLV</button>
          </div>
        </div>
        <div style={{ display:"flex", overflowX:"auto", gap:0 }}>
          {tabs.map(t => (
            <button key={t} className={`tab-btn ${tab===t?"active":""}`} onClick={() => setTab(t)}>{t}</button>
          ))}
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ position:"relative", zIndex:1, padding:"16px 20px" }}>

        {/* OVERVIEW */}
        {tab === "overview" && (
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            {/* Goal */}
            <div className="card">
              <div className="section-title">Goal Progress to $250,000</div>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10, alignItems:"flex-end" }}>
                <div>
                  <div className="lbl">Current</div>
                  <div className="metric-val" style={{ color:"#00d4aa" }}>${nlv.toLocaleString()}</div>
                </div>
                <div style={{ textAlign:"center" }}>
                  <div className="lbl">Progress</div>
                  <div className="metric-val" style={{ font>Size:20 }}>{progress.toFixed(1)}%</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div className="lbl">Remaining</div>
                  <div className="metric-val" style={{ font>Size:20, color:"#6b7fa3" }}>${remaining.toLocaleString()}</div>
                </div>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width:`${progress}%`, background:"linear-gradient(90deg,#00d4aa,#00a8ff)" }}/>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", marginTop:6, fontSize:9, color:"#2d3748" }}>
                <span>$0</span><span style={{ color:"#00d4aa" }}>${remaining.toLocaleString()} to go</span><span>$250k</span>
              </div>
            </div>

            {/* Metrics grid */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              {[
                { label:"Premium YTD", val:`$${totalIncome.toLocaleString()}`, color:"#00d4aa" },
                { label:"Avg / Month",  val:`$${avgIncome.toLocaleString()}`,   color:"#00a8ff" },
                { label:"Open Options", val:options.length,                      color:"#e2e8f0" },
                { label:"Open Spreads", val:spreads.length,                      color:"#e2e8f0" },
              ].map((m,i) => (
                <div key={i} className="card">
                  <div className="lbl">>{m.label}</div>
                  <div className="metric-val" style={{ color:m.color, font>Size:22 }}>{m.val}</div>
                </div>
              ))}
            </div>

            {/* Income target */}
            <div className="card">
              <div className="section-title">Income Replacement Target $8,000/mo</div>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8, fontSize:11 }}>
                <span style={{ color:"#a0aec0" }}>Current avg</span>
                <span style={{ color:"#00d4aa" }}>${avgIncome.toLocaleString()}/mo</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width:`${Math.min((avgIncome/8000)*100,100)}%`, background:"linear-gradient(90deg,#00a8ff,#00d4aa)" }}/>
              </div>
              <div style={{ fontSize:9, color:"#4a5568", marginTop:5, textAlign:"right" }}>
                {((avgIncome/8000)*100).toFixed(1)}% of target
              </div>
            </div>

            {/* Expiry timeline */}
            <div className="card">
              <div className="section-title">Upcoming Expiries</div>
              {[...options, ...spreads.map(s => ({ ...s, type:"spread", side:"short" }))]
                .map(o => ({ ...o, dte: getDTE(o.expiry) }))
                .sort((a,b) => a.dte - b.dte)
                .slice(0,6)
                .map((o,i) => (
                  <div key={i} className="tbl-row" style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                      <span style={{ color:"#00d4aa", fontWeight:600, fontSize:11 }}>{o.ticker}</span>
                      <span style={{ fontSize:10, color:"#6b7fa3" }}>
                        {o.type === "spread" ? `${o.strategy}` : `$${o.strike} ${o.type}`}
                      </span>
                    </div>
                    <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                      <span style={{ fontSize:9, color:"#4a5568" }}>{o.expiry}</span>
                      <span className="dte-pill" style={{ background:`${getDteColor(o.dte)}18`, color:getDteColor(o.dte), border:`1px solid ${getDteColor(o.dte)}33` }}>
                        {o.dte}d
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* POSITIONS */}
        {tab === "positions" && (
          <div className="card">
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <div className="section-title" style={{ margin:0 }}>Stock Positions</div>
              <button className="btn btn-sm" onClick={() => setModal("stock")}>+ Add</button>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"70px 60px 70px 70px 70px 36px", gap:6, fontSize:9 }} className="tbl-hdr">
              <span>Ticker</span><span>Shares</span><span>Avg</span><span>Last</span><span>P&L</span><span></span>
            </div>
            {stocks.map(p => {
              const pl = (p.lastPrice - p.avgPrice) * p.shares;
              return (
                <div key={p.id} style={{ display:"grid", gridTemplateColumns:"70px 60px 70px 70px 70px 36px", gap:6, alignItems:"center", fontSize:11 }} className="tbl-row">
                  <span style={{ color:"#00d4aa", fontWeight:600 }}>{p.ticker}{p.currency==="AUD"&&<span style={{ fontSize:8, color:"#4a5568", marginLeft:2 }}>A</span>}</span>
                  <span style={{ color:"#a0aec0" }}>{p.shares.toLocaleString()}</span>
                  <span style={{ color:"#6b7fa3" }}>{fmtPlain(p.avgPrice, p.currency)}</span>
                  <span>{fmtPlain(p.lastPrice, p.currency)}</span>
                  <span style={{ color: pl>=0?"#00d4aa":"#ff4444", fontWeight:600 }}>{fmt(pl, p.currency)}</span>
                  <button className="btn btn-red btn-sm" onClick={() => setStocks(prev => prev.filter(x => x.id !== p.id))}>x</button>
                </div>
              );
            })}
            <div style={{ display:"grid", gridTemplateColumns:"70px 60px 70px 70px 70px 36px", gap:6, alignItems:"center", marginTop:10, paddingTop:10, borderTop:"1px solid rgba(255,255,255,.08)", fontSize:11 }}>
              <span style={{ fontSize:9, color:"#4a5568", letterSpacing:".1em" }}>TOTAL</span>
              <span/><span/><span/>
              <span style={{ color: stockPL>=0?"#00d4aa":"#ff4444", fontWeight:700 }}>{fmt(stockPL)}</span>
              <span/>
            </div>
          </div>
        )}

        {/* OPTIONS */}
        {tab === "options" && (
          <div className="card">
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <div className="section-title" style={{ margin:0 }}>Single-Leg Options</div>
              <button className="btn btn-sm" onClick={() => setModal("option")}>+ Add</button>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"60px 44px 50px 60px 44px 44px 36px", gap:6, fontSize:9 }} className="tbl-hdr">
              <span>Ticker</span><span>Side</span><span>Type</span><span>Strike</span><span>Expiry</span><span>DTE</span><span></span>
            </div>
            {[...options].sort((a,b) => getDTE(a.expiry) - getDTE(b.expiry)).map(o => {
              const dte = getDTE(o.expiry);
              return (
                <div key={o.id} style={{ display:"grid", gridTemplateColumns:"60px 44px 50px 60px 44px 44px 36px", gap:6, alignItems:"center", fontSize:11 }} className="tbl-row">
                  <span style={{ color:"#00d4aa", fontWeight:600 }}>{o.ticker}</span>
                  <span style={{ color: o.side==="short"?"#ff4444":"#00a8ff", fontSize:10 }}>{o.side}</span>
                  <span style={{ color: o.type==="call"?"#ffaa00":"#00a8ff", fontSize:10 }}>{o.type}</span>
                  <span>${o.strike}</span>
                  <span style={{ fontSize:9, color:"#6b7fa3" }}>{o.expiry.slice(5)}</span>
                  <span className="dte-pill" style={{ background:`${getDteColor(dte)}18`, color:getDteColor(dte), border:`1px solid ${getDteColor(dte)}33`, fontSize:9 }}>{dte}d</span>
                  <button className="btn btn-red btn-sm" onClick={() => setOptions(prev => prev.filter(x => x.id !== o.id))}>x</button>
                </div>
              );
            })}
          </div>
        )}

        {/* SPREADS */}
        {tab === "spreads" && (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div className="section-title" style={{ margin:0 }}>Spread Positions</div>
              <button className="btn btn-sm" onClick={() => setModal("spread")}>+ Add Spread</button>
            </div>
            {spreads.length === 0 && (
              <div className="card" style={{ textAlign:"center", color:"#4a5568", fontSize:11, padding:32 }}>
                No spreads yet. Click + Add Spread to get started.
              </div>
            )}
            {spreads.map(sp => {
              const dte = getDTE(sp.expiry);
              const maxProfit = sp.credit * sp.qty * 100;
              const maxLoss   = (sp.width - sp.credit) * sp.qty * 100;
              const breakEven = sp.shortStrike - sp.credit;
              const ror       = ((sp.credit / sp.width) * 100).toFixed(1);
              return (
                <div key={sp.id} className="card">
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
                    <div>
                      <span style={{ color:"#00d4aa", fontWeight:600, fontSize:13 }}>{sp.ticker}</span>
                      <span style={{ fontSize:11, color:"#a0aec0", marginLeft:8 }}>{sp.strategy}</span>
                    </div>
                    <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                      <span className="dte-pill" style={{ background:`${getDteColor(dte)}18`, color:getDteColor(dte), border:`1px solid ${getDteColor(dte)}33` }}>{dte}d</span>
                      <button className="btn btn-red btn-sm" onClick={() => setSpreads(prev => prev.filter(x => x.id !== sp.id))}>x</button>
                    </div>
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:12 }}>
                    {[
                      { label:"Short Strike", val:`$${sp.shortStrike}` },
                      { label:"Long Strike",  val:`$${sp.longStrike}` },
                      { label:"Width",        val:`$${sp.width}` },
                      { label:"Credit",       val:fmtPlain(sp.credit), color:"#00d4aa" },
                      { label:"Qty",          val:sp.qty },
                      { label:"Expiry",       val:sp.expiry.slice(5) },
                    ].map((m,i) => (
                      <div key={i}>
                        <div className="lbl">>{m.label}</div>
                        <div style={{ fontSize:12, color: m.color || "#e2e8f0" }}>{m.val}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:8, padding:"10px 0", borderTop:"1px solid rgba(255,255,255,.06)" }}>
                    <div><div className="lbl">Max Profit</div><div style={{ fontSize:12, color:"#00d4aa" }}>+${maxProfit.toFixed(0)}</div></div>
                    <div><div className="lbl">Max Loss</div><div style={{ fontSize:12, color:"#ff4444" }}>-${maxLoss.toFixed(0)}</div></div>
                    <div><div className="lbl">Break Even</div><div style={{ fontSize:12 }}>${breakEven.toFixed(2)}</div></div>
                    <div><div className="lbl">RoR</div><div style={{ fontSize:12, color:"#ffaa00" }}>{ror}%</div></div>
                  </div>
                  {sp.notes && (
                    <div style={{ marginTop:10, padding:"8px 10px", background:"rgba(255,255,255,.03)", borderRadius:3, fontSize:10, color:"#6b7fa3", fontStyle:"italic" }}>
                      {sp.notes}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* INCOME */}
        {tab === "income" && (
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div className="card">
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                <div className="section-title" style={{ margin:0 }}>Monthly Premium Income</div>
                <button className="btn btn-sm" onClick={() => setModal("income")}>+ Add Month</button>
              </div>
              {income.length > 0 && (() => {
                const maxVal = Math.max(...income.map(m => m.premium));
                return (
                  <>
                    <div style={{ display:"flex", alignItems:"flex-end", gap:8, height:120, marginBottom:8 }}>
                      {income.map((m,i) => (
                        <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", height:"100%", justifyContent:"flex-end" }}>
                          <div style={{ fontSize:9, color:"#00d4aa", marginBottom:3 }}>${m.premium}</div>
                          <div style={{ width:"100%", height:`${(m.premium/maxVal)*100}%`, background: i===income.length-1 ? "linear-gradient(180deg,#00d4aa,#00a8ff44)" : "rgba(0,212,170,.2)", border:"1px solid rgba(0,212,170,.25)", borderRadius:"2px 2px 0 0", transition:"height .8s ease" }}/>
                        </div>
                      ))}
                    </div>
                    <div style={{ display:"flex", gap:8 }}>
                      {income.map((m,i) => (
                        <div key={i} style={{ flex:1, textAlign:"center", fontSize:8, color:"#4a5568" }}>{m.label}</div>
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <div className="card"><div className="lbl">Total YTD</div><div className="metric-val" style={{ color:"#00d4aa", font>Size:24 }}>${totalIncome.toLocaleString()}</div></div>
              <div className="card"><div className="lbl">Monthly Avg</div><div className="metric-val" style={{ font>Size:24 }}>${avgIncome.toLocaleString()}</div></div>
            </div>
            <div className="card">
              <div className="section-title">Path to $8k/month</div>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginBottom:8 }}>
                <span style={{ color:"#a0aec0" }}>Current avg</span><span style={{ color:"#00d4aa" }}>${avgIncome}/mo</span>
              </div>
              <div className="progress-bar"><div className="progress-fill" style={{ width:`${Math.min((avgIncome/8000)*100,100)}%`, background:"linear-gradient(90deg,#00a8ff,#00d4aa)" }}/></div>
              <div style={{ fontSize:9, color:"#4a5568", marginTop:5, textAlign:"right" }}>{((avgIncome/8000)*100).toFixed(1)}% of $8,000 target</div>
            </div>
          </div>
        )}

        {/* JOURNAL */}
        {tab === "journal" && (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div className="section-title" style={{ margin:0 }}>Trade Journal</div>
              <button className="btn btn-sm" onClick={() => setModal("journal")}>+ Add Entry</button>
            </div>
            {journal.map(j => (
              <div key={j.id} className="card" style={{ position:"relative" }}>
                <button className="btn btn-red btn-sm" style={{ position:"absolute", top:12, right:12 }} onClick={() => setJournal(prev => prev.filter(x => x.id !== j.id))}>x</button>
                <div style={{ display:"flex", gap:10, alignItems:"baseline", marginBottom:8, paddingRight:40 }}>
                  <span style={{ color:"#00d4aa", fontWeight:600, fontSize:13 }}>{j.ticker}</span>
                  <span style={{ fontSize:10, color:"#a0aec0", letterSpacing:".05em" }}>{j.action}</span>
                  <span style={{ fontSize:9, color:"#4a5568", marginLeft:"auto" }}>{j.date}</span>
                </div>
                <div style={{ display:"flex", gap:16, marginBottom:10, fontSize:11 }}>
                  <div><div className="lbl">Price</div><span>{fmtPlain(j.price, j.currency)}</span></div>
                  <div><div className="lbl">Qty</div><span>{j.qty}</span></div>
                  <div><div className="lbl">P&L</div><span style={{ color: j.pnl>=0?"#00d4aa":"#ff4444", fontWeight:600 }}>{fmt(j.pnl, j.currency)}</span></div>
                </div>
                {j.notes && <div style={{ fontSize:10, color:"#a0aec0", fontStyle:"italic", marginBottom:8, lineHeight:1.5 }}>{j.notes}</div>}
                <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                  {(j.tags||[]).map((t,i) => <span key={i} className="tag">{t}</span>)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* IMPORT */}
        {tab === "import" && (
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div className="card">
              <div className="section-title">Import IBKR Activity Statement</div>
              <div style={{ fontSize:11, color:"#6b7fa3", marginBottom:16, lineHeight:1.7 }}>
                Export your Activity Statement from IBKR as a <strong style={{ color:"#a0aec0" }}>CSV file</strong>, then upload it below. New positions will be merged with your existing data without duplicating existing tickers.
              </div>
              <div style={{ fontSize:10, color:"#4a5568", marginBottom:8, letterSpacing:".05em" }}>
                In IBKR: Reports -> Activity -> Statements -> Activity Statement -> CSV
              </div>
              <div className="upload-zone" onClick={() => fileRef.current?.click()}>
                <div style={{ fontSize:24, marginBottom:8 }}>^</div>
                <div style={{ fontSize:11, color:"#a0aec0" }}>Click to upload IBKR Activity Statement CSV</div>
                <div style={{ fontSize:9, color:"#4a5568", marginTop:4 }}>Parses: Open Positions, Options, Trades</div>
                <input ref={fileRef} type="file" accept=".csv" style={{ display:"none" }} onChange={handleFile}/>
              </div>
              {importMsg && (
                <div style={{ marginTop:12, padding:"8px 12px", background:"rgba(0,212,170,.08)", border:"1px solid rgba(0,212,170,.2)", borderRadius:3, fontSize:11, color:"#00d4aa" }}>
                  {importMsg}
                </div>
              )}
            </div>
            <div className="card">
              <div className="section-title">Manual NLV Update</div>
              <div style={{ fontSize:11, color:"#6b7fa3", marginBottom:12 }}>
                Update your Net Liquidation Value directly from your IBKR portfolio screen.
              </div>
              <button className="btn" onClick={() => setModal("nlv")}>Update NLV</button>
            </div>
            <div className="card">
              <div className="section-title">Reset All Data</div>
              <div style={{ fontSize:11, color:"#6b7fa3", marginBottom:12 }}>
                Clears all positions, journal entries and income data from this device and reloads with seed data. <strong style={{ color:"#ff4444" }}>This cannot be undone.</strong>
              </div>
              {!showReset
                ? <button className="btn btn-red" onClick={() => setShowReset(true)}>Reset Portfolio Data</button>
                : <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    <span style={{ fontSize:11, color:"#ff4444" }}>Are you sure?</span>
                    <button className="btn btn-red" onClick={clearAllData}>Yes, Reset Everything</button>
                    <button className="btn" onClick={() => setShowReset(false)}>Cancel</button>
                  </div>
              }
            </div>
              {[
                { label:"Stock positions", val:stocks.length },
                { label:"Option positions", val:options.length },
                { label:"Spread positions", val:spreads.length },
                { label:"Journal entries", val:journal.length },
                { label:"Income months", val:income.length },
              ].map((r,i) => (
                <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom: i<4?"1px solid rgba(255,255,255,.04)":"none", fontSize:11 }}>
                  <span style={{ color:"#6b7fa3" }}>{r.label}</span>
                  <span style={{ color:"#00d4aa" }}>{r.val}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* MODALS */}
      {modal && (
        <div className="modal-bg" onClick={(e) => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">

            {/* NLV */}
            {modal === "nlv" && <NLVModal nlv={nlv} onSave={(v) => { setNlv(v); setModal(null); }} onClose={() => setModal(null)}/>}

            {/* STOCK */}
            {modal === "stock" && <StockModal onSave={(s) => { setStocks(prev => [...prev, { ...s, id:uid() }]); setModal(null); }} onClose={() => setModal(null)}/>}

            {/* OPTION */}
            {modal === "option" && <OptionModal onSave={(o) => { setOptions(prev => [...prev, { ...o, id:uid() }]); setModal(null); }} onClose={() => setModal(null)}/>}

            {/* SPREAD */}
            {modal === "spread" && <SpreadModal onSave={(s) => { setSpreads(prev => [...prev, { ...s, id:uid() }]); setModal(null); }} onClose={() => setModal(null)}/>}

            {/* JOURNAL */}
            {modal === "journal" && <JournalModal onSave={(j) => { setJournal(prev => [{ ...j, id:uid() }, ...prev]); setModal(null); }} onClose={() => setModal(null)}/>}

            {/* INCOME */}
            {modal === "income" && <IncomeModal onSave={(m) => { setIncome(prev => [...prev, m]); setModal(null); }} onClose={() => setModal(null)}/>}
          </div>
        </div>
      )}
      <div style={{ padding:"12px 20px", borderTop:"1px solid rgba(255,255,255,.05)", display:"flex", justifyContent:"space-between", fontSize:"9px", color:"#2d3748", letterSpacing:".1em", position:"relative", zIndex:1 }}>
        <span>PORTFOLIO TERMINAL v2.0</span>
        <span style={{ color:"#00d4aa" }}>* AUTO-SAVED TO DEVICE</span>
        <span>AUD/USD {AUD_USD}</span>
      </div>
    </div>
  );
}

// MODAL COMPONENTS
function ModalHeader({ title, onClose }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
      <div style={{ fontSize:11, letterSpacing:".15em", textTransform:"uppercase", color:"#00d4aa" }}>{title}</div>
      <button className="btn btn-red btn-sm" onClick={onClose}>x Close</button>
    </div>
  );
}

function Field({ label, children }) {
  return <div style={{ marginBottom:12 }}><div className="lbl">>{label}</div>{children}</div>;
}

function NLVModal({ nlv, onSave, onClose }) {
  const [val, setVal] = useState(nlv);
  return (
    <>
      <ModalHeader title="Update Net Liquidation Value" onClose={onClose}/>
      <Field label="NLV (USD)"><input className="inp" type="number" value={val} onChange={e => setVal(+e.target.value)}/></Field>
      <button className="btn" style={{ width:"100%", marginTop:8 }} onClick={() => onSave(val)}>Save</button>
    </>
  );
}

function StockModal({ onSave, onClose }) {
  const [f, setF] = useState({ ticker:"", shares:"", avgPrice:"", lastPrice:"", currency:"USD" });
  const upd = (k,v) => setF(p => ({ ...p, [k]:v }));
  return (
    <>
      <ModalHeader title="Add Stock Position" onClose={onClose}/>
      <Field label="Ticker"><input className="inp" value={f.ticker} onChange={e => upd("ticker", e.target.value.toUpperCase())}/></Field>
      <div className="row">
        <div style={{ flex:1 }}><Field label="Shares"><input className="inp" type="number" value={f.shares} onChange={e => upd("shares",+e.target.value)}/></Field></div>
        <div style={{ flex:1 }}><Field label="Currency"><select className="inp" value={f.currency} onChange={e => upd("currency",e.target.value)}><option>USD</option><option>AUD</option></select></Field></div>
      </div>
      <div className="row">
        <div style={{ flex:1 }}><Field label="Avg Price"><input className="inp" type="number" step="0.01" value={f.avgPrice} onChange={e => upd("avgPrice",+e.target.value)}/></Field></div>
        <div style={{ flex:1 }}><Field label="Last Price"><input className="inp" type="number" step="0.01" value={f.lastPrice} onChange={e => upd("lastPrice",+e.target.value)}/></Field></div>
      </div>
      <button className="btn" style={{ width:"100%", marginTop:8 }} onClick={() => f.ticker && onSave(f)}>Add Position</button>
    </>
  );
}

function OptionModal({ onSave, onClose }) {
  const [f, setF] = useState({ ticker:"", side:"short", type:"put", strike:"", expiry:"", premium:"", qty:1, currency:"USD" });
  const upd = (k,v) => setF(p => ({ ...p, [k]:v }));
  return (
    <>
      <ModalHeader title="Add Option Position" onClose={onClose}/>
      <div className="row">
        <div style={{ flex:1 }}><Field label="Ticker"><input className="inp" value={f.ticker} onChange={e => upd("ticker",e.target.value.toUpperCase())}/></Field></div>
        <div style={{ flex:1 }}><Field label="Side"><select className="inp" value={f.side} onChange={e => upd("side",e.target.value)}><option>short</option><option>long</option></select></Field></div>
        <div style={{ flex:1 }}><Field label="Type"><select className="inp" value={f.type} onChange={e => upd("type",e.target.value)}><option>put</option><option>call</option></select></Field></div>
      </div>
      <div className="row">
        <div style={{ flex:1 }}><Field label="Strike"><input className="inp" type="number" value={f.strike} onChange={e => upd("strike",+e.target.value)}/></Field></div>
        <div style={{ flex:1 }}><Field label="Qty"><input className="inp" type="number" value={f.qty} onChange={e => upd("qty",+e.target.value)}/></Field></div>
      </div>
      <div className="row">
        <div style={{ flex:1 }}><Field label="Expiry"><input className="inp" type="date" value={f.expiry} onChange={e => upd("expiry",e.target.value)}/></Field></div>
        <div style={{ flex:1 }}><Field label="Premium (current)"><input className="inp" type="number" step="0.01" value={f.premium} onChange={e => upd("premium",+e.target.value)}/></Field></div>
      </div>
      <button className="btn" style={{ width:"100%", marginTop:8 }} onClick={() => f.ticker && onSave(f)}>Add Option</button>
    </>
  );
}

function SpreadModal({ onSave, onClose }) {
  const [f, setF] = useState({ ticker:"", strategy:"Bull Put Spread", shortStrike:"", longStrike:"", expiry:"", credit:"", qty:1, currency:"USD", notes:"", openDate: new Date().toISOString().slice(0,10) });
  const upd = (k,v) => setF(p => ({ ...p, [k]:v }));
  const width = f.shortStrike && f.longStrike ? Math.abs(f.shortStrike - f.longStrike) : 0;
  const ror = width && f.credit ? ((+f.credit / width) * 100).toFixed(1) : "--";
  const maxProfit = f.credit && f.qty ? (+f.credit * +f.qty * 100).toFixed(0) : "--";
  const maxLoss   = width && f.credit && f.qty ? ((width - +f.credit) * +f.qty * 100).toFixed(0) : "--";
  return (
    <>
      <ModalHeader title="Add Spread Position" onClose={onClose}/>
      <div className="row">
        <div style={{ flex:1 }}><Field label="Ticker"><input className="inp" value={f.ticker} onChange={e => upd("ticker",e.target.value.toUpperCase())}/></Field></div>
        <div style={{ flex:2 }}><Field label="Strategy"><select className="inp" value={f.strategy} onChange={e => upd("strategy",e.target.value)}><option>Bull Put Spread</option><option>Bear Call Spread</option><option>Iron Condor</option><option>Debit Spread</option></select></Field></div>
      </div>
      <div className="row">
        <div style={{ flex:1 }}><Field label="Short Strike"><input className="inp" type="number" value={f.shortStrike} onChange={e => upd("shortStrike",+e.target.value)}/></Field></div>
        <div style={{ flex:1 }}><Field label="Long Strike"><input className="inp" type="number" value={f.longStrike} onChange={e => upd("longStrike",+e.target.value)}/></Field></div>
        <div style={{ flex:1 }}><Field label="Width"><input className="inp" value={width || ""} readOnly style={{ color:"#6b7fa3" }}/></Field></div>
      </div>
      <div className="row">
        <div style={{ flex:1 }}><Field label="Credit"><input className="inp" type="number" step="0.01" value={f.credit} onChange={e => upd("credit",+e.target.value)}/></Field></div>
        <div style={{ flex:1 }}><Field label="Qty (contracts)"><input className="inp" type="number" value={f.qty} onChange={e => upd("qty",+e.target.value)}/></Field></div>
        <div style={{ flex:1 }}><Field label="Expiry"><input className="inp" type="date" value={f.expiry} onChange={e => upd("expiry",e.target.value)}/></Field></div>
      </div>
      {/* Live preview */}
      {width > 0 && f.credit > 0 && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, padding:12, background:"rgba(0,212,170,.05)", border:"1px solid rgba(0,212,170,.15)", borderRadius:3, marginBottom:12 }}>
          <div><div className="lbl">Max Profit</div><div style={{ color:"#00d4aa", fontSize:12 }}>+${maxProfit}</div></div>
          <div><div className="lbl">Max Loss</div><div style={{ color:"#ff4444", fontSize:12 }}>-${maxLoss}</div></div>
          <div><div className="lbl">RoR</div><div style={{ color:"#ffaa00", fontSize:12 }}>{ror}%</div></div>
        </div>
      )}
      <Field label="Notes (optional)"><textarea className="inp" rows={3} style={{ resize:"vertical" }} value={f.notes} onChange={e => upd("notes",e.target.value)}/></Field>
      <button className="btn" style={{ width:"100%", marginTop:4 }} onClick={() => f.ticker && f.expiry && onSave({ ...f, width })}>Add Spread</button>
    </>
  );
}

function JournalModal({ onSave, onClose }) {
  const [f, setF] = useState({ date: new Date().toISOString().slice(0,10), ticker:"", action:"SELL PUT", price:"", qty:"", pnl:"", currency:"USD", notes:"", tagInput:"", tags:[] });
  const upd = (k,v) => setF(p => ({ ...p, [k]:v }));
  const addTag = () => { if (f.tagInput.trim()) { setF(p => ({ ...p, tags:[...p.tags, p.tagInput.trim().toLowerCase()], tagInput:"" })); }};
  return (
    <>
      <ModalHeader title="Add Journal Entry" onClose={onClose}/>
      <div className="row">
        <div style={{ flex:1 }}><Field label="Date"><input className="inp" type="date" value={f.date} onChange={e => upd("date",e.target.value)}/></Field></div>
        <div style={{ flex:1 }}><Field label="Ticker"><input className="inp" value={f.ticker} onChange={e => upd("ticker",e.target.value.toUpperCase())}/></Field></div>
      </div>
      <div className="row">
        <div style={{ flex:2 }}><Field label="Action"><select className="inp" value={f.action} onChange={e => upd("action",e.target.value)}><option>SELL PUT</option><option>SELL CALL</option><option>BUY STOCK</option><option>SELL STOCK</option><option>SELL SPREAD</option><option>CLOSE SPREAD</option><option>ROLL OPTION</option><option>ASSIGNMENT</option><option>EXPIRY</option></select></Field></div>
        <div style={{ flex:1 }}><Field label="Currency"><select className="inp" value={f.currency} onChange={e => upd("currency",e.target.value)}><option>USD</option><option>AUD</option></select></Field></div>
      </div>
      <div className="row">
        <div style={{ flex:1 }}><Field label="Price"><input className="inp" type="number" step="0.01" value={f.price} onChange={e => upd("price",+e.target.value)}/></Field></div>
        <div style={{ flex:1 }}><Field label="Qty"><input className="inp" type="number" value={f.qty} onChange={e => upd("qty",+e.target.value)}/></Field></div>
        <div style={{ flex:1 }}><Field label="P&L"><input className="inp" type="number" value={f.pnl} onChange={e => upd("pnl",+e.target.value)}/></Field></div>
      </div>
      <Field label="Notes"><textarea className="inp" rows={3} style={{ resize:"vertical" }} value={f.notes} onChange={e => upd("notes",e.target.value)}/></Field>
      <Field label="Tags">
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:6 }}>
          {f.tags.map((t,i) => <span key={i} className="tag">{t} <span style={{ cursor:"pointer", marginLeft:3 }} onClick={() => setF(p => ({ ...p, tags:p.tags.filter((_,j)=>j!==i) }))}>x</span></span>)}
        </div>
        <div style={{ display:"flex", gap:6 }}>
          <input className="inp" placeholder="e.g. premium, roll, nvda" value={f.tagInput} onChange={e => upd("tagInput",e.target.value)} onKeyDown={e => e.key==="Enter" && addTag()}/>
          <button className="btn btn-sm" onClick={addTag}>Add</button>
        </div>
      </Field>
      <button className="btn" style={{ width:"100%", marginTop:4 }} onClick={() => f.ticker && onSave(f)}>Save Entry</button>
    </>
  );
}

function IncomeModal({ onSave, onClose }) {
  const [f, setF] = useState({ month:"", label:"", premium:"" });
  const upd = (k,v) => setF(p => ({ ...p, [k]:v }));
  return (
    <>
      <ModalHeader title="Add Income Month" onClose={onClose}/>
      <Field label="Month (YYYY-MM)"><input className="inp" type="month" value={f.month} onChange={e => { const d = new Date(e.target.value+"-01"); upd("month",e.target.value); upd("label",d.toLocaleString("default",{month:"short",year:"2-digit"})); }}/></Field>
      <Field label="Premium Collected (USD)"><input className="inp" type="number" value={f.premium} onChange={e => upd("premium",+e.target.value)}/></Field>
      <button className="btn" style={{ width:"100%", marginTop:8 }} onClick={() => f.month && f.premium && onSave(f)}>Add Month</button>
    </>
  );
}
