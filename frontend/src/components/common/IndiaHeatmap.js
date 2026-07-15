import { useMemo, useState } from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import { fmt } from "@/lib/api";

// Public India TopoJSON (state boundaries).
const INDIA_TOPO_JSON = "https://raw.githubusercontent.com/geohacker/india/master/state/india_telengana.geojson";

// Common name mismatches between dealer state values and TopoJSON properties.
const STATE_ALIASES = {
  "Delhi": ["NCT of Delhi", "Delhi", "National Capital Territory of Delhi"],
  "Bangalore": ["Karnataka"],
  "Pondicherry": ["Puducherry"],
  "Orissa": ["Odisha"],
};

function matchState(rows, geoName) {
  if (!geoName) return null;
  const g = geoName.toLowerCase();
  for (const r of rows) {
    if (!r.state) continue;
    const s = r.state.toLowerCase();
    if (s === g) return r;
    const aliases = STATE_ALIASES[r.state] || [];
    if (aliases.some((a) => a.toLowerCase() === g)) return r;
    if (g.includes(s) || s.includes(g)) return r;
  }
  return null;
}

/**
 * @param data [{ state, revenue, orders }]
 */
export default function IndiaHeatmap({ data = [], onSelectState }) {
  const [tooltip, setTooltip] = useState(null);

  const maxRevenue = useMemo(
    () => Math.max(1, ...data.map((d) => d.revenue || 0)),
    [data]
  );

  const colorFor = (revenue) => {
    if (!revenue) return "#F1F2F4";
    const ratio = Math.min(1, revenue / maxRevenue);
    // interpolate white -> Yamini Orange
    const r = Math.round(255 - (255 - 242) * ratio);
    const g = Math.round(255 - (255 - 140) * ratio);
    const b = Math.round(255 - (255 - 24) * ratio);
    return `rgb(${r}, ${g}, ${b})`;
  };

  return (
    <div className="relative" data-testid="india-heatmap">
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ scale: 900, center: [82, 22] }}
        width={640}
        height={520}
        style={{ width: "100%", height: "auto" }}
      >
        <Geographies geography={INDIA_TOPO_JSON}>
          {({ geographies }) =>
            geographies.map((geo) => {
              const name =
                geo.properties.NAME_1 ||
                geo.properties.name ||
                geo.properties.st_nm ||
                geo.properties.NAME ||
                "";
              const row = matchState(data, name);
              const fill = colorFor(row?.revenue || 0);
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={fill}
                  stroke="#BFC5CB"
                  strokeWidth={0.5}
                  data-testid={`heatmap-state-${name}`}
                  onMouseEnter={(e) => setTooltip({
                    x: e.clientX, y: e.clientY, name, row,
                  })}
                  onMouseMove={(e) => setTooltip((t) => t && ({ ...t, x: e.clientX, y: e.clientY }))}
                  onMouseLeave={() => setTooltip(null)}
                  onClick={() => onSelectState && onSelectState(row?.state || name)}
                  style={{
                    default: { outline: "none", cursor: "pointer" },
                    hover: { fill: "#D96B0B", outline: "none", transition: "fill 160ms" },
                    pressed: { fill: "#0A2342", outline: "none" },
                  }}
                />
              );
            })
          }
        </Geographies>
      </ComposableMap>

      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none bg-white border border-[#E5E7EB] rounded-md shadow-lg px-3 py-2 text-xs"
          style={{ left: tooltip.x + 12, top: tooltip.y + 12 }}
        >
          <div className="font-display font-semibold text-[#06182F]">{tooltip.name}</div>
          {tooltip.row ? (
            <>
              <div className="text-[#5C6670] tabular">Revenue: <span className="font-semibold text-[#0A2342]">{fmt.inr(tooltip.row.revenue)}</span></div>
              <div className="text-[#5C6670] tabular">Orders: <span className="font-semibold text-[#0A2342]">{tooltip.row.orders}</span></div>
            </>
          ) : (
            <div className="text-[#BFC5CB]">No revenue recorded</div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-2 left-2 bg-white/95 backdrop-blur px-3 py-2 rounded-md border border-[#E5E7EB] shadow-sm">
        <div className="text-[10px] uppercase tracking-widest text-[#5C6670] font-semibold mb-1.5">Revenue</div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] tabular text-[#5C6670]">₹0</span>
          <div className="w-32 h-2 rounded-sm" style={{ background: "linear-gradient(90deg, #F1F2F4, #F28C18)" }} />
          <span className="text-[10px] tabular text-[#5C6670]">{fmt.inr(maxRevenue)}</span>
        </div>
      </div>
    </div>
  );
}
