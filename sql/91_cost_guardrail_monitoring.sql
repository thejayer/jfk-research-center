-- JFK Research Center cost guardrail monitoring queries.
-- Run these in BigQuery with project jfk-vault selected and query location US.

-- 1. Hourly BigQuery query jobs and billed TiB for the last 24 hours.
DECLARE window_start TIMESTAMP DEFAULT TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR);

SELECT
  TIMESTAMP_TRUNC(creation_time, HOUR) AS hour_utc,
  user_email,
  COUNT(*) AS query_jobs,
  ROUND(SUM(COALESCE(total_bytes_billed, 0)) / POW(1024, 4), 4) AS billed_tib
FROM
  `region-us`.INFORMATION_SCHEMA.JOBS_BY_PROJECT
WHERE
  creation_time >= window_start
  AND job_type = "QUERY"
GROUP BY
  hour_utc,
  user_email
ORDER BY
  hour_utc DESC,
  billed_tib DESC,
  query_jobs DESC;

-- 2. Most expensive query jobs in the same window.
SELECT
  creation_time,
  user_email,
  job_id,
  cache_hit,
  statement_type,
  ROUND(COALESCE(total_bytes_billed, 0) / POW(1024, 4), 4) AS billed_tib,
  LEFT(REGEXP_REPLACE(query, r"\s+", " "), 500) AS query_sample
FROM
  `region-us`.INFORMATION_SCHEMA.JOBS_BY_PROJECT
WHERE
  creation_time >= window_start
  AND job_type = "QUERY"
  AND COALESCE(total_bytes_billed, 0) > 0
ORDER BY
  total_bytes_billed DESC
LIMIT 50;
