import { NextRequest, NextResponse } from "next/server";
import { normalizeTradingSymbol } from "@/lib/trading/symbol";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SOURCES = [
  { name: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/", reliability: 1 },
  { name: "Cointelegraph", url: "https://cointelegraph.com/rss", reliability: 0.9 },
  { name: "Decrypt", url: "https://decrypt.co/feed", reliability: 0.9 },
];

const ALIASES: Record<string, string[]> = {
  BTC:["BTC","BITCOIN"],ETH:["ETH","ETHER","ETHEREUM"],BNB:["BNB","BINANCE COIN","BNB CHAIN"],
  SOL:["SOL","SOLANA"],XRP:["XRP","RIPPLE"],DOGE:["DOGE","DOGECOIN"],ADA:["ADA","CARDANO"],
  AVAX:["AVAX","AVALANCHE"],LINK:["LINK","CHAINLINK"],UNI:["UNI","UNISWAP"],AAVE:["AAVE"],
  SHIB:["SHIB","SHIBA INU"],PEPE:["PEPE"],DOT:["DOT","POLKADOT"],LTC:["LTC","LITECOIN"],
  BCH:["BCH","BITCOIN CASH"],TRX:["TRX","TRON"],SUI:["SUI"],TON:["TON","TONCOIN","THE OPEN NETWORK"],
  NEAR:["NEAR","NEAR PROTOCOL"],APT:["APT","APTOS"],ARB:["ARB","ARBITRUM"],OP:["OP","OPTIMISM"],
  FIL:["FIL","FILECOIN"],INJ:["INJ","INJECTIVE"],ATOM:["ATOM","COSMOS"],ETC:["ETC","ETHEREUM CLASSIC"],
  HBAR:["HBAR","HEDERA"],XLM:["XLM","STELLAR"],ICP:["ICP","INTERNET COMPUTER"]
};

const POS = [
  [["ETF APPROVAL","ETF APPROVED"],35,"ETF_APPROVAL"],
  [["WILL LIST","LISTING","ADDS TRADING"],28,"LISTING"],
  [["PARTNERSHIP","PARTNERS WITH","INTEGRATES","INTEGRATION"],16,"PARTNERSHIP"],
  [["MAINNET","UPGRADE","HARD FORK"],14,"UPGRADE"],
  [["ADOPTION","ADOPTS","ACCEPTS"],16,"ADOPTION"],
  [["APPROVAL","APPROVES","LICENSE"],18,"REGULATORY_POSITIVE"],
] as const;

const NEG = [
  [["DELIST","DELISTING","WILL DELIST"],-35,"DELISTING"],
  [["HACK","HACKED","EXPLOIT","EXPLOITED","BREACH"],-38,"SECURITY"],
  [["LAWSUIT","SUED","CHARGES","CHARGED","ENFORCEMENT"],-24,"REGULATORY_NEGATIVE"],
  [["BAN","BANNED","PROHIBIT","CRACKDOWN"],-26,"REGULATORY_NEGATIVE"],
  [["SELLOFF","SELL-OFF","DUMPS"],-14,"SELLING"],
  [["BANKRUPT","BANKRUPTCY","INSOLVENT","COLLAPSE"],-38,"DISTRESS"],
  [["TOKEN UNLOCK","UNLOCK"],-12,"TOKEN_UNLOCK"],
] as const;

function decode(v:string){return v.replace(/^<!\[CDATA\[/,"").replace(/\]\]>$/,"").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;|&#x27;/g,"'").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();}
function tag(b:string,n:string){const m=b.match(new RegExp(`<${n}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${n}>`,"i"));return m?decode(m[1]):"";}
function parse(xml:string,source:string){const a=xml.match(/<item\b[\s\S]*?<\/item>/gi)||xml.match(/<entry\b[\s\S]*?<\/entry>/gi)||[];return a.slice(0,40).map(b=>({title:tag(b,"title"),url:tag(b,"link")||(b.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1]||""),publishedAt:tag(b,"pubDate")||tag(b,"published")||tag(b,"updated")||null,source})).filter(x=>x.title&&x.url);}
function esc(v:string){return v.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");}
function has(text:string,term:string){const t=term.toUpperCase();return /^[A-Z0-9]{2,6}$/.test(t)?new RegExp(`(^|[^A-Z0-9])${esc(t)}([^A-Z0-9]|$)`,"i").test(text):text.includes(t);}
function classify(title:string){const t=title.toUpperCase();let score=0,type="GENERAL_NEWS";for(const [words,s,tp] of [...POS,...NEG])if(words.some(w=>t.includes(w))&&Math.abs(s)>Math.abs(score)){score=s;type=tp;}return{score,type,sentiment:score>=8?"BULLISH":score<=-8?"BEARISH":"NEUTRAL",impact:Math.abs(score)>=25?"HIGH":Math.abs(score)>=12?"MEDIUM":"LOW"};}
function age(d:string|null){if(!d)return null;const x=new Date(d).getTime();return Number.isFinite(x)?Math.max(0,Math.round((Date.now()-x)/60000)):null;}
function fresh(m:number|null){if(m===null)return .65;if(m<=60)return 1;if(m<=360)return .9;if(m<=1440)return .75;if(m<=4320)return .5;return .25;}
async function getSource(s:(typeof SOURCES)[number]){const c=new AbortController(),timer=setTimeout(()=>c.abort(),7000);try{const r=await fetch(s.url,{cache:"no-store",signal:c.signal,headers:{"User-Agent":"CoinlytxTradingIntelligence/1.0",Accept:"application/rss+xml, application/xml, text/xml, */*"}});if(!r.ok)throw new Error(`HTTP ${r.status}`);return{ok:true,s,items:parse(await r.text(),s.name),error:null};}catch(e){return{ok:false,s,items:[],error:e instanceof Error?e.message:"Feed failed"};}finally{clearTimeout(timer);}}

export async function GET(req:NextRequest){
  try{
    const symbol=normalizeTradingSymbol(req.nextUrl.searchParams.get("symbol"),"BTCUSDT"),baseAsset=symbol.slice(0,-4);
    const aliases=Array.from(new Set([baseAsset,...(ALIASES[baseAsset]||[])]));
    const results=await Promise.all(SOURCES.map(getSource)),rel=new Map(SOURCES.map(s=>[s.name,s.reliability])),seen=new Set<string>();
    const articles=results.flatMap(r=>r.items).flatMap(item=>{
      const upper=item.title.toUpperCase(),matchedTerms=aliases.filter(a=>has(upper,a));if(!matchedTerms.length)return[];
      const key=item.title.toLowerCase().replace(/[^a-z0-9]+/g," ").trim();if(seen.has(key))return[];seen.add(key);
      const c=classify(item.title),minutes=age(item.publishedAt),score=Number((c.score*fresh(minutes)*(rel.get(item.source)??.8)).toFixed(2));
      return[{id:`${item.source}:${key}`.slice(0,220),...item,ageMinutes:minutes,eventType:c.type,sentiment:c.sentiment,impact:c.impact,score,matchedTerms}];
    }).filter(x=>x.ageMinutes===null||x.ageMinutes<=4320).sort((a,b)=>(b.publishedAt?new Date(b.publishedAt).getTime():0)-(a.publishedAt?new Date(a.publishedAt).getTime():0));
    const newsScore=Number(Math.max(-100,Math.min(100,articles.slice(0,15).reduce((s,a)=>s+a.score,0))).toFixed(2));
    const bias=newsScore>=12?"BULLISH":newsScore<=-12?"BEARISH":"NEUTRAL";
    return NextResponse.json({success:true,symbol,baseAsset,aliases,bias,newsScore,confidenceType:"heuristic",meaningfulNews:articles.some(a=>a.impact==="HIGH")||Math.abs(newsScore)>=12,summary:{matchedArticles:articles.length,bullishArticles:articles.filter(a=>a.sentiment==="BULLISH").length,bearishArticles:articles.filter(a=>a.sentiment==="BEARISH").length,neutralArticles:articles.filter(a=>a.sentiment==="NEUTRAL").length,highImpactArticles:articles.filter(a=>a.impact==="HIGH").length},articles:articles.slice(0,20),sources:results.map(r=>({name:r.s.name,available:r.ok,articlesRead:r.items.length})),sourceFailures:results.filter(r=>!r.ok).map(r=>({source:r.s.name,error:r.error})),scoring:{range:"-100 to +100",freshnessAdjusted:true,sourceReliabilityAdjusted:true,currentlyUsedInTradingDecision:false},caveats:["Headline classification is heuristic and can misread context.","A headline does not prove immediate price direction.","News is observation-only and is not yet included in LONG/SHORT scoring.","Coin aliases should be expanded as more assets are validated."],updatedAt:new Date().toISOString()});
  }catch(e){return NextResponse.json({success:false,error:e instanceof Error?e.message:"Unable to build news intelligence."},{status:500});}
}
