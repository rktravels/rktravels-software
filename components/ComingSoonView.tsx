import Link from "next/link";
import { Check, ExternalLink } from "lucide-react";
import { getPageModuleInfo } from "@/lib/pages-data";

interface ComingSoonViewProps {
  moduleId: string;
}

export function ComingSoonView({ moduleId }: ComingSoonViewProps) {
  const module = getPageModuleInfo(moduleId);
  const Icon = module.icon;

  return (
    <div className="w-full max-w-6xl mx-auto space-y-5">
      {/* Breadcrumbs Navigation matching the screenshot */}
      <nav className="flex items-center gap-2 text-xs text-slate-500 font-medium">
        <Link href="/dashboard" className="hover:text-slate-800 transition">
          Home
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-slate-500">{module.category}</span>
        <span className="text-slate-300">/</span>
        <span className="text-[#f16623] font-semibold">{module.name}</span>
      </nav>

      {/* Main Hero Coming Soon Card */}
      <div className="bg-white rounded-[6px] border border-slate-200/80 shadow-xs p-8 sm:p-12 md:p-14 text-center transition-all">
        {/* Top Status Pill Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-[6px] text-xs font-semibold bg-orange-50/80 text-[#f16623] border border-[#f16623]/25 tracking-wide mb-6">
          <span className="w-1.5 h-1.5 rounded-[2px] bg-[#f16623] animate-pulse"></span>
          <span>Module Coming Soon</span>
          <span className="text-slate-300">•</span>
          <span className="uppercase tracking-wider">{module.category}</span>
        </div>

        {/* Center Icon Box */}
        <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-[6px] bg-orange-50 border border-[#f16623]/20 flex items-center justify-center mx-auto text-[#f16623] mb-5 shadow-xs shadow-[#f16623]/10">
          <Icon className="w-8 h-8 stroke-[1.75]" />
        </div>

        {/* Module Title */}
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mb-2.5">
          {module.name}
        </h1>

        {/* Description */}
        <p className="text-slate-500 text-xs sm:text-sm max-w-2xl mx-auto leading-relaxed mb-7">
          {module.description}
        </p>

        {/* Action Buttons (Strictly max-height 34px and rounded 6px) */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            className="h-[34px] max-h-[34px] px-4 rounded-[6px] bg-[#f16623] hover:bg-[#d95318] text-white text-xs font-medium shadow-sm shadow-[#f16623]/20 transition inline-flex items-center gap-2 active:scale-[0.98] cursor-pointer"
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{module.primaryAction}</span>
          </button>

          <button
            type="button"
            className="h-[34px] max-h-[34px] px-4 rounded-[6px] bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium shadow-2xs transition inline-flex items-center gap-2 active:scale-[0.98] cursor-pointer"
          >
            <span>{module.secondaryAction}</span>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Planned Features Section Card */}
      <div className="bg-white rounded-[6px] border border-slate-200/80 shadow-xs p-6 sm:p-7">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-100">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              Planned Features for {module.name}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              What will be built for this section in the next development step.
            </p>
          </div>
          <span className="self-start sm:self-center px-2.5 py-1 rounded-[6px] text-xs font-semibold bg-orange-50 text-[#f16623] border border-[#f16623]/25 shrink-0">
            Ready for Implementation
          </span>
        </div>

        {/* Feature Cards Grid (3 cards matching layout) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-5">
          {module.plannedFeatures.map((feature, idx) => (
            <div
              key={idx}
              className="bg-slate-50/70 hover:bg-orange-50/30 rounded-[6px] p-3.5 border border-slate-200/70 hover:border-[#f16623]/30 transition group flex items-start gap-3"
            >
              <div className="w-4 h-4 rounded-[3px] bg-white border border-slate-200 group-hover:border-[#f16623] text-[#f16623] flex items-center justify-center shrink-0 mt-0.5 shadow-2xs transition-colors">
                <Check className="w-3 h-3 stroke-[2.5]" />
              </div>
              <p className="text-xs text-slate-600 leading-snug font-normal group-hover:text-slate-900 transition-colors">
                {feature}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
