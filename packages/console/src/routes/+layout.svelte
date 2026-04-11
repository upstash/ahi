<script lang="ts">
  import "../app.css";

  let { data, children } = $props();
</script>

<div class="layout">
  <aside class="sidebar">
    <div class="sidebar-header">
      <h1>ahi</h1>
    </div>
    <nav class="agent-list">
      {#each data.agents as agent}
        <a
          href="/agent/{agent.id}"
          class="agent-item"
          class:active={false}
        >
          <span class="status-dot {agent.status}"></span>
          <div class="agent-info">
            <span class="agent-name">{agent.name ?? agent.id}</span>
            <span class="agent-model">{agent.model ?? "—"}</span>
          </div>
        </a>
      {/each}
    </nav>
  </aside>
  <main class="content">
    {@render children()}
  </main>
</div>

<style>
  .layout {
    display: flex;
    height: 100vh;
  }

  .sidebar {
    width: 260px;
    background: var(--bg-secondary);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
  }

  .sidebar-header {
    padding: 20px;
    border-bottom: 1px solid var(--border);
  }

  .sidebar-header h1 {
    font-size: 18px;
    font-weight: 600;
    letter-spacing: 0.05em;
  }

  .agent-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }

  .agent-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.15s;
  }

  .agent-item:hover {
    background: var(--bg-hover);
  }

  .agent-item.active {
    background: var(--bg-hover);
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .status-dot.running {
    background: var(--green);
  }
  .status-dot.idle {
    background: var(--text-muted);
  }
  .status-dot.paused {
    background: var(--yellow);
  }
  .status-dot.error {
    background: var(--red);
  }
  .status-dot.creating {
    background: var(--blue);
  }

  .agent-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .agent-name {
    font-size: 14px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .agent-model {
    font-size: 12px;
    color: var(--text-muted);
  }

  .content {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
  }
</style>
