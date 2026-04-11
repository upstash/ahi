<script lang="ts">
  let { data } = $props();

  let activeTab = $state<"files" | "runs" | "logs" | "schedules">("files");

  const tabs = [
    { key: "files" as const, label: "Files" },
    { key: "runs" as const, label: "Run History" },
    { key: "logs" as const, label: "Logs" },
    { key: "schedules" as const, label: "Schedules" },
  ];

  function formatDate(ts: number | undefined) {
    if (!ts) return "—";
    return new Date(ts * 1000).toLocaleString();
  }

  function formatDuration(ms: number) {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  }

  function formatCost(usd: number | undefined) {
    if (!usd) return "—";
    return `$${usd.toFixed(4)}`;
  }

  function statusColor(status: string) {
    switch (status) {
      case "running": return "var(--green)";
      case "completed": return "var(--green)";
      case "idle": return "var(--text-muted)";
      case "failed": return "var(--red)";
      case "error": return "var(--red)";
      case "paused": return "var(--yellow)";
      default: return "var(--text-muted)";
    }
  }
</script>

<div class="agent-detail">
  <header class="agent-header">
    <div class="agent-title">
      <h2>{data.box.name ?? data.box.id}</h2>
      <span class="status-badge" style="color: {statusColor(data.box.status)}">
        {data.box.status}
      </span>
    </div>
    <div class="agent-meta">
      <span>Model: {data.box.model ?? "—"}</span>
      <span>Runtime: {data.box.runtime ?? "—"}</span>
      <span>Created: {formatDate(data.box.created_at)}</span>
      <span>Last active: {formatDate(data.box.last_activity_at)}</span>
    </div>
  </header>

  <div class="tabs">
    {#each tabs as tab}
      <button
        class="tab"
        class:active={activeTab === tab.key}
        onclick={() => (activeTab = tab.key)}
      >
        {tab.label}
      </button>
    {/each}
  </div>

  <div class="tab-content">
    {#if activeTab === "files"}
      <div class="file-browser">
        {#if data.files.length === 0}
          <p class="empty">No files.</p>
        {:else}
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Size</th>
                <th>Modified</th>
              </tr>
            </thead>
            <tbody>
              {#each data.files as file}
                <tr>
                  <td class="file-name">
                    {#if file.is_dir}
                      <span class="icon">📁</span>
                    {:else}
                      <span class="icon">📄</span>
                    {/if}
                    {file.name}
                  </td>
                  <td class="file-size">{file.is_dir ? "—" : `${file.size} B`}</td>
                  <td class="file-date">{file.mod_time}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </div>

    {:else if activeTab === "runs"}
      <div class="run-history">
        {#if data.runs.length === 0}
          <p class="empty">No runs yet.</p>
        {:else}
          <table>
            <thead>
              <tr>
                <th>Prompt</th>
                <th>Status</th>
                <th>Duration</th>
                <th>Cost</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {#each data.runs as run}
                <tr>
                  <td class="run-prompt">{run.prompt ?? "—"}</td>
                  <td>
                    <span class="status-badge" style="color: {statusColor(run.status)}">
                      {run.status}
                    </span>
                  </td>
                  <td>{formatDuration(run.duration_ms)}</td>
                  <td>{formatCost(run.cost_usd)}</td>
                  <td>{formatDate(run.created_at)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </div>

    {:else if activeTab === "logs"}
      <div class="logs">
        {#if data.logs.length === 0}
          <p class="empty">No logs.</p>
        {:else}
          <div class="log-entries">
            {#each data.logs as log}
              <div class="log-entry">
                <span class="log-time">{formatDate(log.timestamp)}</span>
                <span class="log-level" class:warn={log.level === "warn"} class:error={log.level === "error"}>
                  {log.level}
                </span>
                <span class="log-message">{log.message}</span>
              </div>
            {/each}
          </div>
        {/if}
      </div>

    {:else if activeTab === "schedules"}
      <div class="schedules">
        {#if data.schedules.length === 0}
          <p class="empty">No schedules.</p>
        {:else}
          <table>
            <thead>
              <tr>
                <th>Cron</th>
                <th>Type</th>
                <th>Prompt / Command</th>
                <th>Status</th>
                <th>Total Runs</th>
                <th>Last Run</th>
              </tr>
            </thead>
            <tbody>
              {#each data.schedules as schedule}
                <tr>
                  <td><code>{schedule.cron}</code></td>
                  <td>{schedule.type}</td>
                  <td class="run-prompt">{schedule.prompt ?? schedule.command?.join(" ") ?? "—"}</td>
                  <td>
                    <span class="status-badge" style="color: {statusColor(schedule.status)}">
                      {schedule.status}
                    </span>
                  </td>
                  <td>{schedule.total_runs}</td>
                  <td>{schedule.last_run_status ?? "—"}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .agent-detail {
    max-width: 1000px;
  }

  .agent-header {
    margin-bottom: 24px;
  }

  .agent-title {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
  }

  .agent-title h2 {
    font-size: 22px;
    font-weight: 600;
  }

  .status-badge {
    font-size: 13px;
    font-weight: 500;
  }

  .agent-meta {
    display: flex;
    gap: 20px;
    font-size: 13px;
    color: var(--text-secondary);
  }

  .tabs {
    display: flex;
    gap: 4px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 16px;
  }

  .tab {
    padding: 8px 16px;
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 14px;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: all 0.15s;
  }

  .tab:hover {
    color: var(--text);
  }

  .tab.active {
    color: var(--text);
    border-bottom-color: var(--accent);
  }

  .tab-content {
    min-height: 300px;
  }

  .empty {
    color: var(--text-muted);
    font-size: 14px;
    padding: 40px 0;
    text-align: center;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }

  th {
    text-align: left;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
    color: var(--text-secondary);
    font-weight: 500;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  td {
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
  }

  tr:hover td {
    background: var(--bg-hover);
  }

  .file-name {
    font-family: var(--font-mono);
  }

  .icon {
    margin-right: 6px;
  }

  .file-size,
  .file-date {
    color: var(--text-secondary);
  }

  .run-prompt {
    max-width: 300px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  code {
    font-family: var(--font-mono);
    font-size: 12px;
    background: var(--bg-hover);
    padding: 2px 6px;
    border-radius: 3px;
  }

  .log-entries {
    font-family: var(--font-mono);
    font-size: 12px;
    line-height: 1.8;
  }

  .log-entry {
    display: flex;
    gap: 12px;
    padding: 2px 0;
  }

  .log-time {
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .log-level {
    color: var(--text-secondary);
    flex-shrink: 0;
    min-width: 40px;
  }

  .log-level.warn {
    color: var(--yellow);
  }

  .log-level.error {
    color: var(--red);
  }

  .log-message {
    color: var(--text);
  }
</style>
