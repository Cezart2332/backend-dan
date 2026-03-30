#!/usr/bin/env node

import { performance } from "node:perf_hooks";
import { writeFile } from "node:fs/promises";
import { exec as execCb } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execCb);

function parseArgs(argv) {
  const args = {};
  for (const item of argv) {
    if (!item.startsWith("--")) continue;
    const eq = item.indexOf("=");
    if (eq === -1) {
      args[item.slice(2)] = true;
      continue;
    }
    const key = item.slice(2, eq);
    const value = item.slice(eq + 1);
    args[key] = value;
  }
  return args;
}

function toNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parsePercent(raw) {
  if (raw === undefined || raw === null) return null;
  const cleaned = String(raw).replace("%", "").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function formatMs(value) {
  return `${value.toFixed(2)} ms`;
}

function formatPct(value) {
  return `${value.toFixed(2)}%`;
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

function parseEndpoints(raw) {
  const source = (raw || "GET:/health")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

  return source.map((entry) => {
    const match = entry.match(/^(GET|POST|PUT|PATCH|DELETE|HEAD):(.+)$/i);
    if (!match) {
      return { method: "GET", path: entry.startsWith("/") ? entry : `/${entry}` };
    }
    const method = match[1].toUpperCase();
    const path = match[2].startsWith("/") ? match[2] : `/${match[2]}`;
    return { method, path };
  });
}

function parseHeaders(raw) {
  if (!raw) return {};
  const headers = {};
  for (const pair of String(raw).split(";")) {
    const idx = pair.indexOf(":");
    if (idx <= 0) continue;
    const key = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    if (key) headers[key] = value;
  }
  return headers;
}

async function collectDockerSample(containerName) {
  const cmd = `docker stats --no-stream --format "{{.CPUPerc}} {{.MemPerc}}" ${containerName}`;
  const { stdout } = await exec(cmd, { windowsHide: true });
  const line = stdout.trim().split(/\r?\n/).pop() || "";
  const [cpuRaw, memRaw] = line.split(/\s+/);
  const cpu = parsePercent(cpuRaw);
  const ram = parsePercent(memRaw);
  if (cpu === null || ram === null) {
    throw new Error(`Could not parse docker stats output: ${line}`);
  }
  return { cpu, ram };
}

function buildMysqlRecommendation({ p95, cpuPct, ramPct }) {
  let connectionLimit = 24;
  let queueLimit = 96;

  if (p95 > 450 && cpuPct < 70 && ramPct < 75) {
    connectionLimit = 32;
    queueLimit = 140;
  } else if (p95 > 300 && cpuPct < 80 && ramPct < 80) {
    connectionLimit = 28;
    queueLimit = 120;
  } else if (p95 < 150 && cpuPct < 55 && ramPct < 65) {
    connectionLimit = 20;
    queueLimit = 72;
  }

  if (cpuPct >= 85 || ramPct >= 85) {
    connectionLimit = Math.max(16, connectionLimit - 8);
    queueLimit = Math.max(60, queueLimit - 36);
  }

  const maxIdle = Math.max(6, Math.min(16, Math.round(connectionLimit / 2)));

  return {
    MYSQL_CONNECT_TIMEOUT: 5000,
    MYSQL_CONNECTION_LIMIT: connectionLimit,
    MYSQL_MAX_IDLE: maxIdle,
    MYSQL_IDLE_TIMEOUT: 60000,
    MYSQL_WAIT_FOR_CONNECTIONS: true,
    MYSQL_QUEUE_LIMIT: queueLimit,
    MYSQL_ENABLE_KEEP_ALIVE: true,
    MYSQL_KEEP_ALIVE_INITIAL_DELAY: 10000,
  };
}

function printHelp() {
  console.log(`Usage: node scripts/load-test.js [options]

Options:
  --base-url=http://127.0.0.1:3000
  --endpoints=GET:/health,GET:/api/subscriptions/current
  --token=<jwt>
  --headers=Key:Value;Another-Key:Another-Value
  --concurrency=30
  --duration-sec=60
  --timeout-ms=8000
  --cpu=65.5                 # optional measured CPU percentage
  --ram=58.2                 # optional measured RAM percentage
  --docker-container=dan-api # optional automatic sampling via docker stats
  --docker-sample-ms=2000
  --out=./load-test-result.json
  --help
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const baseUrl = String(args["base-url"] || process.env.LOAD_TEST_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
  const endpoints = parseEndpoints(args.endpoints || process.env.LOAD_TEST_ENDPOINTS || "GET:/health");
  const concurrency = Math.max(1, toNumber(args.concurrency || process.env.LOAD_TEST_CONCURRENCY, 30));
  const durationSec = Math.max(5, toNumber(args["duration-sec"] || process.env.LOAD_TEST_DURATION_SEC, 60));
  const timeoutMs = Math.max(500, toNumber(args["timeout-ms"] || process.env.LOAD_TEST_TIMEOUT_MS, 8000));
  const token = args.token || process.env.LOAD_TEST_BEARER_TOKEN || "";

  const headers = {
    Accept: "application/json",
    ...parseHeaders(args.headers || process.env.LOAD_TEST_HEADERS || ""),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const latencies = [];
  const successLatencies = [];
  let total = 0;
  let ok = 0;
  let failed = 0;
  let timeoutErrors = 0;
  let networkErrors = 0;
  const statusCounts = new Map();

  let endpointIndex = 0;
  const start = performance.now();
  const deadline = start + durationSec * 1000;

  const dockerContainer = args["docker-container"] || process.env.LOAD_TEST_DOCKER_CONTAINER;
  const dockerSampleMs = Math.max(500, toNumber(args["docker-sample-ms"] || process.env.LOAD_TEST_DOCKER_SAMPLE_MS, 2000));
  const dockerSamples = [];
  let dockerInterval = null;
  let samplingInProgress = false;

  if (dockerContainer) {
    dockerInterval = setInterval(async () => {
      if (samplingInProgress) return;
      samplingInProgress = true;
      try {
        const sample = await collectDockerSample(dockerContainer);
        dockerSamples.push(sample);
      } catch {
        // Ignore transient docker sampling failures during test.
      } finally {
        samplingInProgress = false;
      }
    }, dockerSampleMs);
  }

  const workers = Array.from({ length: concurrency }, async () => {
    while (performance.now() < deadline) {
      const target = endpoints[endpointIndex % endpoints.length];
      endpointIndex += 1;
      const startedAt = performance.now();
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(`${baseUrl}${target.path}`, {
          method: target.method,
          headers,
          signal: controller.signal,
        });

        const elapsed = performance.now() - startedAt;
        latencies.push(elapsed);
        successLatencies.push(elapsed);
        total += 1;

        statusCounts.set(response.status, (statusCounts.get(response.status) || 0) + 1);
        if (response.ok) ok += 1;
        else failed += 1;

        await response.arrayBuffer().catch(() => undefined);
      } catch (error) {
        const elapsed = performance.now() - startedAt;
        latencies.push(elapsed);
        total += 1;
        failed += 1;
        if (error && error.name === "AbortError") timeoutErrors += 1;
        else networkErrors += 1;
      } finally {
        clearTimeout(timeoutHandle);
      }
    }
  });

  await Promise.all(workers);

  if (dockerInterval) clearInterval(dockerInterval);

  const finished = performance.now();
  const actualDurationSec = Math.max(1e-9, (finished - start) / 1000);

  const latencyDataset = successLatencies.length ? successLatencies : latencies;
  const latencyDatasetLabel = successLatencies.length ? "successful responses" : "all attempts";
  const p50 = percentile(latencyDataset, 50);
  const p95 = percentile(latencyDataset, 95);
  const p99 = percentile(latencyDataset, 99);
  const errorRate = total > 0 ? (failed / total) * 100 : 0;
  const successRate = total > 0 ? (ok / total) * 100 : 0;
  const rps = total / actualDurationSec;

  const cpuFromArgs = parsePercent(args.cpu);
  const ramFromArgs = parsePercent(args.ram);

  const avgCpuFromDocker =
    dockerSamples.length > 0
      ? dockerSamples.reduce((sum, sample) => sum + sample.cpu, 0) / dockerSamples.length
      : null;
  const peakCpuFromDocker =
    dockerSamples.length > 0
      ? Math.max(...dockerSamples.map((sample) => sample.cpu))
      : null;

  const avgRamFromDocker =
    dockerSamples.length > 0
      ? dockerSamples.reduce((sum, sample) => sum + sample.ram, 0) / dockerSamples.length
      : null;
  const peakRamFromDocker =
    dockerSamples.length > 0
      ? Math.max(...dockerSamples.map((sample) => sample.ram))
      : null;

  const cpuPct = cpuFromArgs ?? avgCpuFromDocker;
  const ramPct = ramFromArgs ?? avgRamFromDocker;
  const hasHealthySample = ok >= 50 && successRate >= 90;

  const recommendation =
    cpuPct !== null && ramPct !== null && hasHealthySample
      ? buildMysqlRecommendation({ p95, cpuPct, ramPct })
      : null;

  console.log("\n=== Load Test Summary ===");
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Endpoints: ${endpoints.map((e) => `${e.method} ${e.path}`).join(", ")}`);
  console.log(`Concurrency: ${concurrency}`);
  console.log(`Duration: ${actualDurationSec.toFixed(2)} s`);
  console.log(`Requests: ${total}`);
  console.log(`Throughput: ${rps.toFixed(2)} req/s`);
  console.log(`Success: ${ok}`);
  console.log(`Failed: ${failed}`);
  console.log(`Success Rate: ${formatPct(successRate)}`);
  console.log(`Error Rate: ${formatPct(errorRate)}`);
  console.log(`Latency source: ${latencyDatasetLabel}`);
  console.log(`Latency p50: ${formatMs(p50)}`);
  console.log(`Latency p95: ${formatMs(p95)}`);
  console.log(`Latency p99: ${formatMs(p99)}`);

  if (statusCounts.size > 0) {
    console.log("Status counts:");
    for (const [status, count] of [...statusCounts.entries()].sort((a, b) => a[0] - b[0])) {
      console.log(`  ${status}: ${count}`);
    }
  }

  if (timeoutErrors || networkErrors) {
    console.log("Error details:");
    console.log(`  Timeout errors: ${timeoutErrors}`);
    console.log(`  Network errors: ${networkErrors}`);
  }

  if (dockerSamples.length > 0) {
    console.log("Docker sampling:");
    console.log(`  CPU avg/peak: ${formatPct(avgCpuFromDocker)} / ${formatPct(peakCpuFromDocker)}`);
    console.log(`  RAM avg/peak: ${formatPct(avgRamFromDocker)} / ${formatPct(peakRamFromDocker)}`);
  }

  if (recommendation) {
    console.log("\n=== MySQL Env Recommendation (2 vCPU / 4 GB VPS) ===");
    console.log(`# Based on p95=${p95.toFixed(2)} ms, CPU=${cpuPct.toFixed(2)}%, RAM=${ramPct.toFixed(2)}%`);
    for (const [key, value] of Object.entries(recommendation)) {
      console.log(`${key}=${value}`);
    }
  } else if (cpuPct !== null && ramPct !== null && !hasHealthySample) {
    console.log("\nMySQL recommendation skipped because the sample quality is too low (need >=50 successful requests and >=90% success rate).\n");
  } else {
    console.log("\nMySQL recommendation skipped (provide --cpu and --ram, or use --docker-container).\n");
  }

  const outputPath = args.out || process.env.LOAD_TEST_OUT;
  if (outputPath) {
    const report = {
      config: {
        baseUrl,
        endpoints,
        concurrency,
        durationSec,
        timeoutMs,
      },
      result: {
        requests: total,
        success: ok,
        failed,
        successRate,
        errorRate,
        rps,
        latencyMs: { p50, p95, p99 },
        latencySource: latencyDatasetLabel,
        statusCounts: Object.fromEntries(statusCounts),
        timeoutErrors,
        networkErrors,
      },
      resources: {
        cpuPct,
        ramPct,
        docker: dockerSamples.length
          ? {
              samples: dockerSamples.length,
              avgCpuPct: avgCpuFromDocker,
              peakCpuPct: peakCpuFromDocker,
              avgRamPct: avgRamFromDocker,
              peakRamPct: peakRamFromDocker,
            }
          : null,
      },
      mysqlRecommendation: recommendation,
      generatedAt: new Date().toISOString(),
    };
    await writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");
    console.log(`\nReport written to ${outputPath}`);
  }
}

main().catch((err) => {
  console.error("Load test failed:", err);
  process.exit(1);
});
