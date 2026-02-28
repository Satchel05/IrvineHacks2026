import { z } from 'zod';

// Base data point schema - flexible for various PostgreSQL column types
export const ChartDataPointSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.null(), z.date()]),
);

// Chart data array schema
export const ChartDataSchema = z.array(ChartDataPointSchema);

// Specific typed schemas for common chart patterns

// Time series data (e.g., timestamps with numeric values)
export const TimeSeriesDataPointSchema = z.object({
  timestamp: z.union([z.string(), z.date()]),
  value: z.number(),
  label: z.string().optional(),
});
export const TimeSeriesDataSchema = z.array(TimeSeriesDataPointSchema);

// Categorical data (e.g., bar charts, pie charts)
export const CategoricalDataPointSchema = z.object({
  name: z.string(),
  value: z.number(),
  fill: z.string().optional(), // for pie chart colors
});
export const CategoricalDataSchema = z.array(CategoricalDataPointSchema);

// Multi-series data (e.g., line charts with multiple lines)
export const MultiSeriesDataPointSchema = z
  .object({
    name: z.string(), // x-axis label
  })
  .catchall(z.number()); // allows dynamic series keys like { name: "Jan", sales: 100, revenue: 200 }
export const MultiSeriesDataSchema = z.array(MultiSeriesDataPointSchema);

// XY scatter plot data
export const ScatterDataPointSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number().optional(), // size for bubble charts
  name: z.string().optional(),
});
export const ScatterDataSchema = z.array(ScatterDataPointSchema);

// Complete chart configuration schema
export const ChartConfigSchema = z.object({
  type: z.enum(['line', 'bar', 'area', 'pie', 'scatter', 'composed']),
  title: z.string().optional(),
  data: ChartDataSchema,
  xAxisKey: z.string().optional(),
  yAxisKey: z.string().optional(),
  series: z
    .array(
      z.object({
        dataKey: z.string(),
        name: z.string().optional(),
        color: z.string().optional(),
        type: z.enum(['line', 'bar', 'area']).optional(), // for composed charts
      }),
    )
    .optional(),
});

// PostgreSQL query result schema (what comes back from the database)
export const PostgresQueryResultSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())),
  rowCount: z.number(),
  fields: z
    .array(
      z.object({
        name: z.string(),
        dataTypeID: z.number().optional(),
      }),
    )
    .optional(),
});

// Transform function to convert PostgreSQL results to recharts format
export const transformToChartData = (
  rows: Record<string, unknown>[],
): Record<string, string | number | null>[] => {
  return rows.map((row) => {
    const transformed: Record<string, string | number | null> = {};
    for (const [key, value] of Object.entries(row)) {
      if (value === null) {
        transformed[key] = null;
      } else if (typeof value === 'number') {
        transformed[key] = value;
      } else if (value instanceof Date) {
        transformed[key] = value.toISOString();
      } else {
        transformed[key] = String(value);
      }
    }
    return transformed;
  });
};

// Type exports
export type ChartDataPoint = z.infer<typeof ChartDataPointSchema>;
export type ChartData = z.infer<typeof ChartDataSchema>;
export type TimeSeriesDataPoint = z.infer<typeof TimeSeriesDataPointSchema>;
export type TimeSeriesData = z.infer<typeof TimeSeriesDataSchema>;
export type CategoricalDataPoint = z.infer<typeof CategoricalDataPointSchema>;
export type CategoricalData = z.infer<typeof CategoricalDataSchema>;
export type MultiSeriesDataPoint = z.infer<typeof MultiSeriesDataPointSchema>;
export type MultiSeriesData = z.infer<typeof MultiSeriesDataSchema>;
export type ScatterDataPoint = z.infer<typeof ScatterDataPointSchema>;
export type ScatterData = z.infer<typeof ScatterDataSchema>;
export type ChartConfig = z.infer<typeof ChartConfigSchema>;
export type PostgresQueryResult = z.infer<typeof PostgresQueryResultSchema>;
