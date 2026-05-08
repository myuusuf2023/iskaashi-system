export default function StatCard({ icon: Icon, label, value, sub, color, trend, compact }) {
  const colors = {
    green:  { bg: "bg-emerald-50",  icon: "bg-emerald-500",  text: "text-emerald-600" },
    blue:   { bg: "bg-blue-50",     icon: "bg-blue-500",     text: "text-blue-600" },
    amber:  { bg: "bg-amber-50",    icon: "bg-amber-500",    text: "text-amber-600" },
    rose:   { bg: "bg-rose-50",     icon: "bg-rose-500",     text: "text-rose-600" },
    purple: { bg: "bg-purple-50",   icon: "bg-purple-500",   text: "text-purple-600" },
  };
  const c = colors[color] || colors.green;

  if (compact) {
    return (
      <div className={`rounded-2xl px-3 py-2.5 ${c.bg} border border-white shadow-sm`}>
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-[10px] text-gray-500 font-medium truncate">{label}</p>
            <p className="text-lg font-bold text-gray-800 leading-tight">{value}</p>
            {sub && <p className={`text-[10px] font-medium ${c.text} truncate`}>{sub}</p>}
          </div>
          <div className={`w-9 h-9 rounded-xl ${c.icon} flex items-center justify-center shadow flex-shrink-0 ml-2`}>
            <Icon className="w-4 h-4 text-white" />
          </div>
        </div>
        {trend !== undefined && (
          <div className="mt-1.5">
            <div className="w-full bg-white/70 rounded-full h-1">
              <div className={`h-1 rounded-full ${c.icon}`} style={{ width: `${Math.min(100, trend)}%` }} />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`rounded-2xl p-5 ${c.bg} border border-white shadow-sm hover:shadow-md transition-shadow`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{label}</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{value}</p>
          {sub && <p className={`text-xs mt-1 font-medium ${c.text}`}>{sub}</p>}
        </div>
        <div className={`w-11 h-11 rounded-xl ${c.icon} flex items-center justify-center shadow`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
      {trend !== undefined && (
        <div className="mt-3">
          <div className="w-full bg-white/70 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full ${c.icon}`}
              style={{ width: `${Math.min(100, trend)}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">{trend.toFixed(0)}% progress</p>
        </div>
      )}
    </div>
  );
}
