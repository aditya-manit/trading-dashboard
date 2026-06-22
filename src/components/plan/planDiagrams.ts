// Auto-extracted verbatim from design handoff 29 — Trading Dashboard (purple).dc.html
// 5 pre-trade workbook step diagrams (gridded, editorial). Animated via the
// v* keyframes (vFade/vDraw/vPulse/vPop) injected by PlanPage. JetBrains Mono
// tick labels resolve through the --font-mono CSS variable (set in layout.tsx).
export const PLAN_STEP_DIAGRAMS: string[] = [
  `<svg viewBox="12 25 570 323" width="100%" preserveAspectRatio="xMinYMid meet" style="display:block;overflow:visible;margin:0;max-height:380px;">
    <defs>
      <linearGradient id="cArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#7c5cff" stop-opacity="0.12"></stop><stop offset="100%" stop-color="#7c5cff" stop-opacity="0"></stop></linearGradient>
      <pattern id="grid1" width="38" height="38" patternUnits="userSpaceOnUse"><path d="M38,0 L0,0 L0,38" fill="none" stroke="#edeae2" stroke-width="1"></path></pattern>
    </defs>
    <rect x="14" y="30" width="562" height="312" fill="url(#grid1)" style="animation:vFade .6s both .15s;"></rect>
    <text x="20" y="80" font-family="var(--font-mono), monospace" font-weight="600" font-size="13" fill="#df5338" style="animation:vFade .5s both .3s;">64,800</text>
    <text x="20" y="254" font-family="var(--font-mono), monospace" font-weight="700" font-size="14" fill="#7c5cff" style="animation:vFade .5s both .5s;">61,000</text>
    <text x="20" y="312" font-family="var(--font-mono), monospace" font-weight="600" font-size="13" fill="#1f9d55" style="animation:vFade .5s both .35s;">60,000</text>
    <line x1="110" y1="76" x2="560" y2="76" stroke="#df5338" stroke-width="1.25" opacity="0.85" style="animation:vFade .5s both .3s;"></line>
    <text x="110" y="68" font-family="Plus Jakarta Sans" font-weight="700" font-size="9.5" letter-spacing="0.16em" fill="#df5338" style="animation:vFade .5s both .35s;">RESISTANCE</text>
    <line x1="110" y1="306" x2="560" y2="306" stroke="#1f9d55" stroke-width="1.25" opacity="0.85" style="animation:vFade .5s both .35s;"></line>
    <text x="110" y="298" font-family="Plus Jakarta Sans" font-weight="700" font-size="9.5" letter-spacing="0.16em" fill="#1f9d55" style="animation:vFade .5s both .4s;">SUPPORT</text>
    <line x1="110" y1="228" x2="560" y2="228" stroke="#e7e4dc" stroke-width="1" stroke-dasharray="2 5" style="animation:vFade .5s both .55s;"></line>
    <path d="M110,148 C148,150 168,194 206,224 C250,248 304,250 384,250 L384,306 L110,306 Z" fill="url(#cArea)" style="animation:vFade .8s both .8s;"></path>
    <path d="M110,148 C148,150 168,194 206,224 C250,248 304,250 384,250" fill="none" stroke="#7c5cff" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round" style="stroke-dasharray:380;stroke-dashoffset:380;animation:vDraw 1.1s ease both .35s;"></path>
    <circle cx="384" cy="250" r="14" fill="#7c5cff" opacity="0.14" style="animation:vPulse 2s infinite 1.3s;transform-box:fill-box;transform-origin:center;"></circle>
    <circle cx="384" cy="250" r="5.5" fill="#7c5cff" stroke="#fbfbf9" stroke-width="2.5" style="animation:vPop .45s both 1.2s;transform-box:fill-box;transform-origin:center;"></circle>
    <line x1="384" y1="242" x2="384" y2="84" stroke="#1f9d55" stroke-width="1.5" stroke-dasharray="2 6" style="animation:vFade .5s both 1.4s;"></line>
    <polygon points="384,78 380,90 388,90" fill="#1f9d55" style="animation:vPop .4s both 1.6s;transform-box:fill-box;transform-origin:center;"></polygon>
    <line x1="384" y1="258" x2="384" y2="300" stroke="#df5338" stroke-width="1.5" stroke-dasharray="2 6" style="animation:vFade .5s both 1.5s;"></line>
    <polygon points="384,306 380,294 388,294" fill="#df5338" style="animation:vPop .4s both 1.7s;transform-box:fill-box;transform-origin:center;"></polygon>
    <g style="animation:vFade .5s both 1.6s;"><circle cx="430" cy="116" r="3.5" fill="#1f9d55"></circle><text x="442" y="113" font-family="Plus Jakarta Sans" font-weight="800" font-size="13" fill="#1a1813">Long &#8212; room to run</text><text x="442" y="130" font-family="Plus Jakarta Sans" font-weight="500" font-size="11" fill="#8b8678">enter from the floor</text></g>
    <g style="animation:vFade .5s both 1.75s;"><circle cx="430" cy="270" r="3.5" fill="#df5338"></circle><text x="442" y="267" font-family="Plus Jakarta Sans" font-weight="800" font-size="13" fill="#1a1813">Short &#8212; into support</text><text x="442" y="284" font-family="Plus Jakarta Sans" font-weight="500" font-size="11" fill="#8b8678">no room, skip it</text></g>
  </svg>`,
  `<svg viewBox="52 40 516 292" width="100%" preserveAspectRatio="xMinYMid meet" style="display:block;overflow:visible;margin:0;max-height:380px;">
    <defs>
      <linearGradient id="c2Area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#7c5cff" stop-opacity="0.12"></stop><stop offset="100%" stop-color="#7c5cff" stop-opacity="0"></stop></linearGradient>
      <pattern id="grid2" width="38" height="38" patternUnits="userSpaceOnUse"><path d="M38,0 L0,0 L0,38" fill="none" stroke="#edeae2" stroke-width="1"></path></pattern>
      <marker id="ag2" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto"><path d="M0,1 L9,5 L0,9 z" fill="#1f9d55"></path></marker>
      <marker id="ar2" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto"><path d="M0,1 L9,5 L0,9 z" fill="#df5338"></path></marker>
    </defs>
    <rect x="60" y="45" width="500" height="270" fill="url(#grid2)" style="animation:vFade .6s both .15s;"></rect>
    <line x1="72" y1="306" x2="454" y2="120" stroke="#1f9d55" stroke-width="1.5" stroke-linecap="round" style="animation:vFade .6s both .3s;"></line>
    <text x="100" y="312" font-family="Plus Jakarta Sans" font-weight="700" font-size="9.5" letter-spacing="0.16em" fill="#1f9d55" style="animation:vFade .5s both .4s;">UPTREND</text>
    <path d="M72,298 C104,266 132,196 158,192 C186,188 200,238 222,240 C254,241 286,92 316,90 C346,88 360,142 380,156 L380,315 L72,315 Z" fill="url(#c2Area)" style="animation:vFade .8s both .85s;"></path>
    <path d="M72,298 C104,266 132,196 158,192 C186,188 200,238 222,240 C254,241 286,92 316,90 C346,88 360,142 380,156" fill="none" stroke="#7c5cff" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round" style="stroke-dasharray:520;stroke-dashoffset:520;animation:vDraw 1.1s ease both .35s;"></path>
    <line x1="380" y1="156" x2="455" y2="81" stroke="#1f9d55" stroke-width="1.5" stroke-dasharray="3 5" marker-end="url(#ag2)" style="animation:vFade .5s both 1.5s;"></line>
    <line x1="380" y1="156" x2="455" y2="231" stroke="#df5338" stroke-width="1.5" stroke-dasharray="3 5" marker-end="url(#ar2)" style="animation:vFade .5s both 1.6s;"></line>
    <circle cx="380" cy="156" r="14" fill="#7c5cff" opacity="0.14" style="animation:vPulse 2s infinite 1.3s;transform-box:fill-box;transform-origin:center;"></circle>
    <circle cx="380" cy="156" r="5.5" fill="#7c5cff" stroke="#fbfbf9" stroke-width="2.5" style="animation:vPop .45s both 1.2s;transform-box:fill-box;transform-origin:center;"></circle>
    <text x="306" y="206" font-family="var(--font-mono), monospace" font-weight="700" font-size="10" fill="#7c5cff" style="animation:vFade .5s both 1.3s;">PULLBACK</text>
    <g style="animation:vFade .5s both 1.6s;"><circle cx="466" cy="70" r="3.5" fill="#1f9d55"></circle><text x="478" y="67" font-family="Plus Jakarta Sans" font-weight="800" font-size="12.5" fill="#1a1813">Ride the trend</text><text x="478" y="84" font-family="Plus Jakarta Sans" font-weight="500" font-size="10.5" fill="#8b8678">enter at the pullback</text></g>
    <g style="animation:vFade .5s both 1.75s;"><circle cx="466" cy="242" r="3.5" fill="#df5338"></circle><text x="478" y="239" font-family="Plus Jakarta Sans" font-weight="800" font-size="12.5" fill="#1a1813">Against</text><text x="478" y="256" font-family="Plus Jakarta Sans" font-weight="500" font-size="10.5" fill="#8b8678">skip it</text></g>
  </svg>`,
  `<svg viewBox="52 40 516 292" width="100%" preserveAspectRatio="xMinYMid meet" style="display:block;overflow:visible;margin:0;max-height:380px;">
    <defs>
      <linearGradient id="c3Area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#7c5cff" stop-opacity="0.12"></stop><stop offset="100%" stop-color="#7c5cff" stop-opacity="0"></stop></linearGradient>
      <pattern id="grid3" width="38" height="38" patternUnits="userSpaceOnUse"><path d="M38,0 L0,0 L0,38" fill="none" stroke="#edeae2" stroke-width="1"></path></pattern>
      <marker id="ar3" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto"><path d="M0,1 L9,5 L0,9 z" fill="#df5338"></path></marker>
      <marker id="ar3g" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto"><path d="M0,1 L9,5 L0,9 z" fill="#1f9d55"></path></marker>
    </defs>
    <rect x="60" y="45" width="500" height="270" fill="url(#grid3)" style="animation:vFade .6s both .15s;"></rect>
    <line x1="60" y1="158" x2="560" y2="158" stroke="#df5338" stroke-width="1.25" opacity="0.9" style="animation:vFade .5s both .3s;"></line>
    <text x="60" y="150" font-family="Plus Jakarta Sans" font-weight="700" font-size="9.5" letter-spacing="0.16em" fill="#df5338" style="animation:vFade .5s both .35s;">RESISTANCE</text>
    <path d="M60,300 C100,288 152,163 168,160 C186,163 210,202 228,205 C260,210 305,150 330,128 C350,112 372,148 388,158 C406,168 432,140 444,120 L444,315 L60,315 Z" fill="url(#c3Area)" style="animation:vFade .8s both .85s;"></path>
    <path d="M60,300 C100,288 152,163 168,160 C186,163 210,202 228,205 C260,210 305,150 330,128 C350,112 372,148 388,158 C406,168 432,140 444,120" fill="none" stroke="#7c5cff" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round" style="stroke-dasharray:520;stroke-dashoffset:520;animation:vDraw 1.2s ease both .35s;"></path>
    <circle cx="388" cy="158" r="14" fill="#7c5cff" opacity="0.14" style="animation:vPulse 2s infinite 1.4s;transform-box:fill-box;transform-origin:center;"></circle>
    <circle cx="388" cy="158" r="5.5" fill="#7c5cff" stroke="#fbfbf9" stroke-width="2.5" style="animation:vPop .45s both 1.3s;transform-box:fill-box;transform-origin:center;"></circle>
    <text x="322" y="180" font-family="var(--font-mono), monospace" font-weight="700" font-size="10" fill="#7c5cff" style="animation:vFade .5s both 1.4s;">RETEST HELD</text>
    <line x1="392" y1="150" x2="450" y2="98" stroke="#1f9d55" stroke-width="1.5" stroke-dasharray="3 5" marker-end="url(#ar3g)" style="animation:vFade .5s both 1.5s;"></line>
    <line x1="394" y1="164" x2="450" y2="246" stroke="#df5338" stroke-width="1.5" stroke-dasharray="3 5" marker-end="url(#ar3)" style="animation:vFade .5s both 1.6s;"></line>
    <g style="animation:vFade .5s both 1.5s;"><circle cx="456" cy="94" r="3.5" fill="#1f9d55"></circle><text x="468" y="91" font-family="Plus Jakarta Sans" font-weight="800" font-size="12.5" fill="#1a1813">Confirmed</text><text x="468" y="108" font-family="Plus Jakarta Sans" font-weight="500" font-size="10.5" fill="#8b8678">break + retest holds</text></g>
    <g style="animation:vFade .5s both 1.7s;"><circle cx="456" cy="252" r="3.5" fill="#df5338"></circle><text x="468" y="249" font-family="Plus Jakarta Sans" font-weight="800" font-size="12.5" fill="#1a1813">Not confirmed</text><text x="468" y="266" font-family="Plus Jakarta Sans" font-weight="500" font-size="10.5" fill="#8b8678">price can go lower</text></g>
  </svg>`,
  `<svg viewBox="52 55 498 282" width="100%" preserveAspectRatio="xMinYMid meet" style="display:block;overflow:visible;margin:0;max-height:380px;">
    <defs>
      <linearGradient id="dArea4" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#7c5cff" stop-opacity="0.1"></stop><stop offset="100%" stop-color="#7c5cff" stop-opacity="0"></stop></linearGradient>
      <pattern id="gridD4" width="38" height="38" patternUnits="userSpaceOnUse"><path d="M38,0 L0,0 L0,38" fill="none" stroke="#edeae2" stroke-width="1"></path></pattern>
    </defs>
    <rect x="40" y="60" width="500" height="277" fill="url(#gridD4)" style="animation:vFade .6s both .15s;"></rect>
    <line x1="62" y1="240" x2="540" y2="240" stroke="#1f9d55" stroke-width="1.5" opacity="0.9" style="animation:vFade .5s both .3s;"></line>
    <text x="62" y="234" font-family="Plus Jakarta Sans" font-weight="700" font-size="9.5" letter-spacing="0.14em" fill="#1f9d55" style="animation:vFade .5s both .35s;">MAJOR SUPPORT</text>
    <line x1="62" y1="272" x2="466" y2="272" stroke="#df5338" stroke-width="1.25" stroke-dasharray="4 5" style="animation:vFade .5s both 1.5s;"></line>
    <g style="animation:vFade .5s both 1.55s;"><circle cx="472" cy="272" r="3.5" fill="#df5338"></circle><text x="484" y="269" font-family="Plus Jakarta Sans" font-weight="800" font-size="12.5" fill="#1a1813">Too tight</text><text x="484" y="285" font-family="Plus Jakarta Sans" font-weight="500" font-size="10.5" fill="#8b8678">shaken out</text></g>
    <line x1="62" y1="318" x2="466" y2="318" stroke="#1f9d55" stroke-width="1.5" stroke-dasharray="2 5" style="animation:vFade .5s both 1.6s;"></line>
    <g style="animation:vFade .5s both 1.65s;"><circle cx="472" cy="318" r="3.5" fill="#1f9d55"></circle><text x="484" y="315" font-family="Plus Jakarta Sans" font-weight="800" font-size="12.5" fill="#1a1813">Safe stop</text><text x="484" y="331" font-family="Plus Jakarta Sans" font-weight="500" font-size="10.5" fill="#8b8678">survives</text></g>
    <path d="M118,72 C154,98 178,224 204,240 C224,240 234,206 254,204 C276,202 284,240 308,240 C334,240 338,304 358,306 C382,308 392,258 412,224 C444,160 460,110 478,64 L478,344 L118,344 Z" fill="url(#dArea4)" style="animation:vFade .8s both .85s;"></path>
    <path d="M118,72 C154,98 178,224 204,240 C224,240 234,206 254,204 C276,202 284,240 308,240 C334,240 338,304 358,306 C382,308 392,258 412,224 C444,160 460,110 478,64" fill="none" stroke="#7c5cff" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round" style="stroke-dasharray:700;stroke-dashoffset:700;animation:vDraw 1.3s ease both .35s;"></path>
    <circle cx="118" cy="72" r="13" fill="#7c5cff" opacity="0.14" style="animation:vPulse 2s infinite 1.4s;transform-box:fill-box;transform-origin:center;"></circle>
    <circle cx="118" cy="72" r="5.5" fill="#7c5cff" stroke="#fbfbf9" stroke-width="2.5" style="animation:vPop .45s both 1.2s;transform-box:fill-box;transform-origin:center;"></circle>
    <text x="130" y="68" font-family="var(--font-mono), monospace" font-weight="700" font-size="10" fill="#7c5cff" style="animation:vFade .5s both 1.3s;">ENTRY</text>
    <circle cx="335" cy="272" r="5" fill="#fbfbf9" stroke="#df5338" stroke-width="2" style="animation:vPop .4s both 1.7s;transform-box:fill-box;transform-origin:center;"></circle>
    <circle cx="358" cy="306" r="3" fill="#b8b3a8" style="animation:vPop .4s both 1.5s;transform-box:fill-box;transform-origin:center;"></circle>
    <text x="330" y="301" text-anchor="end" font-family="var(--font-mono), monospace" font-weight="700" font-size="9" fill="#9a958a" style="animation:vFade .5s both 1.5s;">shakeout</text>
  </svg>`,
  `<svg viewBox="52 38 525 297" width="100%" preserveAspectRatio="xMinYMid meet" style="display:block;overflow:visible;margin:0;max-height:380px;">
    <defs>
      <linearGradient id="c5Area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#7c5cff" stop-opacity="0.1"></stop><stop offset="100%" stop-color="#7c5cff" stop-opacity="0"></stop></linearGradient>
      <pattern id="grid5" width="38" height="38" patternUnits="userSpaceOnUse"><path d="M38,0 L0,0 L0,38" fill="none" stroke="#edeae2" stroke-width="1"></path></pattern>
      <marker id="ar5r" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto"><path d="M0,1 L9,5 L0,9 z" fill="#7c5cff"></path></marker>
    </defs>
    <rect x="60" y="45" width="500" height="270" fill="url(#grid5)" style="animation:vFade .6s both .15s;"></rect>
    <line x1="60" y1="158" x2="560" y2="158" stroke="#df5338" stroke-width="1.25" opacity="0.9" style="animation:vFade .5s both .3s;"></line>
    <text x="60" y="150" font-family="Plus Jakarta Sans" font-weight="700" font-size="9.5" letter-spacing="0.16em" fill="#df5338" style="animation:vFade .5s both .35s;">RESISTANCE</text>
    <path d="M70,294 C80,294 84,276 94,276 C104,276 108,290 118,290 C130,290 134,262 146,262 C157,262 161,276 172,276 C184,276 188,242 200,242 C211,242 215,256 226,256 C238,256 242,216 254,216 C266,216 270,200 282,200 C293,188 301,102 305,96 C309,102 320,150 335,162 C345,162 350,148 360,148 C371,148 375,200 386,200 C396,200 400,184 410,184 C420,184 424,236 434,236 C441,236 443,261 450,261 C461,261 465,250 476,250 C485,250 489,286 498,286 C506,290 510,302 516,308 L516,315 L70,315 Z" fill="url(#c5Area)" style="animation:vFade .8s both .9s;"></path>
    <path d="M70,294 C80,294 84,276 94,276 C104,276 108,290 118,290 C130,290 134,262 146,262 C157,262 161,276 172,276 C184,276 188,242 200,242 C211,242 215,256 226,256 C238,256 242,216 254,216 C266,216 270,200 282,200 C293,188 301,102 305,96 C309,102 320,150 335,162 C345,162 350,148 360,148 C371,148 375,200 386,200 C396,200 400,184 410,184 C420,184 424,236 434,236 C441,236 443,261 450,261 C461,261 465,250 476,250 C485,250 489,286 498,286 C506,290 510,302 516,308" fill="none" stroke="#7c5cff" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round" marker-end="url(#ar5r)" style="stroke-dasharray:1200;stroke-dashoffset:1200;animation:vDraw 1.35s ease both .3s;"></path>
    <circle cx="305" cy="96" r="5" fill="#fbfbf9" stroke="#1f9d55" stroke-width="2" style="animation:vPop .4s both 1.2s;transform-box:fill-box;transform-origin:center;"></circle>
    <g style="animation:vFade .5s both 1.25s;"><text x="288" y="92" text-anchor="end" font-family="Plus Jakarta Sans" font-weight="800" font-size="12.5" fill="#1a1813">Liquidity sweep</text><text x="288" y="108" text-anchor="end" font-family="Plus Jakarta Sans" font-weight="500" font-size="10.5" fill="#8b8678">traps buyers &#183; stops shorts</text></g>
    <line x1="340" y1="160" x2="368" y2="132" stroke="#7c5cff" stroke-width="1.5" stroke-dasharray="3 5" style="animation:vFade .5s both 1.5s;"></line>
    <circle cx="335" cy="162" r="13" fill="#7c5cff" opacity="0.14" style="animation:vPulse 2s infinite 1.5s;transform-box:fill-box;transform-origin:center;"></circle>
    <circle cx="335" cy="162" r="5.5" fill="#7c5cff" stroke="#fbfbf9" stroke-width="2.5" style="animation:vPop .45s both 1.4s;transform-box:fill-box;transform-origin:center;"></circle>
    <g style="animation:vFade .5s both 1.55s;"><text x="372" y="128" font-family="Plus Jakarta Sans" font-weight="800" font-size="12.5" fill="#1a1813">Short after sweep</text><text x="372" y="144" font-family="Plus Jakarta Sans" font-weight="500" font-size="10.5" fill="#8b8678">short the reversal</text></g>
    <circle cx="450" cy="261" r="5" fill="#fbfbf9" stroke="#df5338" stroke-width="2" style="animation:vPop .4s both 1.7s;transform-box:fill-box;transform-origin:center;"></circle>
    <line x1="452" y1="256" x2="470" y2="220" stroke="#df5338" stroke-width="1.5" stroke-dasharray="3 5" style="animation:vFade .5s both 1.7s;"></line>
    <g style="animation:vFade .5s both 1.75s;"><text x="474" y="216" font-family="Plus Jakarta Sans" font-weight="800" font-size="12.5" fill="#1a1813">Sells off</text><text x="474" y="232" font-family="Plus Jakarta Sans" font-weight="500" font-size="10.5" fill="#8b8678">reverses down</text></g>
  </svg>`,
];
