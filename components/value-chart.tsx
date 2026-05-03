'use client'

import {
	LineChart,
	Line,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	ResponsiveContainer,
} from 'recharts'
import { format } from 'date-fns'
import type { TooltipProps } from 'recharts'

type DataPoint = {
	timestamp: number
	value: number
	label?: string
}

type Series = {
	id: string
	name: string
	color: string
	data: DataPoint[]
}

type ValueChartProps = {
	series: Series[]
	height?: number
	currencySymbol?: string
}

type ChartDataPoint = {
	timestamp: number
} & Record<string, number | undefined>

function buildChartData(series: Series[]) {
	if (series.length === 0) return []

	const allTimestamps = Array.from(new Set(series.flatMap((s) => s.data.map((d) => d.timestamp)))).sort((a, b) => a - b)
	if (allTimestamps.length === 0) return []

	return allTimestamps.map((ts): ChartDataPoint => {
		const point: ChartDataPoint = { timestamp: ts }
		series.forEach((s) => {
			const matching = s.data.filter((d) => d.timestamp <= ts)
			if (matching.length > 0) {
				point[s.id] = matching[matching.length - 1].value
			}
		})
		return point
	})
}

function formatCompactCurrency(value: number, currencySymbol: string) {
	const absValue = Math.abs(value)

	if (absValue >= 1_000_000_000) {
		return `${currencySymbol}${(value / 1_000_000_000).toFixed(1)}B`
	}

	if (absValue >= 1_000_000) {
		return `${currencySymbol}${(value / 1_000_000).toFixed(1)}M`
	}

	if (absValue >= 1_000) {
		return `${currencySymbol}${(value / 1_000).toFixed(1)}K`
	}

	return `${currencySymbol}${value.toFixed(0)}`
}

export function ValueChart({ series, height = 280, currencySymbol = '$' }: ValueChartProps) {
	const chartData = buildChartData(series)

	function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
		if (!active || !payload?.length) return null
		const rawTimestamp = payload[0]?.payload?.timestamp ?? label
		const timestamp = Number(rawTimestamp)
		const formattedDate = Number.isFinite(timestamp) ? format(new Date(timestamp), 'MMM d, yyyy') : ''
		return (
			<div className="bg-[oklch(0.20_0_0)] border border-border rounded-lg px-3 py-2 text-sm shadow-xl">
				<p className="text-muted-foreground text-xs mb-1">{formattedDate}</p>
				{payload.map((entry) => (
					<div key={String(entry.dataKey)} className="flex items-center gap-2">
						<span className="inline-block w-2 h-2 rounded-full" style={{ background: entry.color }} />
						<span className="text-muted-foreground text-xs">{entry.name}:</span>
						<span className="font-semibold text-foreground">
							{currencySymbol}
							{Number(entry.value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
						</span>
					</div>
				))}
			</div>
		)
	}

	if (chartData.length === 0) {
		return (
			<div className="flex items-center justify-center text-muted-foreground text-sm" style={{ height }}>
				No data yet. Add your first entry to see the chart.
			</div>
		)
	}

	const minTs = chartData[0].timestamp as number
	const maxTs = chartData[chartData.length - 1].timestamp as number
	const range = maxTs - minTs || 1

	const scaledData: Array<ChartDataPoint & { x: number }> = chartData.map((d) => ({
		...d,
		x: Math.round(((Number(d.timestamp) - minTs) / range) * 1000),
	}))

	const tickCount = Math.min(scaledData.length, 6)
	const tickStep = 1000 / (tickCount - 1 || 1)
	const ticks = Array.from({ length: tickCount }, (_, i) => Math.round(i * tickStep))

	return (
		<ResponsiveContainer width="100%" height={height}>
			<LineChart data={scaledData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
				<CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0 0)" vertical={false} />
				<XAxis
					dataKey="x"
					type="number"
					domain={[0, 1000]}
					ticks={ticks}
					tickFormatter={(val) => {
						const closestEntry = scaledData.reduce((prev, curr) => (Math.abs(curr.x - val) < Math.abs(prev.x - val) ? curr : prev))
						return format(new Date(Number(closestEntry.timestamp)), 'MMM d')
					}}
					tick={{ fill: 'oklch(0.60 0 0)', fontSize: 11 }}
					axisLine={{ stroke: 'oklch(0.25 0 0)' }}
					tickLine={false}
				/>
				<YAxis
					tickFormatter={(v) => formatCompactCurrency(Number(v), currencySymbol)}
					tick={{ fill: 'oklch(0.60 0 0)', fontSize: 11 }}
					axisLine={false}
					tickLine={false}
					width={52}
				/>
				<Tooltip content={<CustomTooltip />} />
				{series.map((s) => (
					<Line
						key={s.id}
						type="monotone"
						dataKey={s.id}
						name={s.name}
						stroke={s.color}
						strokeWidth={2}
						dot={(props) => {
							const { cx, cy, index } = props
							const row = typeof index === 'number' ? scaledData[index] : undefined
							const hasActual = row ? s.data.some((d) => d.timestamp === Number(row.timestamp)) : false
							const uniqueKey = `dot-${s.id}-${index}`
							if (!hasActual) return <g key={uniqueKey} />
							return (
								<circle key={uniqueKey} cx={cx} cy={cy} r={3} fill={s.color} stroke="oklch(0.16 0 0)" strokeWidth={2} />
							)
						}}
						activeDot={{ r: 5, fill: s.color, stroke: 'oklch(0.16 0 0)', strokeWidth: 2 }}
						connectNulls
					/>
				))}
			</LineChart>
		</ResponsiveContainer>
	)
}
