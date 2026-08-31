import { useEffect, useRef, useState } from "react";
import html2canvas from "html2canvas";
import { geoMercator, geoPath } from "d3-geo";

// District name aliases — maps alternate spellings to the canonical name
const ALIASES = {
  "Jiiro Garob":  "Yaqshiid",
  "Jiirogaroob":  "Yaqshiid",
  "Jiirogarob":   "Yaqshiid",
  "Yaqshid":      "Yaqshiid",
  "Suuqbacad":    "Yaqshiid",
  "suuqbacad":    "Yaqshiid",
  "Huriwaa":      "Huruwaa",
  "Halwadaag":    "Howlwadaag",
  "halwadaag":    "Howlwadaag",
  "Madiino":      "Madina",
  "madiino":      "Madina",
  "Darusalaam":   "Daru Salam",
  "darusalaam":   "Daru Salam",
  "Daru Salaam":  "Daru Salam",
  "daru salaam":  "Daru Salam",
  "DaruSalam":    "Daru Salam",
  "Darusalam":    "Daru Salam",
  "darusalam":    "Daru Salam",
  "Jamhuriya":    "Kaaraan",
  "jamhuriya":    "Kaaraan",
  "Karaan":       "Kaaraan",
  "karaan":       "Kaaraan",
  "Kaaran":       "Kaaraan",
  "kaaran":       "Kaaraan",
  "kaaraan":      "Kaaraan",
  "KAARAAN":      "Kaaraan",
  "Wardhigley":   "Wartanabadda",
  "wardhigley":   "Wartanabadda",
  "Wartanabada":  "Wartanabadda",
  "wartanabada":  "Wartanabadda",
  "Suuq Xoolaha": "Huruwaa",
  "Suuqxoolaha":  "Huruwaa",
  "S/xoolaha":    "Huruwaa",
  "s/xoolaha":    "Huruwaa",
  "s.xoolaha":    "Huruwaa",
  "S.xoolaha":    "Huruwaa",
  "S/Xoolaha":    "Huruwaa",
  "Suuq xoolaha": "Huruwaa",
};

const PALETTE = [
  "#34d399","#60a5fa","#fbbf24","#a78bfa",
  "#f87171","#38bdf8","#a3e635","#f472b6",
  "#fb923c","#818cf8","#4ade80","#e78a45",
];

// Three highlighted hotspot districts
const HOTSPOTS = [
  {
    district: "Mogadisho",
    label:    "Banaadir",
    sub:      "Capital · Student hub",
    color:    "#34d399",
    coords:   [45.4512, 2.1113],
  },
  {
    district: "Ceel Dheer",
    label:    "Galgaduud",
    sub:      "Central Somalia",
    color:    "#f59e0b",
    coords:   [46.9647, 4.1137],
  },
  {
    district: "Marka",
    label:    "Shabeelaha Hoose",
    sub:      "Lower Shabelle",
    color:    "#818cf8",
    coords:   [44.6922, 1.7226],
  },
];

export default function SomaliaMap({ orphans = [] }) {
  const [geo, setGeo]      = useState(null);
  const [selected, setSel]     = useState(null);
  const [downloaded, setDl]    = useState(false);
  const chartRef               = useRef(null);

  const downloadChart = () => {
    if (!chartRef.current) return;
    html2canvas(chartRef.current, { backgroundColor: "#0d1b2e", scale: 2 }).then(canvas => {
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = "student-distribution-map.png";
      a.click();
      setDl(true);
      setTimeout(() => setDl(false), 2500);
    });
  };

  useEffect(() => {
    fetch("/somalia_districts.geojson")
      .then(r => r.json())
      .then(setGeo)
      .catch(console.error);
  }, []);

  const subCounts = {};
  orphans.forEach(o => {
    const raw = (o.district || "").trim().replace(/\s+/g, " ");
    const lowerRaw = raw.toLowerCase();
    let name = (!raw || raw === "Other") ? "Unassigned" : raw;
    for (const [k, v] of Object.entries(ALIASES)) {
      if (k.toLowerCase() === lowerRaw) { name = v; break; }
    }
    subCounts[name] = (subCounts[name] || 0) + 1;
  });

  const districtColor = {};
  Object.keys(subCounts).forEach((d, i) => {
    districtColor[d] = d === "Unassigned" ? "#475569" : PALETTE[i % PALETTE.length];
  });

  const totalStudents   = Object.values(subCounts).reduce((s, v) => s + v, 0);
  const districtCount   = Object.keys(subCounts).filter(d => d !== "Unassigned").length;
  const maxCount        = Math.max(1, ...Object.values(subCounts));
  const sortedDistricts = Object.entries(subCounts).sort((a, b) => b[1] - a[1]);

  if (!geo) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm"
        style={{ background: "linear-gradient(135deg,#0f172a,#1e293b)", borderRadius: 16 }}>
        Loading map…
      </div>
    );
  }

  const W = 700, H = 520;
  const projection = geoMercator().fitSize([W, H], geo);
  const pathGen    = geoPath().projection(projection);

  // Project hotspot centres to SVG coords
  const hotspotPoints = HOTSPOTS.map(h => {
    const [px, py] = projection(h.coords) || [];
    return { ...h, px, py };
  });

  const getFill = (name2) => {
    const hs = HOTSPOTS.find(h => h.district === name2);
    if (hs) return hs.color + "55";
    return "#4189DE";
  };

  const getStroke = (name2) => {
    const hs = HOTSPOTS.find(h => h.district === name2);
    if (hs) return hs.color;
    return "#7bbfef";
  };

  return (
    <div className="select-none" ref={chartRef}
      style={{ background: "linear-gradient(135deg,#0d1b2e 0%,#112240 40%,#0a1f35 100%)", borderRadius: 16 }}>

      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-white font-black text-sm tracking-wide">Student Distribution Map</span>
            <span className="text-[9px] font-bold tracking-widest px-1.5 py-0.5 rounded-full"
              style={{ background: "#34d39922", color: "#34d399", border: "1px solid #34d39940" }}>
              LIVE
            </span>
          </div>
          <p className="text-slate-400 text-[10px]">
            {totalStudents} students · {districtCount} district{districtCount !== 1 ? "s" : ""} · Somalia
          </p>
          <p className="text-xs font-semibold mt-0.5" style={{ color: "#94a3b8" }}>
            Iskaashi Educational Development Organisation — Orphan Sponsorship Programme
          </p>
        </div>

        {/* Hotspot legend */}
        <div className="flex flex-col gap-1">
          {HOTSPOTS.map(h => (
            <div key={h.label} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: h.color, boxShadow: `0 0 6px ${h.color}` }} />
              <span className="text-[9px] font-semibold" style={{ color: h.color }}>{h.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Map */}
      <div className="px-3 pb-1">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" style={{ maxHeight: 460 }}>
          <defs>
            {HOTSPOTS.map(h => (
              <radialGradient key={h.district} id={`hs-grad-${h.district.replace(/\s/g,'')}`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={h.color} stopOpacity="0.7" />
                <stop offset="60%" stopColor={h.color} stopOpacity="0.25" />
                <stop offset="100%" stopColor={h.color} stopOpacity="0" />
              </radialGradient>
            ))}
            <filter id="pin-glow" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="map-glow" x="-5%" y="-5%" width="110%" height="110%">
              <feGaussianBlur stdDeviation="1.2" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* Base districts */}
          <g style={{ filter: "url(#map-glow)" }}>
            {geo.features.map(f => (
              <path
                key={f.properties.NAME_2}
                d={pathGen(f)}
                fill={getFill(f.properties.NAME_2)}
                stroke={getStroke(f.properties.NAME_2)}
                strokeWidth={HOTSPOTS.find(h => h.district === f.properties.NAME_2) ? 1.2 : 0.6}
              />
            ))}
          </g>

          {/* Hotspot glow overlays */}
          {hotspotPoints.map(h => {
            if (!h.px || isNaN(h.px)) return null;
            const key = h.district.replace(/\s/g, '');
            return (
              <g key={h.district} style={{ filter: "url(#pin-glow)" }}>
                {/* Wide outer halo */}
                <circle cx={h.px} cy={h.py} r={48} fill={`url(#hs-grad-${key})`} />
                {/* Mid ring filled */}
                <circle cx={h.px} cy={h.py} r={26} fill={h.color} opacity={0.18} />
                {/* Bright ring */}
                <circle cx={h.px} cy={h.py} r={16} fill="none"
                  stroke={h.color} strokeWidth={2} opacity={0.85} />
                {/* Inner fill ring */}
                <circle cx={h.px} cy={h.py} r={10} fill={h.color} opacity={0.3} />
                {/* Centre bright dot */}
                <circle cx={h.px} cy={h.py} r={6} fill={h.color}
                  stroke="#fff" strokeWidth={1.5} opacity={1} />
                {/* Label badge */}
                <rect x={h.px + 14} y={h.py - 20} width={80} height={32}
                  rx={7} fill="#07111f" opacity={0.92}
                  stroke={h.color} strokeWidth={1} />
                <text x={h.px + 54} y={h.py - 6} textAnchor="middle"
                  fontSize={9} fontWeight="900" fill={h.color}
                  fontFamily="Inter, sans-serif">
                  {h.label}
                </text>
                <text x={h.px + 54} y={h.py + 6} textAnchor="middle"
                  fontSize={7.5} fontWeight="500" fill="#7dd3fc"
                  fontFamily="Inter, sans-serif">
                  {h.sub}
                </text>
                <line x1={h.px + 6} y1={h.py} x2={h.px + 14} y2={h.py - 4}
                  stroke={h.color} strokeWidth={1} />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Lollipop chart */}
      {sortedDistricts.length > 0 && (
        <div className="px-5 pt-2 pb-3">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[9px] font-bold tracking-widest" style={{ color: "#334155" }}>
              STUDENTS PER DISTRICT
            </p>
            <button onClick={downloadChart}
              className="flex items-center gap-1 px-2 py-1 rounded-lg transition-all hover:opacity-80"
              style={{
                background: downloaded ? "#05603a22" : "#ffffff08",
                border: `1px solid ${downloaded ? "#34d39960" : "#ffffff15"}`,
              }}>
              {downloaded ? (
                <>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  <span className="text-[9px] font-semibold" style={{ color: "#34d399" }}>Saved!</span>
                </>
              ) : (
                <>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  <span className="text-[9px] font-semibold" style={{ color: "#64748b" }}>PNG</span>
                </>
              )}
            </button>
          </div>
          <div className="space-y-2">
            {sortedDistricts.map(([name, count]) => {
              const color  = districtColor[name];
              const pct    = (count / maxCount) * 100;
              const isSel  = selected === name;
              return (
                <button key={name} onClick={() => setSel(selected === name ? null : name)}
                  className="w-full flex items-center gap-2 group"
                  style={{ cursor: "pointer" }}>
                  {/* District label */}
                  <span className="text-[9px] font-semibold w-32 text-right flex-shrink-0 truncate transition-colors"
                    style={{ color: isSel ? color : "#64748b" }}>
                    {name}
                  </span>
                  {/* Track + lollipop */}
                  <div className="relative flex-1 h-[2px] rounded-full" style={{ background: "#1e3a5c" }}>
                    {/* Filled track */}
                    <div className="absolute left-0 top-0 h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: color, opacity: 0.35 }} />
                    {/* Lollipop dot */}
                    <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 transition-all duration-500"
                      style={{
                        left:        `calc(${pct}% - 6px)`,
                        background:  isSel ? color : "#0d1b2e",
                        borderColor: color,
                        boxShadow:   `0 0 ${isSel ? 10 : 5}px ${color}`,
                      }} />
                  </div>
                  {/* Count badge */}
                  <span className="text-[9px] font-black w-5 flex-shrink-0"
                    style={{ color }}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}


      {/* Student list for selected district */}
      {selected && (() => {
        const color    = districtColor[selected] || "#34d399";
        const students = orphans.filter(o => o.district === selected);
        return (
          <div className="mx-4 mb-4 rounded-xl overflow-hidden"
            style={{ border: `1px solid ${color}30`, background: "#ffffff05" }}>
            <div className="flex items-center justify-between px-4 py-2.5"
              style={{ background: color + "18", borderBottom: `1px solid ${color}20` }}>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full"
                  style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
                <span className="text-xs font-black" style={{ color }}>{selected}</span>
                <span className="text-[10px]" style={{ color: "#64748b" }}>
                  · {students.length} student{students.length !== 1 ? "s" : ""}
                </span>
              </div>
              <button onClick={() => setSel(null)}
                className="text-slate-500 hover:text-slate-300 text-base leading-none transition-colors">×</button>
            </div>
            <div className="divide-y max-h-48 overflow-y-auto" style={{ borderColor: "#ffffff08" }}>
              {students.map((s, i) => (
                <div key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="text-[10px] w-4 flex-shrink-0" style={{ color: "#475569" }}>{i + 1}</span>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[9px] font-black flex-shrink-0"
                    style={{ background: color + "28", color, border: `1px solid ${color}40` }}>
                    {s.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()}
                  </div>
                  <span className="text-[11px] font-semibold flex-1 truncate" style={{ color: "#e2e8f0" }}>{s.name}</span>
                  <span className="text-[9px] flex-shrink-0" style={{ color: "#475569" }}>
                    {s.level === "university" ? "🎓" : "🏫"} {s.grade || s.school || ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
