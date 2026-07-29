-- Rolling 24-hour comparison used by .github/workflows/cost-monitor.yml.
-- INFORMATION_SCHEMA job metadata is not billed as a table-data query.
WITH periods AS (
  SELECT "current_24h" AS period
  UNION ALL
  SELECT "previous_24h" AS period
),
job_rollup AS (
  SELECT
    IF(
      creation_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR),
      "current_24h",
      "previous_24h"
    ) AS period,
    COUNT(*) AS query_jobs,
    ROUND(
      SUM(COALESCE(total_bytes_billed, 0)) / POW(1024, 3),
      3
    ) AS billed_gib,
    COUNTIF(
      (SELECT value FROM UNNEST(labels) WHERE key = "app")
        = "jfk_research_center"
    ) AS app_query_jobs,
    ROUND(
      SUM(
        IF(
          (SELECT value FROM UNNEST(labels) WHERE key = "app")
            = "jfk_research_center",
          COALESCE(total_bytes_billed, 0),
          0
        )
      ) / POW(1024, 3),
      3
    ) AS app_billed_gib
  FROM
    `region-us`.INFORMATION_SCHEMA.JOBS_BY_PROJECT
  WHERE
    creation_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 48 HOUR)
    AND job_type = "QUERY"
  GROUP BY
    period
)
SELECT
  periods.period,
  COALESCE(job_rollup.query_jobs, 0) AS query_jobs,
  COALESCE(job_rollup.billed_gib, 0) AS billed_gib,
  COALESCE(job_rollup.app_query_jobs, 0) AS app_query_jobs,
  COALESCE(job_rollup.app_billed_gib, 0) AS app_billed_gib
FROM
  periods
LEFT JOIN
  job_rollup USING (period)
ORDER BY
  periods.period;
