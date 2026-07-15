import { useState, useEffect, useRef, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import '@xterm/xterm/css/xterm.css';

import { Icon } from './icons.jsx';
import { apiCall, login, remoteLogin, getAuth, clearAuth, wsUrl } from './api.js';
import {
  ToastContainer, Modal, ConfirmDialog, Meter, CodeEditor,
  SshTerminalModal, LogLines,
} from './components.jsx';

const EMPTY_STATS = {
  cpu: 0,
  ram: { total: 0, used: 0, pct: 0 },
  disk: { total: '0G', used: '0G', pct: 0 },
  uptime: 0,
  hostname: '...',
  platform: '',
};

const DEFAULT_SCRIPT = '#!/bin/bash\n# Write your script here\necho "Script started"\n\nexit 0';

const WIDGET_COLORS = ['indigo', 'violet', 'emerald', 'amber', 'rose', 'cyan', 'orange'];
const WIDGET_ICONS = [
  ['terminal', 'Terminal'], ['activity', 'Activity'], ['cpu', 'CPU'], ['database', 'Database'],
  ['server', 'Server'], ['heart-rate', 'Health'], ['refresh', 'Sync'], ['shield', 'Shield'],
  ['wifi', 'Network'], ['ssh', 'SSH'], ['key', 'Key'], ['stats', 'Stats'],
];

function formatUptime(s) {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return `${d > 0 ? d + 'd ' : ''}${h}h ${m}m`;
}

export default function App() {
  const isRemoteRoute = window.location.pathname.startsWith('/remote');

  const [auth, setAuthState] = useState(getAuth());
  const [view, setView] = useState('overview');

  const [stats, setStats] = useState(EMPTY_STATS);
  const [ports, setPorts] = useState(null);
  const [scripts, setScripts] = useState([]);
  const [remoteWidgets, setRemoteWidgets] = useState([]);
  const [history, setHistory] = useState([]);
  const [settings, setSettings] = useState({ port: 8080, username: 'admin', password: '', remotePin: '' });
  const [sshConnections, setSshConnections] = useState([]);

  // Run console (admin modal + remote drawer share this)
  const [run, setRun] = useState(null); // { scriptId, scriptName, runId, status, exitCode }
  const [runLogs, setRunLogs] = useState([]);
  const [runOpen, setRunOpen] = useState(false);

  const [sshTerminalConn, setSshTerminalConn] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [toasts, setToasts] = useState([]);

  const socketRef = useRef(null);
  const logBottomRef = useRef(null);

  // ── Toast helpers ──────────────────────────────────────
  const addToast = useCallback((message, type = 'info', duration = 3500) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  }, []);
  const removeToast = useCallback(id => setToasts(prev => prev.filter(t => t.id !== id)), []);

  const logout = useCallback(() => {
    clearAuth();
    setAuthState({ token: '', role: '' });
  }, []);

  // ── API wrapper: kick back to login on 401 ─────────────
  const api = useCallback(async (endpoint, method, body) => {
    try {
      return await apiCall(endpoint, method, body);
    } catch (e) {
      if (e.status === 401) logout();
      throw e;
    }
  }, [logout]);

  const quiet = (p) => p.catch(() => {});

  // ── Data fetchers ──────────────────────────────────────
  const fetchPorts = () => quiet(api('/api/system/ports').then(setPorts));
  const fetchScripts = () => quiet(api('/api/scripts').then(setScripts));
  const fetchRemoteConfig = () => quiet(api('/api/remote/config').then(d => setRemoteWidgets(d.widgets || [])));
  const fetchHistory = () => quiet(api('/api/history').then(setHistory));
  const fetchSettings = () => quiet(api('/api/settings').then(s => setSettings({ ...s, password: '' })));
  const fetchSshConnections = () => quiet(api('/api/ssh/connections').then(setSshConnections));

  // ── WebSocket (stats + live logs) ──────────────────────
  useEffect(() => {
    if (!auth.token) return;
    let closed = false;
    let reconnectTimer = null;

    const connect = () => {
      const ws = new WebSocket(wsUrl('/ws'));
      socketRef.current = ws;
      ws.onopen = () => ws.send(JSON.stringify({ type: 'subscribe-stats' }));
      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'stats') setStats(msg.data);
        else if (msg.type === 'log') setRunLogs(prev => [...prev, msg.text]);
        else if (msg.type === 'script-finished') {
          setRun(prev => prev && prev.runId === msg.runId
            ? { ...prev, status: msg.status, exitCode: msg.exitCode }
            : prev);
          setScripts(prev => prev.map(s => s.id === msg.scriptId ? { ...s, lastStatus: msg.status } : s));
        } else if (msg.type === 'indicator-update') {
          setScripts(prev => prev.map(s => s.id === msg.scriptId ? { ...s, lastStatus: msg.lastStatus, lastOutput: msg.lastOutput } : s));
        } else if (msg.type === 'remote-reload' && isRemoteRoute) {
          fetchRemoteConfig();
        }
      };
      ws.onclose = (e) => {
        if (closed) return;
        if (e.code === 1008) { logout(); return; }
        reconnectTimer = setTimeout(connect, 3000);
      };
    };

    connect();
    return () => {
      closed = true;
      clearTimeout(reconnectTimer);
      if (socketRef.current) socketRef.current.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.token]);

  // ── Initial + per-view data loading ────────────────────
  useEffect(() => {
    if (!auth.token) return;
    if (isRemoteRoute) {
      fetchRemoteConfig();
      fetchScripts();
      fetchSshConnections();
      return;
    }
    if (view === 'overview') fetchPorts();
    else if (view === 'scripts') fetchScripts();
    else if (view === 'remote-designer') { fetchRemoteConfig(); fetchScripts(); fetchSshConnections(); }
    else if (view === 'ssh') fetchSshConnections();
    else if (view === 'history') fetchHistory();
    else if (view === 'settings') fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.token, view]);

  useEffect(() => {
    if (logBottomRef.current) logBottomRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [runLogs, runOpen]);

  // ── Script execution ───────────────────────────────────
  const runScript = async (script, trigger = 'manual') => {
    if (!script || (run && run.status === 'running')) {
      if (run && run.status === 'running') addToast('A script is already running', 'info');
      return;
    }
    setRunLogs([]);
    setRun({ scriptId: script.id, scriptName: script.name, runId: null, status: 'starting', exitCode: null });
    setRunOpen(true);
    try {
      const res = await api('/api/scripts/run', 'POST', { id: script.id, trigger });
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: 'subscribe-log', runId: res.runId }));
      }
      setRun(prev => prev ? { ...prev, runId: res.runId, status: 'running' } : prev);
    } catch (err) {
      setRunLogs(prev => [...prev, `[system-err] Failed to start: ${err.message}`]);
      setRun(prev => prev ? { ...prev, status: 'failure' } : prev);
    }
  };

  const cancelRun = async () => {
    if (run?.runId) quiet(api('/api/scripts/cancel', 'POST', { runId: run.runId }));
  };

  const isRunning = run && (run.status === 'running' || run.status === 'starting');

  // ════════════════════════════════════════════════════════
  // AUTH SCREENS
  // ════════════════════════════════════════════════════════
  if (!auth.token) {
    return isRemoteRoute
      ? <PinScreen onSuccess={() => setAuthState(getAuth())} />
      : <LoginScreen onSuccess={() => setAuthState(getAuth())} />;
  }

  // ════════════════════════════════════════════════════════
  // MOBILE REMOTE
  // ════════════════════════════════════════════════════════
  if (isRemoteRoute) {
    return (
      <div className="remote-wrapper">
        <ToastContainer toasts={toasts} onRemove={removeToast} />
        <header className="remote-header">
          <div className="remote-brand">
            <Icon name="server" />
            <div>
              <h1>ServManager</h1>
              <span className="mono muted">{stats.hostname}</span>
            </div>
          </div>
          <div className="remote-header-actions">
            <span className="live-dot" aria-label="Connected" />
            <button className="btn btn-ghost" onClick={logout}><Icon name="key" /> Lock</button>
          </div>
        </header>

        <main className="remote-main">
          <div className="remote-grid">
            {remoteWidgets.length === 0
              ? <div className="empty-state"><Icon name="layout" /><p>No widgets yet. Open the admin dashboard and add some in Remote Designer.</p></div>
              : [...remoteWidgets].sort((a, b) => a.position - b.position).map(w => (
                <RemoteWidget key={w.id} widget={w} stats={stats} scripts={scripts}
                  sshConnections={sshConnections}
                  running={isRunning && run.scriptId === w.scriptId}
                  onRun={(s) => runScript(s, 'remote')}
                  onSsh={setSshTerminalConn} />
              ))
            }
          </div>
          {sshConnections.length > 0 && (
            <section className="remote-ssh-strip">
              <span className="strip-label">Terminals</span>
              <div className="ssh-chip-row">
                {sshConnections.map(c => (
                  <button key={c.id} className="ssh-chip" onClick={() => setSshTerminalConn(c)}>
                    <Icon name="ssh" />
                    <span className="chip-text">
                      <span className="chip-name">{c.name}</span>
                      <span className="chip-sub mono">{c.username}@{c.host}</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </main>

        <div className={`console-drawer ${runOpen ? '' : 'hidden'}`}>
          <div className="drawer-header">
            <div className="drawer-title">{run?.scriptName || ''}</div>
            <div className="drawer-actions">
              {isRunning && <button className="btn btn-danger btn-sm" onClick={cancelRun}><Icon name="stop" /> Stop</button>}
              <button className="btn btn-ghost btn-icon" onClick={() => setRunOpen(false)} aria-label="Close console"><Icon name="close" /></button>
            </div>
          </div>
          <div className="drawer-body terminal-surface">
            <LogLines lines={runLogs} bottomRef={logBottomRef} />
          </div>
        </div>

        {sshTerminalConn && <SshTerminalModal conn={sshTerminalConn} onClose={() => setSshTerminalConn(null)} />}
      </div>
    );
  }

  // ════════════════════════════════════════════════════════
  // ADMIN DASHBOARD
  // ════════════════════════════════════════════════════════
  const NAV = [
    { group: 'Monitor', items: [{ id: 'overview', icon: 'stats', label: 'Overview' }] },
    { group: 'Automate', items: [{ id: 'scripts', icon: 'terminal', label: 'Scripts' }] },
    { group: 'Remote', items: [
      { id: 'remote-designer', icon: 'layout', label: 'Remote Designer' },
      { id: 'ssh', icon: 'ssh', label: 'SSH Hosts' },
    ]},
    { group: 'System', items: [
      { id: 'history', icon: 'clock', label: 'Run History' },
      { id: 'settings', icon: 'settings', label: 'Settings' },
    ]},
  ];

  return (
    <div className="dashboard-container">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <ConfirmDialog confirm={confirm} onClose={() => setConfirm(null)} />

      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-logo"><Icon name="server" /></div>
          <h2>ServManager</h2>
        </div>

        <nav className="sidebar-menu">
          {NAV.map(({ group, items }) => (
            <div key={group} className="nav-group">
              <span className="nav-group-label">{group}</span>
              {items.map(({ id, icon, label }) => (
                <button key={id} className={`menu-item ${view === id ? 'active' : ''}`} onClick={() => setView(id)}>
                  <Icon name={icon} /> {label}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="node-info">
            <span className="live-dot" />
            <div>
              <span className="node-name mono">{stats.hostname}</span>
              <span className="node-sub">up {formatUptime(stats.uptime)}</span>
            </div>
          </div>
          <button className="btn btn-ghost sidebar-logout" onClick={logout}><Icon name="logout" /> Sign out</button>
        </div>
      </aside>

      <main className="main-content">
        {view === 'overview' && (
          <OverviewView stats={stats} ports={ports} onRefreshPorts={fetchPorts} />
        )}
        {view === 'scripts' && (
          <ScriptsView scripts={scripts} api={api} addToast={addToast} setConfirm={setConfirm}
            onRun={runScript} refresh={fetchScripts} />
        )}
        {view === 'remote-designer' && (
          <RemoteDesignerView widgets={remoteWidgets} setWidgets={setRemoteWidgets}
            scripts={scripts} sshConnections={sshConnections} api={api} addToast={addToast} stats={stats} />
        )}
        {view === 'ssh' && (
          <SshView connections={sshConnections} api={api} addToast={addToast} setConfirm={setConfirm}
            refresh={fetchSshConnections} onOpenTerminal={setSshTerminalConn} />
        )}
        {view === 'history' && (
          <HistoryView history={history} api={api} addToast={addToast} setConfirm={setConfirm} refresh={fetchHistory} />
        )}
        {view === 'settings' && (
          <SettingsView settings={settings} setSettings={setSettings} api={api} addToast={addToast} />
        )}
      </main>

      {runOpen && run && (
        <Modal title={run.scriptName} onClose={() => setRunOpen(false)} wide
          footer={
            <>
              <div className="run-status">
                <span className={`status-dot ${isRunning ? 'running' : run.status === 'success' ? 'success' : run.status === 'cancelled' ? 'inactive' : 'danger'}`} />
                <span className="mono">
                  {isRunning ? 'Running…' : run.status === 'cancelled' ? 'Cancelled' : `${run.status === 'success' ? 'Finished' : 'Failed'} (exit ${run.exitCode})`}
                </span>
              </div>
              {isRunning
                ? <button className="btn btn-danger" onClick={cancelRun}><Icon name="stop" /> Stop</button>
                : <button className="btn btn-ghost" onClick={() => setRunOpen(false)}>Close</button>}
            </>
          }>
          <div className="terminal-surface run-terminal">
            <LogLines lines={runLogs} bottomRef={logBottomRef} />
          </div>
        </Modal>
      )}

      {sshTerminalConn && <SshTerminalModal conn={sshTerminalConn} onClose={() => setSshTerminalConn(null)} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Login screen
// ─────────────────────────────────────────────────────────
function LoginScreen({ onSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) { setError('Enter your username and password.'); return; }
    setError('');
    setBusy(true);
    try {
      await login(username.trim(), password);
      onSuccess();
    } catch (err) {
      setError(err.message === 'Failed to fetch' ? 'Cannot reach the server. Is ServManager running?' : err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={submit}>
        <div className="brand-logo lg"><Icon name="server" /></div>
        <h1>ServManager</h1>
        <p className="muted">Sign in to manage this server.</p>
        <div className="form-group">
          <label htmlFor="login-user">Username</label>
          <input id="login-user" type="text" value={username} onChange={e => setUsername(e.target.value)} autoFocus autoComplete="username" />
        </div>
        <div className="form-group">
          <label htmlFor="login-pass">Password</label>
          <input id="login-pass" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
        </div>
        {error && <p className="form-error">{error}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// PIN screen (mobile remote)
// ─────────────────────────────────────────────────────────
function PinScreen({ onSuccess }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);

  const press = async (digit) => {
    if (shake) return;
    const next = pin + digit;
    setPin(next);
    setError('');
    if (next.length === 4) {
      try {
        await remoteLogin(next);
        onSuccess();
      } catch (err) {
        setError(err.message);
        setShake(true);
        setTimeout(() => { setPin(''); setShake(false); }, 600);
      }
    }
  };

  return (
    <div className="auth-screen">
      <div className="pin-card">
        <div className="brand-logo lg"><Icon name="server" /></div>
        <h1>Remote access</h1>
        <p className="muted">Enter your 4-digit PIN</p>
        <div className={`pin-display${shake ? ' shake' : ''}`}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} className={`pin-dot${i < pin.length ? (shake ? ' error' : ' filled') : ''}`} />
          ))}
        </div>
        <div className="pin-keypad">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
            <button key={n} className="pin-key" onClick={() => press(String(n))}>{n}</button>
          ))}
          <div />
          <button className="pin-key" onClick={() => press('0')}>0</button>
          <button className="pin-key pin-key-del" onClick={() => setPin(p => p.slice(0, -1))} aria-label="Delete digit">⌫</button>
        </div>
        {error && <p className="form-error">{error}</p>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Remote widget tile
// ─────────────────────────────────────────────────────────
function RemoteWidget({ widget: w, stats, scripts, sshConnections, running, onRun, onSsh }) {
  const script = scripts.find(s => s.id === w.scriptId);
  const sshConn = sshConnections.find(c => c.id === w.sshConnectionId);

  if (w.type === 'button') {
    return (
      <button className={`remote-widget type-button size-${w.size} accent-${w.color}${running ? ' running' : ''}`}
        onClick={() => !running && script && onRun(script)} disabled={!script}>
        <div className="widget-icon"><Icon name={w.icon} /></div>
        <div className="widget-body">
          <div className="widget-title">{w.title}</div>
          {w.description && <div className="widget-sub">{w.description}</div>}
          <div className="widget-hint">{!script ? 'Script missing' : running ? 'Running…' : 'Tap to run'}</div>
        </div>
      </button>
    );
  }

  if (w.type === 'indicator') {
    const status = script?.lastStatus || '';
    const sc = status === 'success' ? 'success' : status === 'failure' ? 'danger' : 'inactive';
    return (
      <div className={`remote-widget type-indicator size-${w.size} accent-${w.color}`}>
        <div className="indicator-row">
          <span className={`status-dot lg ${sc}`} />
          <div className="widget-icon sm"><Icon name={w.icon} /></div>
        </div>
        <div className="widget-body">
          <div className="widget-title">{w.title}</div>
          {w.description && <div className="widget-sub">{w.description}</div>}
          <div className={`widget-status ${sc}`}>{status ? (status === 'success' ? 'Healthy' : status === 'failure' ? 'Failing' : status) : 'No data yet'}</div>
        </div>
      </div>
    );
  }

  if (w.type === 'metric') {
    let val = '--';
    if (w.metricType === 'cpu') val = `${Math.round(stats.cpu)}%`;
    else if (w.metricType === 'ram') val = `${Math.round(stats.ram.pct)}%`;
    else if (w.metricType === 'disk') val = `${Math.round(stats.disk.pct)}%`;
    else if (w.metricType === 'uptime') val = formatUptime(stats.uptime);
    return (
      <div className={`remote-widget type-metric size-${w.size} accent-${w.color}`}>
        <div className="widget-icon"><Icon name={w.icon} /></div>
        <div className="widget-body">
          <div className="metric-number mono">{val}</div>
          <div className="widget-title">{w.title}</div>
        </div>
      </div>
    );
  }

  if (w.type === 'ssh') {
    return (
      <button className={`remote-widget type-ssh size-${w.size} accent-${w.color}`}
        onClick={() => sshConn && onSsh(sshConn)} disabled={!sshConn}>
        <div className="widget-icon"><Icon name="ssh" /></div>
        <div className="widget-body">
          <div className="widget-title">{w.title}</div>
          {sshConn
            ? <div className="widget-sub mono">{sshConn.username}@{sshConn.host}</div>
            : <div className="widget-sub danger-text">Connection missing</div>}
          <div className="widget-hint">Tap to open terminal</div>
        </div>
      </button>
    );
  }

  return null;
}

// ─────────────────────────────────────────────────────────
// View: Overview
// ─────────────────────────────────────────────────────────
function OverviewView({ stats, ports, onRefreshPorts }) {
  return (
    <div className="view-section">
      <div className="view-head">
        <div>
          <h1>Overview</h1>
          <p className="muted">Live resources and open ports on <span className="mono">{stats.hostname}</span>.</p>
        </div>
      </div>

      <div className="meters-grid">
        <Meter label="CPU" icon="cpu" pct={stats.cpu} detail="Average core load" />
        <Meter label="Memory" icon="database" pct={stats.ram.pct} detail={`${Math.round(stats.ram.used)} MB of ${Math.round(stats.ram.total)} MB`} />
        <Meter label="Disk" icon="server" pct={stats.disk.pct} detail={`${stats.disk.used} of ${stats.disk.total} used`} />
      </div>

      <div className="info-chip-row">
        <div className="info-chip card"><Icon name="server" /><span className="mono">{stats.hostname}</span></div>
        <div className="info-chip card"><Icon name="clock" /><span>Up {formatUptime(stats.uptime)}</span></div>
        <div className="info-chip card"><Icon name="info" /><span className="mono">{stats.platform || 'unknown'}</span></div>
      </div>

      <div className="card table-card">
        <div className="card-head">
          <h3>Listening ports</h3>
          <div className="card-head-actions">
            {ports && <span className="badge badge-neutral">{ports.length} open</span>}
            <button className="btn btn-ghost btn-icon" onClick={onRefreshPorts} title="Refresh"><Icon name="refresh" /></button>
          </div>
        </div>
        <div className="table-container">
          <table>
            <thead><tr><th>Protocol</th><th>Port</th><th>Address</th><th>State</th></tr></thead>
            <tbody>
              {ports === null
                ? <tr><td colSpan="4" className="table-empty">Scanning…</td></tr>
                : ports.length === 0
                  ? <tr><td colSpan="4" className="table-empty">No listening ports found (may need root privileges).</td></tr>
                  : ports.map((p, i) => (
                    <tr key={i}>
                      <td><span className={`badge ${p.proto === 'TCP' ? 'badge-info' : 'badge-warn'}`}>{p.proto}</span></td>
                      <td className="mono strong">{p.port}</td>
                      <td className="mono muted">{p.address}</td>
                      <td className="mono muted">{p.state}</td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// View: Scripts
// ─────────────────────────────────────────────────────────
function ScriptsView({ scripts, api, addToast, setConfirm, onRun, refresh }) {
  const [editor, setEditor] = useState(null); // form state or null

  const openEditor = (s = null) => setEditor(s
    ? { id: s.id, name: s.name, description: s.description || '', content: s.content || '', scheduled: (s.interval || 0) > 0, interval: s.interval || 60 }
    : { id: '', name: '', description: '', content: DEFAULT_SCRIPT, scheduled: false, interval: 60 });

  const save = async (e) => {
    e.preventDefault();
    try {
      await api('/api/scripts', 'POST', {
        id: editor.id || null,
        name: editor.name,
        description: editor.description,
        content: editor.content,
        interval: editor.scheduled ? (parseInt(editor.interval, 10) || 60) : 0,
      });
      setEditor(null);
      refresh();
      addToast('Script saved', 'success');
    } catch (err) {
      addToast(`Could not save script: ${err.message}`, 'error');
    }
  };

  const remove = (s) => setConfirm({
    title: 'Delete script',
    message: `"${s.name}" and any remote widgets bound to it will be removed. This cannot be undone.`,
    onConfirm: async () => {
      try {
        await api(`/api/scripts/${s.id}`, 'DELETE');
        refresh();
        addToast('Script deleted', 'info');
      } catch (err) {
        addToast(`Could not delete: ${err.message}`, 'error');
      }
    },
  });

  return (
    <div className="view-section">
      <div className="view-head">
        <div>
          <h1>Scripts</h1>
          <p className="muted">Shell scripts you can run on demand, on a schedule, or from your phone.</p>
        </div>
        <button className="btn btn-primary" onClick={() => openEditor()}><Icon name="plus" /> New script</button>
      </div>

      <div className="cards-grid">
        {scripts.length === 0
          ? <div className="empty-state card"><Icon name="terminal" /><p>No scripts yet. Create one to run commands on this server.</p><button className="btn btn-primary" onClick={() => openEditor()}><Icon name="plus" /> New script</button></div>
          : scripts.map(s => {
            const sc = s.lastStatus === 'success' ? 'success' : s.lastStatus === 'failure' ? 'danger' : 'inactive';
            return (
              <div className="card script-card" key={s.id}>
                <div className="script-head">
                  <h3>{s.name}</h3>
                  <span className={`status-dot ${sc}`} title={s.lastStatus || 'never run'} />
                </div>
                <p className="script-desc">{s.description || 'No description.'}</p>
                {s.lastOutput && <pre className="script-output mono">{s.lastOutput.slice(0, 160)}{s.lastOutput.length > 160 ? '…' : ''}</pre>}
                <div className="script-foot">
                  <span className="muted small">
                    {(s.interval || 0) > 0 ? <><Icon name="refresh" className="icon-inline" /> every {s.interval}s</> : 'manual'}
                    {' · '}{s.lastRun ? new Date(s.lastRun).toLocaleTimeString() : 'never run'}
                  </span>
                  <div className="row-actions">
                    <button className="btn btn-ghost btn-icon" onClick={() => openEditor(s)} title="Edit"><Icon name="edit" /></button>
                    <button className="btn btn-ghost btn-icon danger-text" onClick={() => remove(s)} title="Delete"><Icon name="trash" /></button>
                    <button className="btn btn-primary btn-icon" onClick={() => onRun(s)} title="Run now"><Icon name="play" /></button>
                  </div>
                </div>
              </div>
            );
          })
        }
      </div>

      {editor && (
        <Modal title={editor.id ? 'Edit script' : 'New script'} onClose={() => setEditor(null)} wide>
          <form onSubmit={save} className="editor-form">
            <div className="form-row">
              <div className="form-group flex-2">
                <label htmlFor="script-name">Name</label>
                <input id="script-name" type="text" required value={editor.name}
                  onChange={e => setEditor({ ...editor, name: e.target.value })}
                  placeholder="e.g. Clear temp files" />
              </div>
              <div className="form-group flex-2">
                <label htmlFor="script-desc">Description <span className="muted">(optional)</span></label>
                <input id="script-desc" type="text" value={editor.description}
                  onChange={e => setEditor({ ...editor, description: e.target.value })}
                  placeholder="What does it do?" />
              </div>
            </div>
            <div className="form-group schedule-row">
              <label className="checkbox-label">
                <input type="checkbox" checked={editor.scheduled}
                  onChange={e => setEditor({ ...editor, scheduled: e.target.checked })} />
                Run automatically on a schedule
              </label>
              {editor.scheduled && (
                <span className="schedule-interval">
                  every <input type="number" min="5" value={editor.interval}
                    onChange={e => setEditor({ ...editor, interval: e.target.value })} /> seconds
                </span>
              )}
            </div>
            <div className="form-group">
              <label>Script <span className="muted">(bash on Linux, batch on Windows)</span></label>
              <CodeEditor value={editor.content} onChange={v => setEditor({ ...editor, content: v })} minHeight="300px" />
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setEditor(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary"><Icon name="save" /> Save script</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// View: Remote Designer
// ─────────────────────────────────────────────────────────
function RemoteDesignerView({ widgets, setWidgets, scripts, sshConnections, api, addToast, stats }) {
  const [editing, setEditing] = useState(null); // widget draft being edited, or null
  const [qr, setQr] = useState(null);
  const [dirty, setDirty] = useState(false);
  const dragItem = useRef(null);
  const [dragOverId, setDragOverId] = useState(null);

  const sorted = [...widgets].sort((a, b) => a.position - b.position);

  const mutate = (fn) => { setWidgets(fn); setDirty(true); };

  const startNew = (type) => setEditing({
    id: null,
    type,
    title: '',
    description: '',
    scriptId: scripts[0]?.id || '',
    sshConnectionId: sshConnections[0]?.id || '',
    metricType: 'cpu',
    size: 'small',
    color: 'orange',
    icon: type === 'ssh' ? 'ssh' : type === 'metric' ? 'stats' : type === 'indicator' ? 'heart-rate' : 'terminal',
  });

  const startEdit = (w) => setEditing({ ...w });

  const commitEditor = (draft) => {
    if ((draft.type === 'button' || draft.type === 'indicator') && !draft.scriptId) {
      addToast('Pick a script for this widget', 'error');
      return;
    }
    if (draft.type === 'ssh' && !draft.sshConnectionId) {
      addToast('Pick an SSH host for this widget', 'error');
      return;
    }
    if (!draft.title.trim()) {
      addToast('Give the widget a label', 'error');
      return;
    }
    const clean = {
      ...draft,
      title: draft.title.trim(),
      scriptId: (draft.type === 'button' || draft.type === 'indicator') ? draft.scriptId : null,
      sshConnectionId: draft.type === 'ssh' ? draft.sshConnectionId : null,
      metricType: draft.type === 'metric' ? draft.metricType : null,
    };
    if (draft.id) {
      mutate(prev => prev.map(w => w.id === draft.id ? { ...w, ...clean } : w));
    } else {
      mutate(prev => [...prev, { ...clean, id: 'widget_' + Date.now(), position: prev.length }]);
    }
    setEditing(null);
  };

  const removeWidget = (id) => {
    mutate(prev => prev.filter(w => w.id !== id).map((w, i) => ({ ...w, position: i })));
    setEditing(null);
  };

  const saveLayout = async () => {
    try {
      await api('/api/remote/config', 'POST', { widgets });
      setDirty(false);
      const info = await api('/api/system/info');
      setQr(info.remoteUrl || `${window.location.origin}/remote`);
      addToast('Remote layout saved', 'success');
    } catch (e) {
      addToast(`Could not save layout: ${e.message}`, 'error');
    }
  };

  const onDrop = (e, targetId) => {
    e.preventDefault();
    setDragOverId(null);
    if (!dragItem.current || dragItem.current === targetId) return;
    mutate(prev => {
      const s = [...prev].sort((a, b) => a.position - b.position);
      const fi = s.findIndex(w => w.id === dragItem.current);
      const ti = s.findIndex(w => w.id === targetId);
      if (fi === -1 || ti === -1) return prev;
      const [moved] = s.splice(fi, 1);
      s.splice(ti, 0, moved);
      return s.map((w, i) => ({ ...w, position: i }));
    });
    dragItem.current = null;
  };

  const QUICK_ADD = [
    { type: 'button', icon: 'play', label: 'Script button', desc: 'Tap to run a script' },
    { type: 'metric', icon: 'stats', label: 'Live metric', desc: 'CPU, RAM, disk, uptime' },
    { type: 'indicator', icon: 'heart-rate', label: 'Health indicator', desc: 'Last result of a scheduled script' },
    { type: 'ssh', icon: 'ssh', label: 'SSH terminal', desc: 'One-tap terminal to a host' },
  ];

  return (
    <div className="view-section">
      <div className="view-head">
        <div>
          <h1>Remote Designer</h1>
          <p className="muted">Everything you place here shows up on your phone at <span className="mono">/remote</span>. Tap a tile to edit it, drag to reorder.</p>
        </div>
        <div className="head-actions">
          <a href="/remote" target="_blank" rel="noreferrer" className="btn btn-ghost"><Icon name="external-link" /> Open remote</a>
          <button className="btn btn-primary" onClick={saveLayout}>
            <Icon name="save" /> Save layout{dirty ? ' •' : ''}
          </button>
        </div>
      </div>

      <div className="designer-layout">
        <div className="designer-side">
          <div className="card designer-palette">
            <h4>Add a widget</h4>
            <div className="palette-list">
              {QUICK_ADD.map(q => (
                <button key={q.type} className="palette-item" onClick={() => startNew(q.type)}>
                  <span className="widget-icon"><Icon name={q.icon} /></span>
                  <span className="palette-text">
                    <span className="palette-label">{q.label}</span>
                    <span className="palette-desc">{q.desc}</span>
                  </span>
                  <Icon name="plus" className="icon-svg palette-plus" />
                </button>
              ))}
            </div>
            {scripts.length === 0 && (
              <p className="muted small palette-note">No scripts yet — buttons and indicators need one. Create scripts first.</p>
            )}
            {sshConnections.length === 0 && (
              <p className="muted small palette-note">Saved SSH hosts also appear on the remote automatically under "Terminals".</p>
            )}
          </div>
        </div>

        <div className="phone-shell">
          <div className="phone-frame">
            <div className="phone-notch" />
            <div className="phone-screen">
              <div className="remote-header mini">
                <div className="remote-brand">
                  <Icon name="server" />
                  <div>
                    <h1>ServManager</h1>
                    <span className="mono muted">{stats.hostname}</span>
                  </div>
                </div>
                <span className="live-dot" />
              </div>
              <div className="remote-grid preview">
                {sorted.length === 0
                  ? <div className="empty-state"><Icon name="layout" /><p>Empty screen. Add widgets from the left.</p></div>
                  : sorted.map(w => (
                    <div key={w.id}
                      className={`design-tile size-${w.size}${dragOverId === w.id ? ' drag-over' : ''}`}
                      draggable
                      onDragStart={e => { dragItem.current = w.id; e.dataTransfer.effectAllowed = 'move'; }}
                      onDragOver={e => { e.preventDefault(); if (w.id !== dragItem.current) setDragOverId(w.id); }}
                      onDrop={e => onDrop(e, w.id)}
                      onDragEnd={() => { setDragOverId(null); dragItem.current = null; }}>
                      <RemoteWidget widget={w} stats={stats} scripts={scripts}
                        sshConnections={sshConnections} running={false}
                        onRun={() => {}} onSsh={() => {}} />
                      <button className="design-tile-hit" onClick={() => startEdit(w)}
                        aria-label={`Edit ${w.title}`}>
                        <span className="design-tile-edit"><Icon name="edit" /> Edit</span>
                      </button>
                    </div>
                  ))
                }
              </div>
              {sshConnections.length > 0 && (
                <div className="remote-ssh-strip preview-strip">
                  <span className="strip-label">Terminals</span>
                  <div className="ssh-chip-row">
                    {sshConnections.map(c => (
                      <span key={c.id} className="ssh-chip static"><Icon name="ssh" />{c.name}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <p className="muted small phone-hint">Live preview — metrics show this server's real numbers.</p>
        </div>
      </div>

      {editing && (
        <WidgetEditor draft={editing} setDraft={setEditing} scripts={scripts}
          sshConnections={sshConnections} stats={stats}
          onSave={commitEditor} onRemove={removeWidget} onClose={() => setEditing(null)} />
      )}

      {qr && (
        <Modal title="Open on your phone" onClose={() => setQr(null)}>
          <div className="qr-layout">
            <div className="qr-box"><QRCodeSVG value={qr} size={180} level="H" fgColor="#e6e0d6" bgColor="transparent" /></div>
            <div className="qr-info">
              <p className="muted">Scan with your phone's camera, then enter your PIN.</p>
              <div className="copy-row">
                <input type="text" readOnly value={qr} className="mono" />
                <button className="btn btn-ghost btn-icon" onClick={() => { navigator.clipboard.writeText(qr); addToast('URL copied', 'success'); }} title="Copy URL"><Icon name="copy" /></button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Widget editor modal (Remote Designer)
// ─────────────────────────────────────────────────────────
const TYPE_LABELS = {
  button: 'Script button',
  indicator: 'Health indicator',
  metric: 'Live metric',
  ssh: 'SSH terminal',
};

function WidgetEditor({ draft, setDraft, scripts, sshConnections, stats, onSave, onRemove, onClose }) {
  const set = (patch) => setDraft(d => ({ ...d, ...patch }));

  const preview = {
    ...draft,
    id: draft.id || 'preview',
    title: draft.title || 'Widget label',
    position: 0,
  };

  return (
    <Modal title={draft.id ? `Edit — ${TYPE_LABELS[draft.type]}` : `New — ${TYPE_LABELS[draft.type]}`} onClose={onClose} wide
      footer={
        <>
          {draft.id && (
            <button className="btn btn-ghost danger-text" style={{ marginRight: 'auto' }}
              onClick={() => onRemove(draft.id)}>
              <Icon name="trash" /> Remove widget
            </button>
          )}
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave(draft)}>
            <Icon name="check" /> {draft.id ? 'Apply changes' : 'Add to remote'}
          </button>
        </>
      }>
      <div className="widget-editor-layout">
        <div className="widget-editor-form">
          <div className="form-row">
            <div className="form-group flex-2">
              <label htmlFor="we-title">Label</label>
              <input id="we-title" type="text" value={draft.title} autoFocus
                onChange={e => set({ title: e.target.value })}
                placeholder={draft.type === 'ssh' ? 'e.g. Web server' : draft.type === 'metric' ? 'e.g. CPU' : 'e.g. Restart Nginx'} />
            </div>
            <div className="form-group flex-2">
              <label htmlFor="we-desc">Subtitle <span className="muted">(optional)</span></label>
              <input id="we-desc" type="text" value={draft.description}
                onChange={e => set({ description: e.target.value })} />
            </div>
          </div>

          {(draft.type === 'button' || draft.type === 'indicator') && (
            <div className="form-group">
              <label htmlFor="we-script">Script to {draft.type === 'button' ? 'run' : 'watch'}</label>
              <select id="we-script" value={draft.scriptId} onChange={e => set({ scriptId: e.target.value })}>
                <option value="">— Pick a script —</option>
                {scripts.map(s => <option key={s.id} value={s.id}>{s.name}{(s.interval || 0) > 0 ? ` (every ${s.interval}s)` : ''}</option>)}
              </select>
              {draft.type === 'indicator' && <small className="muted">The dot shows the script's last exit status — works best with scheduled scripts.</small>}
            </div>
          )}

          {draft.type === 'metric' && (
            <div className="form-group">
              <label>Metric</label>
              <div className="segmented">
                {[['cpu', 'CPU'], ['ram', 'RAM'], ['disk', 'Disk'], ['uptime', 'Uptime']].map(([v, l]) => (
                  <button key={v} type="button" className={draft.metricType === v ? 'on' : ''}
                    onClick={() => set({ metricType: v })}>{l}</button>
                ))}
              </div>
            </div>
          )}

          {draft.type === 'ssh' && (
            <div className="form-group">
              <label htmlFor="we-ssh">SSH host</label>
              <select id="we-ssh" value={draft.sshConnectionId} onChange={e => set({ sshConnectionId: e.target.value })}>
                <option value="">— Pick a host —</option>
                {sshConnections.map(c => <option key={c.id} value={c.id}>{c.name} ({c.username}@{c.host})</option>)}
              </select>
              {sshConnections.length === 0 && <small className="muted">No hosts saved yet — add one under SSH Hosts first.</small>}
            </div>
          )}

          <div className="form-group">
            <label>Size</label>
            <div className="segmented">
              {[['small', 'Small'], ['medium', 'Wide'], ['large', 'Large']].map(([v, l]) => (
                <button key={v} type="button" className={draft.size === v ? 'on' : ''}
                  onClick={() => set({ size: v })}>{l}</button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Color</label>
            <div className="swatch-row">
              {WIDGET_COLORS.map(c => (
                <button key={c} type="button" title={c}
                  className={`swatch accent-${c}${draft.color === c ? ' selected' : ''}`}
                  onClick={() => set({ color: c })} aria-label={`Color ${c}`} />
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Icon</label>
            <div className="icon-picker">
              {WIDGET_ICONS.map(([name, label]) => (
                <button key={name} type="button" title={label}
                  className={`icon-pick-btn ${draft.icon === name ? 'selected' : ''}`}
                  onClick={() => set({ icon: name })}>
                  <Icon name={name} />
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="widget-editor-preview">
          <span className="strip-label">Preview</span>
          <div className="remote-grid preview single">
            <RemoteWidget widget={preview} stats={stats} scripts={scripts}
              sshConnections={sshConnections} running={false} onRun={() => {}} onSsh={() => {}} />
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────
// View: SSH Hosts
// ─────────────────────────────────────────────────────────
function SshView({ connections, api, addToast, setConfirm, refresh, onOpenTerminal }) {
  const [editor, setEditor] = useState(null);

  const openEditor = (conn = null) => setEditor(conn
    ? { id: conn.id, name: conn.name, host: conn.host, port: conn.port || 22, username: conn.username, password: '' }
    : { id: '', name: '', host: '', port: 22, username: '', password: '' });

  const save = async (e) => {
    e.preventDefault();
    try {
      await api('/api/ssh/connections', 'POST', editor);
      setEditor(null);
      refresh();
      addToast('SSH host saved', 'success');
    } catch (err) {
      addToast(`Could not save: ${err.message}`, 'error');
    }
  };

  const remove = (conn) => setConfirm({
    title: 'Delete SSH host',
    message: `"${conn.name}" and its stored credentials will be removed.`,
    onConfirm: async () => {
      try {
        await api(`/api/ssh/connections/${conn.id}`, 'DELETE');
        refresh();
        addToast('SSH host deleted', 'info');
      } catch (err) {
        addToast(`Could not delete: ${err.message}`, 'error');
      }
    },
  });

  return (
    <div className="view-section">
      <div className="view-head">
        <div>
          <h1>SSH Hosts</h1>
          <p className="muted">Open a full terminal to any host — from this dashboard or your phone.</p>
        </div>
        <button className="btn btn-primary" onClick={() => openEditor()}><Icon name="plus" /> Add host</button>
      </div>

      <div className="cards-grid">
        {connections.length === 0
          ? <div className="empty-state card"><Icon name="ssh" /><p>No hosts yet. Add one to open browser terminals here and from the remote.</p><button className="btn btn-primary" onClick={() => openEditor()}><Icon name="plus" /> Add host</button></div>
          : connections.map(conn => (
            <div className="card script-card" key={conn.id}>
              <div className="script-head">
                <h3>{conn.name}</h3>
                <span className={`status-dot ${conn.hasPassword ? 'success' : 'inactive'}`} title={conn.hasPassword ? 'Password stored' : 'No password stored'} />
              </div>
              <p className="script-desc mono">{conn.username}@{conn.host}:{conn.port || 22}</p>
              <div className="script-foot">
                <span className="muted small">{conn.hasPassword ? 'Password stored' : 'No password stored'}</span>
                <div className="row-actions">
                  <button className="btn btn-ghost btn-icon" onClick={() => openEditor(conn)} title="Edit"><Icon name="edit" /></button>
                  <button className="btn btn-ghost btn-icon danger-text" onClick={() => remove(conn)} title="Delete"><Icon name="trash" /></button>
                  <button className="btn btn-primary btn-icon" onClick={() => onOpenTerminal(conn)} title="Open terminal"><Icon name="terminal" /></button>
                </div>
              </div>
            </div>
          ))
        }
      </div>

      {editor && (
        <Modal title={editor.id ? 'Edit SSH host' : 'Add SSH host'} onClose={() => setEditor(null)}>
          <form onSubmit={save} className="editor-form">
            <div className="form-group">
              <label htmlFor="ssh-name">Label</label>
              <input id="ssh-name" type="text" required value={editor.name}
                onChange={e => setEditor({ ...editor, name: e.target.value })} placeholder="e.g. Web server" />
            </div>
            <div className="form-row">
              <div className="form-group flex-2">
                <label htmlFor="ssh-host">Host or IP</label>
                <input id="ssh-host" type="text" required value={editor.host}
                  onChange={e => setEditor({ ...editor, host: e.target.value })} placeholder="192.168.1.100" />
              </div>
              <div className="form-group port-field">
                <label htmlFor="ssh-port">Port</label>
                <input id="ssh-port" type="number" value={editor.port}
                  onChange={e => setEditor({ ...editor, port: parseInt(e.target.value, 10) || 22 })} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group flex-1">
                <label htmlFor="ssh-user">Username</label>
                <input id="ssh-user" type="text" required value={editor.username}
                  onChange={e => setEditor({ ...editor, username: e.target.value })} placeholder="root" />
              </div>
              <div className="form-group flex-1">
                <label htmlFor="ssh-pass">Password</label>
                <input id="ssh-pass" type="password" value={editor.password}
                  onChange={e => setEditor({ ...editor, password: e.target.value })}
                  placeholder={editor.id ? 'Leave blank to keep current' : ''} />
              </div>
            </div>
            <p className="muted small">Credentials are stored on this server in <span className="mono">data.json</span>, readable only by root.</p>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setEditor(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary"><Icon name="save" /> Save host</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// View: History
// ─────────────────────────────────────────────────────────
function HistoryView({ history, api, addToast, setConfirm, refresh }) {
  const [viewLog, setViewLog] = useState(null);

  const clearAll = () => setConfirm({
    title: 'Clear history',
    message: 'All run logs will be deleted. This cannot be undone.',
    action: 'Clear all',
    onConfirm: async () => {
      try {
        await api('/api/history', 'DELETE');
        refresh();
        addToast('History cleared', 'info');
      } catch (err) {
        addToast(`Could not clear: ${err.message}`, 'error');
      }
    },
  });

  return (
    <div className="view-section">
      <div className="view-head">
        <div>
          <h1>Run History</h1>
          <p className="muted">The last 100 script runs with full logs.</p>
        </div>
        {history.length > 0 && <button className="btn btn-ghost danger-text" onClick={clearAll}><Icon name="trash" /> Clear all</button>}
      </div>

      <div className="card table-card">
        <div className="table-container">
          <table>
            <thead><tr><th>Script</th><th>Trigger</th><th>Started</th><th>Duration</th><th>Result</th><th className="text-right">Log</th></tr></thead>
            <tbody>
              {history.length === 0
                ? <tr><td colSpan="6" className="table-empty">No runs yet. Run a script and it will show up here.</td></tr>
                : history.map(h => {
                  const dur = h.endTime ? ((new Date(h.endTime) - new Date(h.startTime)) / 1000).toFixed(1) + 's' : '—';
                  const badge = h.status === 'success' ? 'badge-ok' : h.status === 'cancelled' ? 'badge-neutral' : 'badge-danger';
                  return (
                    <tr key={h.id}>
                      <td className="strong">{h.scriptName}</td>
                      <td><span className="badge badge-neutral">{h.trigger}</span></td>
                      <td className="muted">{new Date(h.startTime).toLocaleString()}</td>
                      <td className="mono muted">{dur}</td>
                      <td><span className={`badge ${badge}`}>{h.status}</span></td>
                      <td className="text-right">
                        <button className="btn btn-ghost btn-icon" onClick={() => setViewLog(h)} title="View log"><Icon name="eye" /></button>
                      </td>
                    </tr>
                  );
                })
              }
            </tbody>
          </table>
        </div>
      </div>

      {viewLog && (
        <Modal title={`Log — ${viewLog.scriptName}`} onClose={() => setViewLog(null)} wide>
          <div className="terminal-surface run-terminal">
            <LogLines lines={(viewLog.logs || '').split('\n')} bottomRef={{ current: null }} />
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// View: Settings
// ─────────────────────────────────────────────────────────
function SettingsView({ settings, setSettings, api, addToast }) {
  const submit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        port: parseInt(settings.port, 10),
        username: settings.username,
        remotePin: settings.remotePin,
      };
      if (settings.password?.trim()) payload.password = settings.password;
      const res = await api('/api/settings', 'POST', payload);
      setSettings(s => ({ ...s, password: '' }));
      addToast(res.message || 'Settings saved', 'success');
    } catch (err) {
      addToast(`Could not save: ${err.message}`, 'error');
    }
  };

  return (
    <div className="view-section">
      <div className="view-head">
        <div>
          <h1>Settings</h1>
          <p className="muted">Port, sign-in credentials, and the remote PIN.</p>
        </div>
      </div>

      <div className="settings-layout">
        <form className="card settings-box" onSubmit={submit}>
          <h3>Access</h3>
          <div className="form-group">
            <label htmlFor="set-port">Port</label>
            <input id="set-port" type="number" required min="1" max="65535" value={settings.port}
              onChange={e => setSettings({ ...settings, port: e.target.value })} />
            <small className="muted">Dashboard and remote share this port. Restart to apply: <span className="mono">sudo servmanager restart</span></small>
          </div>
          <div className="form-group">
            <label htmlFor="set-user">Admin username</label>
            <input id="set-user" type="text" value={settings.username}
              onChange={e => setSettings({ ...settings, username: e.target.value })} autoComplete="username" />
          </div>
          <div className="form-group">
            <label htmlFor="set-pass">Admin password</label>
            <input id="set-pass" type="password" value={settings.password}
              onChange={e => setSettings({ ...settings, password: e.target.value })}
              placeholder="Leave blank to keep current" autoComplete="new-password" />
          </div>
          <div className="form-group">
            <label htmlFor="set-pin">Remote PIN <span className="muted">(4 digits)</span></label>
            <input id="set-pin" type="text" inputMode="numeric" maxLength="4" pattern="[0-9]{4}" value={settings.remotePin}
              onChange={e => setSettings({ ...settings, remotePin: e.target.value.replace(/\D/g, '').slice(0, 4) })} />
            <small className="muted">Unlocks the mobile remote at <span className="mono">/remote</span>. The remote can run scripts but can't change anything.</small>
          </div>
          <button type="submit" className="btn btn-primary">Save settings</button>
        </form>

        <div className="card settings-box">
          <h3>Service</h3>
          <p className="muted">ServManager runs as a systemd service when installed with the installer.</p>
          <pre className="code-block mono">{`sudo servmanager status    # health
sudo servmanager restart   # apply port change
sudo servmanager logs      # live logs
sudo servmanager update    # upgrade to latest`}</pre>
          <p className="muted small" style={{ marginTop: '0.75rem' }}>
            SSH terminals need the <span className="mono">asyncssh</span> package — the installer sets this up automatically.
          </p>
        </div>
      </div>
    </div>
  );
}
