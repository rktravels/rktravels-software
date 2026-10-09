"use client";

import React, { useState } from "react";
import { SOLID_PALETTE } from "@/lib/report-utils";

/* -------------------------------------------------------------------------- */
/* 1. Solid Horizontal Ranking Bar Chart                                       */
/* -------------------------------------------------------------------------- */
export interface HorizontalBarItem {
  id: string | number;
  label: string;
  subLabel?: string;
  value: number;
  secondaryValue?: string;
  color?: string;
}

interface SolidHorizontalBarChartProps {
  title: string;
  subtitle?: string;
  items: HorizontalBarItem[];
  valueFormatter?: (val: number) => string;
  emptyMessage?: string;
}

export function SolidHorizontalBarChart({
  title,
  subtitle,
  items,
  valueFormatter = (val) => val.toString(),
  emptyMessage = "No data available for selected period",
}: SolidHorizontalBarChartProps) {
  const maxValue = Math.max(...items.map((i) => i.value), 1);

  return (
    <div className="bg-white border border-slate-200/90 rounded-[6px] p-4 shadow-2xs flex flex-col">
      <div className="mb-3">
        <h4 className="text-xs font-semibold text-slate-900">{title}</h4>
        {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
      </div>

      {items.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-400">{emptyMessage}</div>
      ) : (
        <div className="space-y-3 flex-1">
          {items.map((item, idx) => {
            const barWidth = Math.min(100, Math.max(4, (item.value / maxValue) * 100));
            const barColor = item.color || SOLID_PALETTE[idx % SOLID_PALETTE.length];

            return (
              <div key={item.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    <span className="w-4 h-4 rounded-[3px] bg-slate-100 text-slate-600 text-[10px] font-medium flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <span className="font-medium text-slate-800 truncate">{item.label}</span>
                    {item.subLabel && (
                      <span className="text-[10px] text-slate-400 shrink-0">
                        ({item.subLabel})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-semibold text-slate-900">
                      {valueFormatter(item.value)}
                    </span>
                    {item.secondaryValue && (
                      <span className="text-[10px] text-slate-400">
                        {item.secondaryValue}
                      </span>
                    )}
                  </div>
                </div>

                <div className="w-full h-2.5 bg-slate-100 rounded-[4px] overflow-hidden flex">
                  <div
                    className="h-full rounded-[4px] transition-all duration-300"
                    style={{
                      width: `${barWidth}%`,
                      backgroundColor: barColor,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 2. Solid Donut / Distribution Chart                                        */
/* -------------------------------------------------------------------------- */
export interface DonutSegment {
  label: string;
  value: number;
  color?: string;
}

interface SolidDonutChartProps {
  title: string;
  subtitle?: string;
  segments: DonutSegment[];
  centerLabel?: string;
  centerValue?: string;
  valueFormatter?: (val: number) => string;
}

export function SolidDonutChart({
  title,
  subtitle,
  segments,
  centerLabel = "Total",
  centerValue,
  valueFormatter = (val) => val.toString(),
}: SolidDonutChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const total = segments.reduce((sum, s) => sum + s.value, 0);

  // SVG circular calculations
  const size = 160;
  const strokeWidth = 26;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let accumulatedPercent = 0;

  return (
    <div className="bg-white border border-slate-200/90 rounded-[6px] p-4 shadow-2xs flex flex-col">
      <div className="mb-3">
        <h4 className="text-xs font-semibold text-slate-900">{title}</h4>
        {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
      </div>

      {total === 0 ? (
        <div className="py-8 text-center text-xs text-slate-400">No data available</div>
      ) : (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 flex-1">
          {/* SVG Donut Graphic */}
          <div className="relative shrink-0 flex items-center justify-center">
            <svg
              width={size}
              height={size}
              viewBox={`0 0 ${size} ${size}`}
              className="transform -rotate-90"
            >
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="#f1f5f9"
                strokeWidth={strokeWidth}
              />
              {segments.map((seg, idx) => {
                if (seg.value <= 0) return null;
                const percent = seg.value / total;
                const dashLength = circumference * percent;
                const offset = circumference * (1 - accumulatedPercent);
                accumulatedPercent += percent;
                const color = seg.color || SOLID_PALETTE[idx % SOLID_PALETTE.length];
                const isHovered = hoveredIdx === idx;

                return (
                  <circle
                    key={seg.label}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={color}
                    strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                    strokeDasharray={`${dashLength} ${circumference}`}
                    strokeDashoffset={-offset}
                    className="transition-all duration-200 cursor-pointer"
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  />
                );
              })}
            </svg>

            {/* Donut Center Display */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-2">
              <span className="text-[10px] text-slate-400 uppercase font-medium">
                {hoveredIdx !== null ? segments[hoveredIdx].label : centerLabel}
              </span>
              <span className="text-sm font-semibold text-slate-900">
                {hoveredIdx !== null
                  ? valueFormatter(segments[hoveredIdx].value)
                  : centerValue || total.toLocaleString()}
              </span>
              {hoveredIdx !== null && (
                <span className="text-[10px] font-semibold text-[#f16623]">
                  {((segments[hoveredIdx].value / total) * 100).toFixed(0)}%
                </span>
              )}
            </div>
          </div>

          {/* Solid Legend */}
          <div className="flex-1 space-y-1.5 w-full">
            {segments.map((seg, idx) => {
              const color = seg.color || SOLID_PALETTE[idx % SOLID_PALETTE.length];
              const percent = total > 0 ? ((seg.value / total) * 100).toFixed(1) : "0";
              const isHovered = hoveredIdx === idx;

              return (
                <div
                  key={seg.label}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className={`flex items-center justify-between p-1.5 rounded-[4px] text-xs transition cursor-pointer ${
                    isHovered ? "bg-slate-100/80" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 pr-1">
                    <span
                      className="w-2.5 h-2.5 rounded-[2px] shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-slate-700 truncate font-medium">{seg.label}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-semibold text-slate-900">
                      {valueFormatter(seg.value)}
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal w-10 text-right">
                      {percent}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 3. Solid Vertical Bar Chart (Timeline / Comparison)                         */
/* -------------------------------------------------------------------------- */
export interface BarChartPoint {
  label: string;
  value: number;
  secondaryValue?: number;
  color?: string;
}

interface SolidBarChartProps {
  title: string;
  subtitle?: string;
  points: BarChartPoint[];
  primaryLabel?: string;
  secondaryLabel?: string;
  valueFormatter?: (val: number) => string;
  height?: number;
}

export function SolidBarChart({
  title,
  subtitle,
  points,
  primaryLabel = "Value",
  secondaryLabel,
  valueFormatter = (val) => val.toString(),
  height = 180,
}: SolidBarChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const maxVal = Math.max(
    ...points.map((p) => Math.max(p.value, p.secondaryValue || 0)),
    1
  );

  return (
    <div className="bg-white border border-slate-200/90 rounded-[6px] p-4 shadow-2xs flex flex-col">
      <div className="flex items-start justify-between mb-3 gap-2">
        <div>
          <h4 className="text-xs font-semibold text-slate-900">{title}</h4>
          {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-[11px]">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-[2px] bg-[#f16623]" />
            <span className="text-slate-600">{primaryLabel}</span>
          </div>
          {secondaryLabel && (
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-[2px] bg-[#2563eb]" />
              <span className="text-slate-600">{secondaryLabel}</span>
            </div>
          )}
        </div>
      </div>

      {points.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-400">No data points</div>
      ) : (
        <div className="relative pt-4 flex-1 flex flex-col justify-end">
          {/* Subtle grid horizontal line */}
          <div className="absolute inset-x-0 top-6 border-b border-dashed border-slate-100" />
          <div className="absolute inset-x-0 top-1/2 border-b border-dashed border-slate-100" />

          {/* Bars flex row */}
          <div
            className="flex items-end justify-between gap-1.5 sm:gap-2 px-1"
            style={{ height: `${height}px` }}
          >
            {points.map((pt, idx) => {
              const primaryHeight = (pt.value / maxVal) * (height - 35);
              const secHeight = pt.secondaryValue
                ? (pt.secondaryValue / maxVal) * (height - 35)
                : 0;
              const isHovered = hoveredIdx === idx;
              const barColor = pt.color || "#f16623";

              return (
                <div
                  key={idx}
                  className="flex-1 flex flex-col items-center justify-end h-full group relative cursor-pointer"
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                >
                  {/* Tooltip on hover */}
                  {isHovered && (
                    <div className="absolute -top-10 z-20 bg-slate-900 text-white text-[10px] py-1 px-2 rounded-[4px] whitespace-nowrap shadow-md pointer-events-none">
                      <div className="font-semibold">{pt.label}</div>
                      <div>
                        {primaryLabel}: {valueFormatter(pt.value)}
                      </div>
                      {pt.secondaryValue !== undefined && secondaryLabel && (
                        <div>
                          {secondaryLabel}: {valueFormatter(pt.secondaryValue)}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="w-full flex items-end justify-center gap-1">
                    {/* Primary Bar */}
                    <div
                      className="w-full max-w-[20px] rounded-t-[3px] transition-all duration-200"
                      style={{
                        height: `${Math.max(3, primaryHeight)}px`,
                        backgroundColor: barColor,
                        opacity: isHovered ? 1 : 0.9,
                      }}
                    />

                    {/* Secondary Bar if exists */}
                    {pt.secondaryValue !== undefined && (
                      <div
                        className="w-full max-w-[20px] rounded-t-[3px] bg-[#2563eb] transition-all duration-200"
                        style={{
                          height: `${Math.max(3, secHeight)}px`,
                          opacity: isHovered ? 1 : 0.9,
                        }}
                      />
                    )}
                  </div>

                  {/* Label */}
                  <span className="text-[10px] text-slate-500 font-medium mt-1 truncate max-w-full text-center group-hover:text-slate-900">
                    {pt.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 4. Solid Stacked Meter (e.g. Drive vs Idle Hours / Paid vs Pending)          */
/* -------------------------------------------------------------------------- */
export interface StackedSegment {
  label: string;
  value: number;
  color: string;
  subText?: string;
}

interface SolidStackedMeterProps {
  title: string;
  subtitle?: string;
  segments: StackedSegment[];
  unit?: string;
}

export function SolidStackedMeter({
  title,
  subtitle,
  segments,
  unit = "hrs",
}: SolidStackedMeterProps) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  return (
    <div className="bg-white border border-slate-200/90 rounded-[6px] p-4 shadow-2xs space-y-3">
      <div>
        <h4 className="text-xs font-semibold text-slate-900">{title}</h4>
        {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
      </div>

      {/* Multi-segment solid bar */}
      <div className="h-4 w-full bg-slate-100 rounded-[6px] overflow-hidden flex">
        {segments.map((seg, idx) => {
          if (total <= 0) return null;
          const pct = Math.max(0, (seg.value / total) * 100);
          return (
            <div
              key={idx}
              className="h-full transition-all duration-300"
              style={{
                width: `${pct}%`,
                backgroundColor: seg.color,
              }}
              title={`${seg.label}: ${seg.value} ${unit} (${pct.toFixed(1)}%)`}
            />
          );
        })}
      </div>

      {/* Cards list underneath */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
        {segments.map((seg, idx) => {
          const pct = total > 0 ? ((seg.value / total) * 100).toFixed(0) : "0";
          return (
            <div
              key={idx}
              className="p-2.5 rounded-[6px] border border-slate-100 bg-slate-50/50 flex flex-col justify-between"
            >
              <div className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-[2px] shrink-0"
                  style={{ backgroundColor: seg.color }}
                />
                <span className="text-[11px] font-medium text-slate-600 truncate">
                  {seg.label}
                </span>
              </div>
              <div className="mt-1.5 flex items-baseline justify-between">
                <span className="text-sm font-semibold text-slate-900">
                  {seg.value.toLocaleString()} {unit}
                </span>
                <span
                  className="text-xs font-semibold px-1.5 py-0.5 rounded-[3px] text-white text-[10px]"
                  style={{ backgroundColor: seg.color }}
                >
                  {pct}%
                </span>
              </div>
              {seg.subText && (
                <span className="text-[10px] text-slate-400 mt-0.5">{seg.subText}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 5. Solid Line Trend Chart (Daily trends / Revenue curve)                    */
/* -------------------------------------------------------------------------- */
export interface LinePoint {
  label: string;
  value: number;
}

interface SolidLineChartProps {
  title: string;
  subtitle?: string;
  data: LinePoint[];
  lineColor?: string;
  valueFormatter?: (val: number) => string;
}

export function SolidLineChart({
  title,
  subtitle,
  data,
  lineColor = "#f16623",
  valueFormatter = (val) => val.toString(),
}: SolidLineChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div className="bg-white border border-slate-200/90 rounded-[6px] p-4 shadow-2xs">
        <h4 className="text-xs font-semibold text-slate-900">{title}</h4>
        <div className="py-8 text-center text-xs text-slate-400">No data points</div>
      </div>
    );
  }

  const width = 500;
  const height = 150;
  const paddingX = 25;
  const paddingY = 20;

  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const minVal = 0;

  const getX = (idx: number) => {
    if (data.length <= 1) return width / 2;
    return paddingX + (idx / (data.length - 1)) * (width - 2 * paddingX);
  };

  const getY = (val: number) => {
    const ratio = (val - minVal) / (maxVal - minVal);
    return height - paddingY - ratio * (height - 2 * paddingY);
  };

  const pointsString = data
    .map((d, i) => `${getX(i).toFixed(1)},${getY(d.value).toFixed(1)}`)
    .join(" ");

  return (
    <div className="bg-white border border-slate-200/90 rounded-[6px] p-4 shadow-2xs flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-xs font-semibold text-slate-900">{title}</h4>
          {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        {hoveredIdx !== null && (
          <div className="px-2 py-0.5 bg-slate-900 text-white rounded-[4px] text-[10px] font-medium">
            {data[hoveredIdx].label}: {valueFormatter(data[hoveredIdx].value)}
          </div>
        )}
      </div>

      <div className="w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible"
        >
          {/* Guidelines */}
          <line
            x1={paddingX}
            y1={paddingY}
            x2={width - paddingX}
            y2={paddingY}
            stroke="#f1f5f9"
            strokeDasharray="4 4"
          />
          <line
            x1={paddingX}
            y1={height / 2}
            x2={width - paddingX}
            y2={height / 2}
            stroke="#f1f5f9"
            strokeDasharray="4 4"
          />
          <line
            x1={paddingX}
            y1={height - paddingY}
            x2={width - paddingX}
            y2={height - paddingY}
            stroke="#cbd5e1"
          />

          {/* Solid line stroke */}
          <polyline
            fill="none"
            stroke={lineColor}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={pointsString}
          />

          {/* Data Points */}
          {data.map((d, idx) => {
            const cx = getX(idx);
            const cy = getY(d.value);
            const isHovered = hoveredIdx === idx;

            return (
              <g key={idx}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={isHovered ? 5.5 : 3.5}
                  fill={isHovered ? "#ffffff" : lineColor}
                  stroke={lineColor}
                  strokeWidth={isHovered ? 3 : 1.5}
                  className="transition-all cursor-pointer"
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                />
              </g>
            );
          })}
        </svg>

        {/* X Axis labels */}
        <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1 px-2">
          <span>{data[0]?.label}</span>
          {data.length > 2 && <span>{data[Math.floor(data.length / 2)]?.label}</span>}
          <span>{data[data.length - 1]?.label}</span>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 6. Solid Pie Chart (True circular sector slices)                           */
/* -------------------------------------------------------------------------- */
export interface PieSlice {
  label: string;
  value: number;
  color?: string;
}

interface SolidPieChartProps {
  title: string;
  subtitle?: string;
  slices: PieSlice[];
  valueFormatter?: (val: number) => string;
}

export function SolidPieChart({
  title,
  subtitle,
  slices,
  valueFormatter = (val) => val.toString(),
}: SolidPieChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const total = slices.reduce((sum, s) => sum + s.value, 0);

  const size = 160;
  const radius = 68;
  const cx = size / 2;
  const cy = size / 2;

  let currentAngle = -Math.PI / 2; // start from top

  const paths = slices.map((slice, idx) => {
    if (slice.value <= 0 || total === 0) return null;
    const sliceAngle = (slice.value / total) * 2 * Math.PI;
    const startAngle = currentAngle;
    const endAngle = currentAngle + sliceAngle;
    currentAngle += sliceAngle;

    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy + radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(endAngle);
    const y2 = cy + radius * Math.sin(endAngle);

    const largeArcFlag = sliceAngle > Math.PI ? 1 : 0;
    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;

    const color = slice.color || SOLID_PALETTE[idx % SOLID_PALETTE.length];
    return { d, color, label: slice.label, value: slice.value, idx };
  });

  return (
    <div className="bg-white border border-slate-200/90 rounded-[6px] p-4 shadow-2xs flex flex-col">
      <div className="mb-3">
        <h4 className="text-xs font-semibold text-slate-900">{title}</h4>
        {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
      </div>

      {total === 0 ? (
        <div className="py-8 text-center text-xs text-slate-400">No data available</div>
      ) : (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 flex-1">
          <div className="relative shrink-0 flex items-center justify-center">
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
              {paths.map((p) => {
                if (!p) return null;
                return (
                  <path
                    key={p.label}
                    d={p.d}
                    fill={p.color}
                    stroke="#ffffff"
                    strokeWidth={1.5}
                    className="transition-opacity duration-150 cursor-pointer hover:opacity-85"
                    onMouseEnter={() => setHoveredIdx(p.idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  />
                );
              })}
            </svg>
          </div>

          {/* Legend */}
          <div className="flex-1 space-y-1.5 w-full">
            {slices.map((slice, idx) => {
              const color = slice.color || SOLID_PALETTE[idx % SOLID_PALETTE.length];
              const percent = total > 0 ? ((slice.value / total) * 100).toFixed(1) : "0";
              const isHovered = hoveredIdx === idx;

              return (
                <div
                  key={slice.label}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className={`flex items-center justify-between p-1.5 rounded-[4px] text-xs transition cursor-pointer ${
                    isHovered ? "bg-slate-100/80" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 pr-1">
                    <span
                      className="w-2.5 h-2.5 rounded-[2px] shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-slate-700 truncate font-medium">{slice.label}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-semibold text-slate-900">
                      {valueFormatter(slice.value)}
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal w-10 text-right">
                      {percent}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 7. Solid Area Graph (Filled area under trendline)                           */
/* -------------------------------------------------------------------------- */
export interface AreaPoint {
  label: string;
  value: number;
}

interface SolidAreaChartProps {
  title: string;
  subtitle?: string;
  data: AreaPoint[];
  color?: string;
  valueFormatter?: (val: number) => string;
}

export function SolidAreaChart({
  title,
  subtitle,
  data,
  color = "#f16623",
  valueFormatter = (val) => val.toString(),
}: SolidAreaChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div className="bg-white border border-slate-200/90 rounded-[6px] p-4 shadow-2xs">
        <h4 className="text-xs font-semibold text-slate-900">{title}</h4>
        <div className="py-8 text-center text-xs text-slate-400">No data points</div>
      </div>
    );
  }

  const width = 500;
  const height = 150;
  const paddingX = 25;
  const paddingY = 20;

  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const minVal = 0;

  const getX = (idx: number) => {
    if (data.length <= 1) return width / 2;
    return paddingX + (idx / (data.length - 1)) * (width - 2 * paddingX);
  };

  const getY = (val: number) => {
    const ratio = (val - minVal) / (maxVal - minVal);
    return height - paddingY - ratio * (height - 2 * paddingY);
  };

  const linePoints = data.map((d, i) => `${getX(i).toFixed(1)},${getY(d.value).toFixed(1)}`);
  const linePointsString = linePoints.join(" ");

  const yBottom = height - paddingY;
  const firstX = getX(0).toFixed(1);
  const lastX = getX(data.length - 1).toFixed(1);
  const areaPath = `M ${firstX} ${yBottom} L ${linePoints.join(" L ")} L ${lastX} ${yBottom} Z`;

  return (
    <div className="bg-white border border-slate-200/90 rounded-[6px] p-4 shadow-2xs flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-xs font-semibold text-slate-900">{title}</h4>
          {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        {hoveredIdx !== null && (
          <div className="px-2 py-0.5 bg-slate-900 text-white rounded-[4px] text-[10px] font-medium">
            {data[hoveredIdx].label}: {valueFormatter(data[hoveredIdx].value)}
          </div>
        )}
      </div>

      <div className="w-full overflow-hidden">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
          {/* Subtle Guidelines */}
          <line
            x1={paddingX}
            y1={paddingY}
            x2={width - paddingX}
            y2={paddingY}
            stroke="#f1f5f9"
            strokeDasharray="4 4"
          />
          <line
            x1={paddingX}
            y1={height / 2}
            x2={width - paddingX}
            y2={height / 2}
            stroke="#f1f5f9"
            strokeDasharray="4 4"
          />
          <line
            x1={paddingX}
            y1={yBottom}
            x2={width - paddingX}
            y2={yBottom}
            stroke="#cbd5e1"
          />

          {/* Solid Area Fill with clean solid opacity */}
          <path d={areaPath} fill={color} fillOpacity="0.18" />

          {/* Top Line Stroke */}
          <polyline
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={linePointsString}
          />

          {/* Data Points */}
          {data.map((d, idx) => {
            const cx = getX(idx);
            const cy = getY(d.value);
            const isHovered = hoveredIdx === idx;

            return (
              <circle
                key={idx}
                cx={cx}
                cy={cy}
                r={isHovered ? 5.5 : 3.5}
                fill={isHovered ? "#ffffff" : color}
                stroke={color}
                strokeWidth={isHovered ? 3 : 1.5}
                className="transition-all cursor-pointer"
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
            );
          })}
        </svg>

        {/* X Axis labels */}
        <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1 px-2">
          <span>{data[0]?.label}</span>
          {data.length > 2 && <span>{data[Math.floor(data.length / 2)]?.label}</span>}
          <span>{data[data.length - 1]?.label}</span>
        </div>
      </div>
    </div>
  );
}
