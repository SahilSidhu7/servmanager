import React, { useState, useEffect, useRef, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import '@xterm/xterm/css/xterm.css';

// ─────────────────────────────────────────────────────────
// SVG ICON REGISTRY
// ─────────────────────────────────────────────────────────
const SVG_REGISTRY = {
  cpu: <><path d="M4 4h16v16H4zM9 9h6v6H9zM9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 15h3M1 9h3M1 15h3"/></>,
  database: <><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/></>,
  terminal: <><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></>,
  refresh: <><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
  home: <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>,
  flow: <><path d="M12 2v20M17 5H7M12 12h8M4 12h8M12 19h5M7 19h5"/></>,
  layout: <><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="9" y1="9" x2="21" y2="9"/><line x1="9" y1="15" x2="21" y2="15"/></>,
  stats: <><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>,
  plus: <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
  trash: <><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></>,
  edit: <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>,
  play: <><polygon points="5 3 19 12 5 21 5 3"/></>,
  stop: <><rect x="4" y="4" width="16" height="16" rx="2" ry="2"/></>,
  check: <><polyline points="20 6 9 17 4 12"/></>,
  alert: <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>,
  close: <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
  'external-link': <><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></>,
  search: <><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>,
  code: <><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></>,
  eye: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>,
  save: <><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></>,
  server: <><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></>,
  'heart-rate': <><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></>,
  activity: <><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></>,
  key: <><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></>,
  copy: <><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></>,
  info: <><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></>,
  move: <><polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/><polyline points="15 19 12 22 9 19"/><polyline points="19 9 22 12 19 15"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>,
  ssh: <><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/><path d="M7 9l2 2-2 2M11 13h4"/></>,
  qrcode: <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="5" y="5" width="3" height="3"/><rect x="16" y="5" width="3" height="3"/><rect x="5" y="16" width="3" height="3"/><path d="M14 14h3v3h-3zM17 17h3v3h-3zM14 17h3"/></>,
  wifi: <><path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0"/><circle cx="12" cy="20" r="1"/></>,
  shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></>,
  upload: <><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></>,
};

function Icon({ name, className = 'icon-svg' }) {
  const inner = SVG_REGISTRY[name] || <circle cx="12" cy="12" r="8"/>;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={className}
      strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
      {inner}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────
// TOAST NOTIFICATION SYSTEM
// ─────────────────────────────────────────────────────────
function ToastContainer({ toasts, onRemove }) {
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <Icon name={t.type === 'success' ? 'check' : t.type === 'error' ? 'alert' : 'info'} />
          <span>{t.message}</span>
          <button className="toast-close" onClick={() => onRemove(t.id)}>&times;</button>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// CODE EDITOR WITH LINE NUMBERS
// ─────────────────────────────────────────────────────────
function CodeEditor({ value, onChange, placeholder, minHeight = '280px' }) {
  const textareaRef = useRef(null);
  const gutterRef = useRef(null);

  const lines = (value || '').split('\n');

  const syncScroll = () => {
    if (textareaRef.current && gutterRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  const handleKeyDown = (e) => {
    const ta = e.target;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;

    if (e.key === 'Tab') {
      e.preventDefault();
      const newVal = value.substring(0, start) + '  ' + value.substring(end);
      onChange(newVal);
      requestAnimationFrame(() => {
        ta.selectionStart = start + 2;
        ta.selectionEnd = start + 2;
      });
    } else if (e.key === 'Enter') {
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      const currentLine = value.substring(lineStart, start);
      const indent = currentLine.match(/^(\s*)/)[1];
      e.preventDefault();
      const newVal = value.substring(0, start) + '\n' + indent + value.substring(end);
      onChange(newVal);
      requestAnimationFrame(() => {
        const pos = start + 1 + indent.length;
        ta.selectionStart = pos;
        ta.selectionEnd = pos;
      });
    }
  };

  return (
    <div className="code-editor-wrap">
      <div className="code-editor-gutter" ref={gutterRef}>
        {lines.map((_, i) => (
          <div key={i} className="code-line-num">{i + 1}</div>
        ))}
      </div>
      <textarea
        ref={textareaRef}
        className="code-editor-area"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onScroll={syncScroll}
        placeholder={placeholder || '#!/bin/bash\n# Write your script here\necho "Hello, server!"\nexit 0'}
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        style={{ minHeight }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// SSH TERMINAL MODAL (xterm.js)
// ─────────────────────────────────────────────────────────
function SshTerminalModal({ conn, token, onClose }) {
  const containerRef = useRef(null);
  const cleanupRef = useRef(null);
  const [status, setStatus] = useState('connecting');

  useEffect(() => {
    if (!containerRef.current) return;

    let term, fitAddon, ws;

    const setup = async () => {
      const { Terminal } = await import('@xterm/xterm');
      const { FitAddon } = await import('@xterm/addon-fit');

      term = new Terminal({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: '"IBM Plex Mono", "Fira Code", monospace',
        theme: {
          background: '#0a0a0a',
          foreground: '#d4cfc8',
          cursor: '#c45c1a',
          selectionBackground: 'rgba(196, 92, 26, 0.3)',
          black: '#111111',
          brightBlack: '#2a2a2a',
        },
        convertEol: true,
        scrollback: 5000,
      });

      fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(containerRef.current);
      fitAddon.fit();

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.port === '5173' ? 'localhost:8080' : window.location.host;
      ws = new WebSocket(`${protocol}//${host}/ws/ssh/${conn.id}?token=${encodeURIComponent(token)}`);

      term.write(`\x1b[33mConnecting to ${conn.username}@${conn.host}:${conn.port || 22}...\x1b[0m\r\n`);

      ws.onopen = () => {
        setStatus('connected');
        term.write('\x1b[32mSession established.\x1b[0m\r\n\r\n');
        term.focus();
      };

      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === 'data') term.write(msg.data);
        else if (msg.type === 'error') {
          setStatus('error');
          term.write(`\r\n\x1b[31m${msg.data}\x1b[0m\r\n`);
        }
      };

      ws.onclose = () => {
        setStatus('closed');
        term.write('\r\n\x1b[33m[Connection closed]\x1b[0m\r\n');
      };

      ws.onerror = () => {
        setStatus('error');
        term.write('\r\n\x1b[31m[WebSocket error - check network]\x1b[0m\r\n');
      };

      term.onData(data => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'data', data }));
        }
      });

      const ro = new ResizeObserver(() => {
        try {
          fitAddon.fit();
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
          }
        } catch (_) {}
      });
      ro.observe(containerRef.current);

      cleanupRef.current = () => {
        ro.disconnect();
        ws.close();
        term.dispose();
      };
    };

    setup().catch(() => setStatus('error'));

    return () => { if (cleanupRef.current) cleanupRef.current(); };
  }, [conn.id, token]);

  const statusBadge = status === 'connected'
    ? 'badge-success' : status === 'error' || status === 'closed'
    ? 'badge-danger' : 'badge-warn';

  return (
    <div className="ssh-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ssh-terminal-card">
        <div className="ssh-terminal-header">
          <div className="ssh-terminal-info">
            <Icon name="ssh" />
            <span>{conn.name}</span>
            <span className="font-mono" style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              {conn.username}@{conn.host}:{conn.port || 22}
            </span>
            <span className={`badge ${statusBadge}`}>{status}</span>
          </div>
          <button className="btn btn-secondary btn-icon" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <div ref={containerRef} className="ssh-terminal-body" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState('stats');
  const [authToken, setAuthToken] = useState(localStorage.getItem('servmanager_token') || '');
  const [showAuthModal, setShowAuthModal] = useState(!localStorage.getItem('servmanager_token'));
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');

  const [pinValue, setPinValue] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinShake, setPinShake] = useState(false);
  const [showRemotePin, setShowRemotePin] = useState(false);

  const [stats, setStats] = useState({ cpu: 0, ram: { total: 0, used: 0, pct: 0 }, disk: { total: '0G', used: '0G', pct: 0 }, uptime: 0, hostname: 'loading...', platform: '' });
  const [ports, setPorts] = useState([]);
  const [scripts, setScripts] = useState([]);
  const [remoteWidgets, setRemoteWidgets] = useState([]);
  const [history, setHistory] = useState([]);
  const [settings, setSettings] = useState({ port: 8080, secretToken: '', username: 'admin', password: '', remotePin: '' });
  const [sshConnections, setSshConnections] = useState([]);

  const [terminalOpen, setTerminalOpen] = useState(false);
  const [terminalTitle, setTerminalTitle] = useState('');
  const [terminalLogs, setTerminalLogs] = useState([]);
  const [terminalStatus, setTerminalStatus] = useState('Running');
  const [terminalExitCode, setTerminalExitCode] = useState(0);
  const [currentRunId, setCurrentRunId] = useState(null);

  const [remoteDrawerOpen, setRemoteDrawerOpen] = useState(false);
  const [remoteDrawerTitle, setRemoteDrawerTitle] = useState('');

  const [showQR, setShowQR] = useState(false);
  const [remoteUrl, setRemoteUrl] = useState('');
  const [sshTerminalConn, setSshTerminalConn] = useState(null);

  const [toasts, setToasts] = useState([]);

  const socketRef = useRef(null);
  const terminalBottomRef = useRef(null);
  const dragItem = useRef(null);
  const [dragOverId, setDragOverId] = useState(null);

  const isRemoteRoute = window.location.pathname.startsWith('/remote');

  // ── Toast helpers ──────────────────────────────────────
  const addToast = useCallback((message, type = 'info', duration = 3500) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  }, []);

  const removeToast = useCallback(id => setToasts(prev => prev.filter(t => t.id !== id)), []);

  // ── Token query-param on mount ─────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      setAuthToken(token);
      localStorage.setItem('servmanager_token', token);
      setShowAuthModal(false);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // ── API helper ─────────────────────────────────────────
  const apiCall = useCallback(async (endpoint, method = 'GET', body = null) => {
    const token = localStorage.getItem('servmanager_token') || authToken;
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);
    try {
      const host = window.location.port === '5173' ? 'http://localhost:8080' : '';
      const res = await fetch(`${host}${endpoint}`, options);
      if (res.status === 401) {
        if (isRemoteRoute) setShowRemotePin(true); else setShowAuthModal(true);
        throw new Error('Unauthorized');
      }
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Request failed');
      }
      return await res.json();
    } catch (e) {
      throw e;
    }
  }, [authToken, isRemoteRoute]);

  // ── WebSocket ──────────────────────────────────────────
  useEffect(() => {
    if (!authToken) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.port === '5173' ? 'localhost:8080' : window.location.host;

    const connect = () => {
      const ws = new WebSocket(`${protocol}//${host}/ws`);
      socketRef.current = ws;
      ws.onopen = () => ws.send(JSON.stringify({ type: 'subscribe-stats' }));
      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'stats') setStats(msg.data);
        else if (msg.type === 'log') setTerminalLogs(prev => [...prev, msg.text]);
        else if (msg.type === 'script-finished') {
          setTerminalStatus(msg.status === 'success' ? 'Finished' : msg.status === 'cancelled' ? 'Cancelled' : 'Failed');
          setTerminalExitCode(msg.exitCode);
          setScripts(prev => prev.map(s => s.id === msg.scriptId ? { ...s, lastStatus: msg.status } : s));
          fetchScripts();
        } else if (msg.type === 'indicator-update') {
          setScripts(prev => prev.map(s => s.id === msg.scriptId ? { ...s, lastStatus: msg.lastStatus, lastOutput: msg.lastOutput } : s));
        } else if (msg.type === 'remote-reload') {
          fetchRemoteConfig();
        }
      };
      ws.onclose = () => setTimeout(connect, 3000);
    };

    connect();
    return () => { if (socketRef.current) socketRef.current.close(); };
  }, [authToken]);

  useEffect(() => {
    if (isRemoteRoute && !authToken) setShowRemotePin(true);
  }, []);

  useEffect(() => {
    if (!authToken) return;
    if (isRemoteRoute) {
      fetchRemoteConfig();
      fetchScripts();
      fetchSshConnections();
    } else {
      loadViewData(view);
    }
  }, [authToken, view]);

  useEffect(() => {
    if (terminalBottomRef.current) {
      terminalBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [terminalLogs, terminalOpen, remoteDrawerOpen]);

  // ── Data fetchers ──────────────────────────────────────
  const fetchPorts = async () => { try { setPorts(await apiCall('/api/system/ports')); } catch (_) {} };
  const fetchScripts = async () => { try { setScripts(await apiCall('/api/scripts')); } catch (_) {} };
  const fetchRemoteConfig = async () => { try { const d = await apiCall('/api/remote/config'); setRemoteWidgets(d.widgets || []); } catch (_) {} };
  const fetchHistory = async () => { try { setHistory(await apiCall('/api/history')); } catch (_) {} };
  const fetchSettings = async () => { try { setSettings(await apiCall('/api/settings')); } catch (_) {} };
  const fetchSshConnections = async () => { try { setSshConnections(await apiCall('/api/ssh/connections')); } catch (_) {} };

  const loadViewData = (v) => {
    if (v === 'stats') fetchPorts();
    else if (v === 'scripts' || v === 'workflows') fetchScripts();
    else if (v === 'remote-designer') { fetchRemoteConfig(); fetchScripts(); fetchSshConnections(); }
    else if (v === 'history') fetchHistory();
    else if (v === 'settings') fetchSettings();
    else if (v === 'ssh-connections') fetchSshConnections();
  };

  const formatUptime = (s) => {
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
    return `${d > 0 ? d + 'd ' : ''}${h}h ${m}m`;
  };

  // ── Script execution ───────────────────────────────────
  const runScript = async (script, trigger = 'manual') => {
    if (!script) return;
    setTerminalTitle(`Executing: ${script.name}`);
    setTerminalLogs(['Connecting to server process...']);
    setTerminalStatus('Spawning');
    setTerminalOpen(true);
    setRemoteDrawerOpen(true);
    setRemoteDrawerTitle(script.name);
    try {
      const res = await apiCall('/api/scripts/run', 'POST', { id: script.id, trigger });
      setCurrentRunId(res.runId);
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: 'subscribe-log', runId: res.runId }));
      }
      setTerminalStatus('Running');
    } catch (err) {
      setTerminalLogs(prev => [...prev, `[system-err] Failed to start: ${err.message}`]);
      setTerminalStatus('Failed');
    }
  };

  const cancelExecution = async () => {
    if (currentRunId) await apiCall('/api/scripts/cancel', 'POST', { runId: currentRunId });
  };

  // ── Auth handlers ──────────────────────────────────────
  const handleAuthenticate = async () => {
    if (!authUsername.trim() || !authPassword.trim()) { setAuthError('Enter username and password.'); return; }
    setAuthError('');
    try {
      const host = window.location.port === '5173' ? 'http://localhost:8080' : '';
      const res = await fetch(`${host}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: authUsername, password: authPassword }) });
      if (!res.ok) { const e = await res.json(); setAuthError(e.detail || 'Login failed.'); return; }
      const data = await res.json();
      setAuthToken(data.token);
      localStorage.setItem('servmanager_token', data.token);
      setShowAuthModal(false);
    } catch (_) { setAuthError('Network error. Is ServManager running?'); }
  };

  const handlePinKey = async (digit) => {
    if (pinShake) return;
    const next = pinValue + digit;
    setPinValue(next);
    setPinError('');
    if (next.length === 4) {
      try {
        const host = window.location.port === '5173' ? 'http://localhost:8080' : '';
        const res = await fetch(`${host}/api/remote/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: next }) });
        if (!res.ok) {
          const e = await res.json();
          setPinError(e.detail || 'Incorrect PIN.');
          setPinShake(true);
          setTimeout(() => { setPinValue(''); setPinShake(false); }, 600);
          return;
        }
        const data = await res.json();
        setAuthToken(data.token);
        localStorage.setItem('servmanager_token', data.token);
        setShowRemotePin(false);
      } catch (_) { setPinError('Network error.'); setTimeout(() => setPinValue(''), 600); }
    }
  };

  const handleLogout = () => {
    setAuthToken('');
    localStorage.removeItem('servmanager_token');
    if (isRemoteRoute) setShowRemotePin(true); else setShowAuthModal(true);
  };

  // ────────────────────────────────────────────────────────
  // VIEW 1: SYSTEM STATS
  // ────────────────────────────────────────────────────────
  const renderStatsView = () => {
    const offset = (pct) => 251.2 - (pct / 100) * 251.2;
    return (
      <div className="view-section">
        <div className="section-header">
          <h1 className="text-gradient">System Diagnostics</h1>
          <p>Real-time system resources and active network listening ports.</p>
        </div>
        <div className="stats-grid">
          {[
            { label: 'CPU Usage', pct: stats.cpu, cls: 'gauge-cpu', icon: 'cpu', iconCls: 'text-indigo', sub: 'Average Core Load' },
            { label: 'RAM Memory', pct: stats.ram.pct, cls: 'gauge-ram', icon: 'database', iconCls: 'text-violet', sub: `${Math.round(stats.ram.used)} MB / ${Math.round(stats.ram.total)} MB` },
            { label: 'Disk Storage', pct: stats.disk.pct, cls: 'gauge-disk', icon: 'server', iconCls: 'text-emerald', sub: `Used: ${stats.disk.used} / ${stats.disk.total}` },
          ].map(({ label, pct, cls, icon, iconCls, sub }) => (
            <div className="glass-card stats-card" key={label}>
              <div className="card-title">
                <h3>{label}</h3>
                <Icon name={icon} className={`icon-svg ${iconCls}`} />
              </div>
              <div className="gauge-container">
                <svg viewBox="0 0 100 100" className="gauge-svg">
                  <circle className="gauge-bg" cx="50" cy="50" r="40"/>
                  <circle className={`gauge-value ${cls}`} cx="50" cy="50" r="40" strokeDasharray="251.2" strokeDashoffset={offset(pct)}/>
                </svg>
                <div className="gauge-value-text">{Math.round(pct)}%</div>
              </div>
              <div className="card-details text-center"><span>{sub}</span></div>
            </div>
          ))}
        </div>

        <div className="stats-info-row">
          <div className="glass-card info-chip">
            <Icon name="server" /><span>{stats.hostname}</span>
          </div>
          <div className="glass-card info-chip">
            <Icon name="activity" /><span>Uptime: {formatUptime(stats.uptime)}</span>
          </div>
          <div className="glass-card info-chip">
            <Icon name="info" /><span>{stats.platform || 'Unknown OS'}</span>
          </div>
        </div>

        <div className="glass-card ports-card margin-top-lg">
          <div className="card-title-bar">
            <h3>Active Listening Ports</h3>
            <span className="badge badge-info">{ports.length} Ports Active</span>
          </div>
          <div className="table-container">
            <table className="ports-table">
              <thead><tr><th>Protocol</th><th>Port</th><th>IP Address</th><th>State</th></tr></thead>
              <tbody>
                {ports.length === 0
                  ? <tr><td colSpan="4" className="text-center text-muted">Scanning active networks...</td></tr>
                  : ports.map((p, i) => (
                    <tr key={i}>
                      <td><span className={`badge ${p.proto === 'TCP' ? 'badge-info' : 'badge-warn'}`}>{p.proto}</span></td>
                      <td className="font-mono text-gradient" style={{ fontWeight: 600 }}>{p.port}</td>
                      <td className="font-mono">{p.address}</td>
                      <td><span className="badge badge-success">{p.state}</span></td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // ────────────────────────────────────────────────────────
  // VIEW 2: SCRIPTS MANAGER
  // ────────────────────────────────────────────────────────
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorForm, setEditorForm] = useState({ id: '', name: '', description: '', isButton: true, isIndicator: false, interval: 30, content: '' });

  const openScriptEditor = (s = null) => {
    if (s) {
      setEditorForm({ id: s.id, name: s.name, description: s.description || '', isButton: s.isButton, isIndicator: s.isIndicator, interval: s.interval || 30, content: s.content || '' });
    } else {
      setEditorForm({ id: '', name: '', description: '', isButton: true, isIndicator: false, interval: 30, content: '#!/bin/bash\n# Write your script here\necho "Script started"\n\nexit 0' });
    }
    setEditorOpen(true);
  };

  const deleteScript = async (id, name) => {
    if (!confirm(`Delete script "${name}"?`)) return;
    await apiCall(`/api/scripts/${id}`, 'DELETE');
    fetchScripts();
    addToast(`Script "${name}" deleted`, 'info');
  };

  const handleScriptSubmit = async (e) => {
    e.preventDefault();
    try {
      await apiCall('/api/scripts', 'POST', { ...editorForm, id: editorForm.id || null, type: 'shell', interval: parseInt(editorForm.interval) || 30 });
      setEditorOpen(false);
      fetchScripts();
      addToast('Script saved successfully', 'success');
    } catch (err) {
      addToast('Failed to save script: ' + err.message, 'error');
    }
  };

  const renderScriptsView = () => {
    const shellScripts = scripts.filter(s => s.type === 'shell');
    return (
      <div className="view-section">
        <div className="section-header-row">
          <div>
            <h1 className="text-gradient">Scripts Manager</h1>
            <p>Write, manage and execute custom shell scripts on your server.</p>
          </div>
          <button className="btn btn-primary" onClick={() => openScriptEditor()}>
            <Icon name="plus" /> New Script
          </button>
        </div>
        <div className="scripts-grid">
          {shellScripts.length === 0
            ? <div className="glass-card text-center text-muted" style={{ gridColumn: '1/-1', padding: '3rem' }}>No scripts yet. Click "New Script" to create one.</div>
            : shellScripts.map(s => {
              const sc = s.lastStatus === 'success' ? 'success' : s.lastStatus === 'failure' ? 'danger' : 'inactive';
              return (
                <div className="glass-card script-card" key={s.id}>
                  <div className="script-header">
                    <div>
                      <h3>{s.name}</h3>
                      <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.3rem' }}>
                        <span className="badge badge-muted" style={{ fontSize: '0.6rem' }}>SHELL</span>
                        {s.isIndicator && <span className="badge badge-info" style={{ fontSize: '0.6rem' }}>INDICATOR</span>}
                        {s.isButton && <span className="badge badge-warn" style={{ fontSize: '0.6rem' }}>BUTTON</span>}
                      </div>
                    </div>
                    <div className="meta-status">
                      <span className={`status-dot ${sc}`}></span>
                      <span style={{ fontSize: '0.8rem' }}>{s.lastStatus ? s.lastStatus.toUpperCase() : 'NOT RUN'}</span>
                    </div>
                  </div>
                  <p className="script-desc">{s.description || 'No description provided.'}</p>
                  {s.lastOutput && <pre className="script-last-output">{s.lastOutput.slice(0, 120)}{s.lastOutput.length > 120 ? '...' : ''}</pre>}
                  <div className="script-meta">
                    <span className="text-muted" style={{ fontSize: '0.78rem' }}>
                      {s.isIndicator ? `Polls every ${s.interval}s` : 'Manual trigger'} · {s.lastRun ? new Date(s.lastRun).toLocaleTimeString() : 'Never run'}
                    </span>
                    <div className="script-actions">
                      <button className="btn btn-secondary btn-icon" onClick={() => openScriptEditor(s)} title="Edit"><Icon name="edit" /></button>
                      <button className="btn btn-secondary btn-icon text-danger" onClick={() => deleteScript(s.id, s.name)} title="Delete"><Icon name="trash" /></button>
                      <button className="btn btn-primary btn-icon" onClick={() => runScript(s)} title="Run"><Icon name="play" /></button>
                    </div>
                  </div>
                </div>
              );
            })
          }
        </div>

        {editorOpen && (
          <div className="glass-card editor-card margin-top-lg">
            <div className="card-title-bar">
              <h3>{editorForm.id ? 'Edit Script' : 'Create Script'}</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setEditorOpen(false)}><Icon name="close" /></button>
            </div>
            <form onSubmit={handleScriptSubmit} className="editor-form">
              <div className="form-row">
                <div className="form-group flex-2">
                  <label>Script Title</label>
                  <input type="text" required value={editorForm.name} onChange={e => setEditorForm({ ...editorForm, name: e.target.value })} placeholder="e.g. Purge System Temp Caches" />
                </div>
                <div className="form-group flex-1">
                  <label>Remote Options</label>
                  <div className="checkbox-row">
                    <label className="checkbox-label"><input type="checkbox" checked={editorForm.isButton} onChange={e => setEditorForm({ ...editorForm, isButton: e.target.checked })} /> Button</label>
                    <label className="checkbox-label"><input type="checkbox" checked={editorForm.isIndicator} onChange={e => setEditorForm({ ...editorForm, isIndicator: e.target.checked })} /> Indicator</label>
                  </div>
                </div>
              </div>
              <div className="form-group">
                <label>Description</label>
                <input type="text" value={editorForm.description} onChange={e => setEditorForm({ ...editorForm, description: e.target.value })} placeholder="What does this script do?" />
              </div>
              {editorForm.isIndicator && (
                <div className="form-group" style={{ maxWidth: '200px' }}>
                  <label>Poll Interval (seconds)</label>
                  <input type="number" min="5" value={editorForm.interval} onChange={e => setEditorForm({ ...editorForm, interval: e.target.value })} />
                </div>
              )}
              <div className="form-group">
                <div className="editor-label-bar">
                  <label>Shell Script</label>
                  <span className="badge badge-muted">bash · sh · batch</span>
                </div>
                <CodeEditor value={editorForm.content} onChange={v => setEditorForm({ ...editorForm, content: v })} minHeight="320px" />
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setEditorOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary"><Icon name="save" /> Save Script</button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  };

  // ────────────────────────────────────────────────────────
  // VIEW 3: WORKFLOWS DESIGNER
  // ────────────────────────────────────────────────────────
  const [designerOpen, setDesignerOpen] = useState(false);
  const [wfForm, setWfForm] = useState({ id: '', name: '', description: '', isButton: true, isIndicator: false, interval: 30, steps: [] });

  const openWorkflowDesigner = (wf = null) => {
    if (wf) {
      setWfForm({ id: wf.id, name: wf.name, description: wf.description || '', isButton: wf.isButton, isIndicator: wf.isIndicator, interval: wf.interval || 30, steps: wf.workflow?.steps || [] });
    } else {
      setWfForm({ id: '', name: '', description: '', isButton: true, isIndicator: false, interval: 30, steps: [] });
    }
    setDesignerOpen(true);
  };

  const addWorkflowStep = (type) => {
    const id = 'step_' + Date.now();
    const defaults = {
      command: { name: 'Run Command', config: { command: '#!/bin/bash\necho "Hello"' } },
      check_port: { name: 'Check Port', config: { port: '80' } },
      http_request: { name: 'HTTP Request', config: { url: 'http://localhost:8080/api/system/stats', method: 'GET', body: '' } },
      conditional: { name: 'Condition Branch', config: { matchType: 'exitcode', value: '0', nextStepId: '', elseStepId: '' } },
      delay: { name: 'Delay', config: { seconds: '2' } },
      log: { name: 'Log Message', config: { message: 'Checkpoint reached.' } },
    };
    const d = defaults[type] || { name: type, config: {} };
    setWfForm(prev => ({ ...prev, steps: [...prev.steps, { id, type, ...d }] }));
  };

  const updateStepField = (idx, field, val) => {
    setWfForm(prev => {
      const steps = [...prev.steps];
      steps[idx] = { ...steps[idx], [field]: val };
      return { ...prev, steps };
    });
  };

  const updateStepConfig = (idx, key, val) => {
    setWfForm(prev => {
      const steps = [...prev.steps];
      steps[idx] = { ...steps[idx], config: { ...steps[idx].config, [key]: val } };
      return { ...prev, steps };
    });
  };

  const removeWorkflowStep = (idx) => setWfForm(prev => ({ ...prev, steps: prev.steps.filter((_, i) => i !== idx) }));

  const moveWorkflowStep = (idx, dir) => {
    setWfForm(prev => {
      const s = [...prev.steps];
      if (dir === 'up' && idx > 0) [s[idx], s[idx - 1]] = [s[idx - 1], s[idx]];
      else if (dir === 'down' && idx < s.length - 1) [s[idx], s[idx + 1]] = [s[idx + 1], s[idx]];
      return { ...prev, steps: s };
    });
  };

  const handleWorkflowSubmit = async () => {
    if (!wfForm.name) { addToast('Workflow name required', 'error'); return; }
    try {
      await apiCall('/api/scripts', 'POST', {
        id: wfForm.id || null, name: wfForm.name, description: wfForm.description,
        type: 'workflow', isButton: wfForm.isButton, isIndicator: wfForm.isIndicator,
        interval: parseInt(wfForm.interval) || 30, workflow: { steps: wfForm.steps }
      });
      setDesignerOpen(false);
      fetchScripts();
      addToast('Workflow saved', 'success');
    } catch (err) {
      addToast('Save failed: ' + err.message, 'error');
    }
  };

  const renderWorkflowsView = () => {
    const workflows = scripts.filter(s => s.type === 'workflow');
    return (
      <div className="view-section">
        <div className="section-header-row">
          <div>
            <h1 className="text-gradient">Workflows Manager</h1>
            <p>Chain commands, HTTP hooks, port checks, and conditional logic.</p>
          </div>
          <button className="btn btn-primary" onClick={() => openWorkflowDesigner()}>
            <Icon name="plus" /> Create Workflow
          </button>
        </div>
        <div className="scripts-grid">
          {workflows.length === 0
            ? <div className="glass-card text-center text-muted" style={{ gridColumn: '1/-1', padding: '3rem' }}>No workflows. Click "Create Workflow" to build one.</div>
            : workflows.map(w => {
              const sc = w.lastStatus === 'success' ? 'success' : w.lastStatus === 'failure' ? 'danger' : 'inactive';
              return (
                <div className="glass-card script-card" key={w.id}>
                  <div className="script-header">
                    <div>
                      <h3>{w.name}</h3>
                      <span className="badge badge-muted" style={{ fontSize: '0.6rem', marginTop: '0.3rem' }}>WORKFLOW · {w.workflow?.steps?.length || 0} STEPS</span>
                    </div>
                    <div className="meta-status">
                      <span className={`status-dot ${sc}`}></span>
                      <span style={{ fontSize: '0.8rem' }}>{w.lastStatus ? w.lastStatus.toUpperCase() : 'NOT RUN'}</span>
                    </div>
                  </div>
                  <p className="script-desc">{w.description || 'No description.'}</p>
                  {w.workflow?.steps?.length > 0 && (
                    <div className="workflow-step-preview">
                      {w.workflow.steps.slice(0, 4).map((step, i) => (
                        <span key={step.id} className="step-pill">
                          <span className="step-num">{i + 1}</span>{step.name}
                        </span>
                      ))}
                      {w.workflow.steps.length > 4 && <span className="step-pill step-more">+{w.workflow.steps.length - 4}</span>}
                    </div>
                  )}
                  <div className="script-meta">
                    <span className="text-muted" style={{ fontSize: '0.78rem' }}>{w.lastRun ? new Date(w.lastRun).toLocaleTimeString() : 'Never run'}</span>
                    <div className="script-actions">
                      <button className="btn btn-secondary btn-icon" onClick={() => openWorkflowDesigner(w)} title="Edit"><Icon name="edit" /></button>
                      <button className="btn btn-secondary btn-icon text-danger" onClick={() => deleteScript(w.id, w.name)} title="Delete"><Icon name="trash" /></button>
                      <button className="btn btn-primary btn-icon" onClick={() => runScript(w)} title="Run"><Icon name="play" /></button>
                    </div>
                  </div>
                </div>
              );
            })
          }
        </div>

        {designerOpen && (
          <div className="workflow-designer-wrap margin-top-lg">
            <div className="glass-card workflow-designer-card">
              <div className="card-title-bar">
                <h3>{wfForm.id ? 'Edit Workflow' : 'New Workflow'}</h3>
                <button className="btn btn-secondary btn-icon" onClick={() => setDesignerOpen(false)}><Icon name="close" /></button>
              </div>
              <div className="editor-form-meta">
                <div className="form-row">
                  <div className="form-group flex-2">
                    <label>Workflow Name</label>
                    <input type="text" value={wfForm.name} onChange={e => setWfForm({ ...wfForm, name: e.target.value })} placeholder="e.g. Deploy Nginx Stack" />
                  </div>
                  <div className="form-group flex-1">
                    <label>Options</label>
                    <div className="checkbox-row double-spacing">
                      <label className="checkbox-label"><input type="checkbox" checked={wfForm.isButton} onChange={e => setWfForm({ ...wfForm, isButton: e.target.checked })} /> Remote Button</label>
                      <label className="checkbox-label"><input type="checkbox" checked={wfForm.isIndicator} onChange={e => setWfForm({ ...wfForm, isIndicator: e.target.checked })} /> Health Indicator</label>
                    </div>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group flex-2">
                    <label>Description</label>
                    <input type="text" value={wfForm.description} onChange={e => setWfForm({ ...wfForm, description: e.target.value })} placeholder="Describe what this workflow does..." />
                  </div>
                  {wfForm.isIndicator && (
                    <div className="form-group flex-1">
                      <label>Poll Interval (s)</label>
                      <input type="number" min="5" value={wfForm.interval} onChange={e => setWfForm({ ...wfForm, interval: e.target.value })} />
                    </div>
                  )}
                </div>
              </div>

              <div className="designer-workspace">
                <div className="blocks-library">
                  <h4>Step Blocks</h4>
                  <p className="library-subtitle">Click to add to workflow:</p>
                  <div className="library-blocks-list">
                    {[
                      ['command', 'terminal', 'Run Command'],
                      ['check_port', 'stats', 'Check Port'],
                      ['http_request', 'external-link', 'HTTP Request'],
                      ['conditional', 'flow', 'Condition'],
                      ['delay', 'refresh', 'Delay'],
                      ['log', 'info', 'Log Message'],
                    ].map(([type, icon, label]) => (
                      <button key={type} className="btn btn-secondary lib-block-btn" onClick={() => addWorkflowStep(type)}>
                        <Icon name={icon} /> {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="canvas-panel">
                  <div className="canvas-header">
                    <h4>Execution Sequence</h4>
                    <span className="badge badge-muted">{wfForm.steps.length} Steps</span>
                  </div>
                  <div className="canvas-steps">
                    {wfForm.steps.length === 0
                      ? <div className="canvas-placeholder"><Icon name="flow" /><p>Add steps from the left panel.</p></div>
                      : wfForm.steps.map((step, idx) => {
                        let cfg = null;
                        if (step.type === 'command') {
                          cfg = (
                            <div className="step-input-group">
                              <label>Shell Command / Script</label>
                              <CodeEditor value={step.config.command || ''} onChange={v => updateStepConfig(idx, 'command', v)} minHeight="120px" placeholder="#!/bin/bash&#10;echo hello" />
                            </div>
                          );
                        } else if (step.type === 'check_port') {
                          cfg = <div className="step-input-group"><label>TCP Port</label><input type="number" value={step.config.port || ''} onChange={e => updateStepConfig(idx, 'port', e.target.value)} /></div>;
                        } else if (step.type === 'http_request') {
                          cfg = <>
                            <div className="step-input-group flex-2"><label>URL</label><input type="text" value={step.config.url || ''} onChange={e => updateStepConfig(idx, 'url', e.target.value)} /></div>
                            <div className="step-input-group flex-1"><label>Method</label><select value={step.config.method || 'GET'} onChange={e => updateStepConfig(idx, 'method', e.target.value)}><option>GET</option><option>POST</option><option>PUT</option><option>DELETE</option></select></div>
                            <div className="step-input-group"><label>Body (optional JSON)</label><textarea rows={2} value={step.config.body || ''} onChange={e => updateStepConfig(idx, 'body', e.target.value)} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }} /></div>
                          </>;
                        } else if (step.type === 'delay') {
                          cfg = <div className="step-input-group"><label>Seconds</label><input type="number" min="0.1" step="0.1" value={step.config.seconds || '1'} onChange={e => updateStepConfig(idx, 'seconds', e.target.value)} /></div>;
                        } else if (step.type === 'log') {
                          cfg = <div className="step-input-group"><label>Message</label><input type="text" value={step.config.message || ''} onChange={e => updateStepConfig(idx, 'message', e.target.value)} /></div>;
                        } else if (step.type === 'conditional') {
                          const others = wfForm.steps.filter((_, i) => i !== idx);
                          cfg = <>
                            <div className="step-input-group"><label>Compare</label><select value={step.config.matchType || 'exitcode'} onChange={e => updateStepConfig(idx, 'matchType', e.target.value)}><option value="exitcode">Last Exit Code</option><option value="contains">Output Contains</option><option value="equals">Output Equals</option></select></div>
                            <div className="step-input-group"><label>Value</label><input type="text" value={step.config.value || ''} onChange={e => updateStepConfig(idx, 'value', e.target.value)} /></div>
                            <div className="step-input-group"><label>If True → Jump To</label><select value={step.config.nextStepId || ''} onChange={e => updateStepConfig(idx, 'nextStepId', e.target.value)}><option value="">— Continue —</option>{others.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                            <div className="step-input-group"><label>Else → Jump To</label><select value={step.config.elseStepId || ''} onChange={e => updateStepConfig(idx, 'elseStepId', e.target.value)}><option value="">— Continue —</option>{others.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                          </>;
                        }
                        return (
                          <div className="workflow-step-block" key={step.id}>
                            <div className="step-block-header">
                              <div className="step-block-title">
                                <span className="badge badge-info">{idx + 1}</span>
                                <input className="step-name-input" value={step.name} onChange={e => updateStepField(idx, 'name', e.target.value)} />
                                <small className="text-muted">({step.type})</small>
                              </div>
                              <div className="script-actions">
                                <button className="btn btn-secondary btn-icon sm" onClick={() => moveWorkflowStep(idx, 'up')}>↑</button>
                                <button className="btn btn-secondary btn-icon sm" onClick={() => moveWorkflowStep(idx, 'down')}>↓</button>
                                <button className="btn btn-secondary btn-icon sm text-danger" onClick={() => removeWorkflowStep(idx)}><Icon name="close" /></button>
                              </div>
                            </div>
                            <div className="step-block-config">{cfg}</div>
                          </div>
                        );
                      })
                    }
                  </div>
                </div>
              </div>

              <div className="form-actions border-top">
                <button className="btn btn-secondary" onClick={() => setDesignerOpen(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleWorkflowSubmit}><Icon name="save" /> Save Workflow</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ────────────────────────────────────────────────────────
  // VIEW 4: REMOTE DESIGNER
  // ────────────────────────────────────────────────────────
  const [widgetForm, setWidgetForm] = useState({
    title: '', description: '', type: 'button', scriptId: '', sshConnectionId: '',
    metricType: 'cpu', size: 'small', color: 'indigo', icon: 'terminal'
  });

  const COLORS = ['indigo', 'violet', 'emerald', 'amber', 'rose', 'cyan', 'orange'];
  const ICONS = [
    ['terminal', 'Terminal'], ['activity', 'Activity'], ['cpu', 'CPU'], ['database', 'Database'],
    ['server', 'Server'], ['heart-rate', 'ECG'], ['refresh', 'Sync'], ['shield', 'Shield'],
    ['wifi', 'Network'], ['ssh', 'SSH'], ['key', 'Key'], ['stats', 'Stats'],
  ];

  const handleWidgetAdd = (e) => {
    e.preventDefault();
    const newWidget = {
      id: 'widget_' + Date.now(),
      title: widgetForm.title,
      description: widgetForm.description,
      type: widgetForm.type,
      scriptId: (widgetForm.type === 'button' || widgetForm.type === 'indicator') ? (widgetForm.scriptId || '') : null,
      sshConnectionId: widgetForm.type === 'ssh' ? widgetForm.sshConnectionId : null,
      metricType: widgetForm.type === 'metric' ? widgetForm.metricType : null,
      size: widgetForm.size,
      color: widgetForm.color,
      icon: widgetForm.icon,
      position: remoteWidgets.length,
    };
    setRemoteWidgets(prev => [...prev, newWidget]);
    setWidgetForm({ ...widgetForm, title: '', description: '' });
  };

  const removeWidgetFromGrid = (id) => setRemoteWidgets(prev => prev.filter(w => w.id !== id).map((w, i) => ({ ...w, position: i })));

  const saveRemoteLayout = async () => {
    try {
      await apiCall('/api/remote/config', 'POST', { widgets: remoteWidgets });
      const info = await apiCall('/api/system/info');
      setRemoteUrl(info.remoteUrl || `${window.location.origin}/remote`);
      setShowQR(true);
      addToast('Remote layout saved!', 'success');
    } catch (e) {
      addToast('Save failed: ' + e.message, 'error');
    }
  };

  const handleDragStart = (e, id) => { dragItem.current = id; e.dataTransfer.effectAllowed = 'move'; };
  const handleDragOver = (e, id) => { e.preventDefault(); if (id !== dragItem.current) setDragOverId(id); };
  const handleDrop = (e, targetId) => {
    e.preventDefault(); setDragOverId(null);
    if (!dragItem.current || dragItem.current === targetId) return;
    setRemoteWidgets(prev => {
      const sorted = [...prev].sort((a, b) => a.position - b.position);
      const fi = sorted.findIndex(w => w.id === dragItem.current);
      const ti = sorted.findIndex(w => w.id === targetId);
      if (fi === -1 || ti === -1) return prev;
      const [moved] = sorted.splice(fi, 1);
      sorted.splice(ti, 0, moved);
      return sorted.map((w, i) => ({ ...w, position: i }));
    });
    dragItem.current = null;
  };
  const handleDragEnd = () => { setDragOverId(null); dragItem.current = null; };

  const boundScripts = scripts.filter(s => s.isButton || s.isIndicator);

  const renderRemoteDesigner = () => (
    <div className="view-section">
      <div className="section-header-row">
        <div>
          <h1 className="text-gradient">Remote Dashboard Designer</h1>
          <p>Build your mobile control panel — add widgets, drag to reorder, tap to configure.</p>
        </div>
        <div className="designer-actions">
          <a href="/remote" target="_blank" className="btn btn-secondary"><Icon name="external-link" /> Open Remote</a>
          <button className="btn btn-primary" onClick={saveRemoteLayout}><Icon name="save" /> Save & Get QR</button>
        </div>
      </div>

      {showQR && remoteUrl && (
        <div className="glass-card qr-panel margin-top-lg">
          <div className="card-title-bar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Icon name="qrcode" />
              <h4>Scan to Open Mobile Remote</h4>
            </div>
            <button className="btn btn-secondary btn-icon" onClick={() => setShowQR(false)}><Icon name="close" /></button>
          </div>
          <div className="qr-container">
            <div className="qr-code-wrap">
              <QRCodeSVG value={remoteUrl} size={180} level="H" fgColor="var(--primary)" bgColor="transparent" />
            </div>
            <div className="qr-info">
              <p className="text-muted" style={{ marginBottom: '0.5rem' }}>Point your phone's camera at this code to open the remote panel.</p>
              <div className="copy-input-row">
                <input type="text" readOnly value={remoteUrl} className="font-mono" style={{ fontSize: '0.82rem' }} />
                <button className="btn btn-secondary btn-icon" onClick={() => { navigator.clipboard.writeText(remoteUrl); addToast('URL copied!', 'success'); }}><Icon name="copy" /></button>
              </div>
              <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>PIN required to unlock. Set it in Settings.</p>
            </div>
          </div>
        </div>
      )}

      <div className="designer-layout-container">
        <div className="glass-card remote-library-panel">
          <h4>Add Widget</h4>
          <form onSubmit={handleWidgetAdd} className="editor-form no-margin">
            <div className="form-group">
              <label>Widget Label</label>
              <input type="text" required value={widgetForm.title} onChange={e => setWidgetForm({ ...widgetForm, title: e.target.value })} placeholder="e.g. Restart Nginx" />
            </div>
            <div className="form-group">
              <label>Subtitle / Description</label>
              <input type="text" value={widgetForm.description} onChange={e => setWidgetForm({ ...widgetForm, description: e.target.value })} placeholder="Short description shown on tile" />
            </div>
            <div className="form-group">
              <label>Widget Type</label>
              <select value={widgetForm.type} onChange={e => setWidgetForm({ ...widgetForm, type: e.target.value })}>
                <option value="button">Action Button</option>
                <option value="indicator">Health Indicator</option>
                <option value="metric">System Metric</option>
                <option value="ssh">SSH Terminal</option>
              </select>
            </div>

            {(widgetForm.type === 'button' || widgetForm.type === 'indicator') && (
              <div className="form-group">
                <label>Bind Script / Workflow</label>
                <select value={widgetForm.scriptId} onChange={e => setWidgetForm({ ...widgetForm, scriptId: e.target.value })}>
                  <option value="">— Select —</option>
                  {boundScripts.map(s => <option key={s.id} value={s.id}>{s.name} ({s.type})</option>)}
                </select>
              </div>
            )}

            {widgetForm.type === 'metric' && (
              <div className="form-group">
                <label>Metric</label>
                <select value={widgetForm.metricType} onChange={e => setWidgetForm({ ...widgetForm, metricType: e.target.value })}>
                  <option value="cpu">CPU Usage</option>
                  <option value="ram">RAM Memory</option>
                  <option value="disk">Disk Usage</option>
                  <option value="uptime">Uptime</option>
                </select>
              </div>
            )}

            {widgetForm.type === 'ssh' && (
              <div className="form-group">
                <label>SSH Connection</label>
                <select value={widgetForm.sshConnectionId} onChange={e => setWidgetForm({ ...widgetForm, sshConnectionId: e.target.value })}>
                  <option value="">— Select Connection —</option>
                  {sshConnections.map(c => <option key={c.id} value={c.id}>{c.name} ({c.username}@{c.host})</option>)}
                </select>
                {sshConnections.length === 0 && <small className="text-muted">No connections. Add them in SSH Connections view.</small>}
              </div>
            )}

            <div className="form-row">
              <div className="form-group">
                <label>Size</label>
                <select value={widgetForm.size} onChange={e => setWidgetForm({ ...widgetForm, size: e.target.value })}>
                  <option value="small">Small (1×1)</option>
                  <option value="medium">Medium (2×1)</option>
                  <option value="large">Large (2×2)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Color</label>
                <select value={widgetForm.color} onChange={e => setWidgetForm({ ...widgetForm, color: e.target.value })}>
                  {COLORS.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Icon</label>
              <div className="icon-picker">
                {ICONS.map(([name, label]) => (
                  <button key={name} type="button" title={label}
                    className={`icon-pick-btn ${widgetForm.icon === name ? 'selected' : ''}`}
                    onClick={() => setWidgetForm({ ...widgetForm, icon: name })}>
                    <Icon name={name} />
                  </button>
                ))}
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              <Icon name="plus" /> Add to Remote
            </button>
          </form>
        </div>

        <div className="glass-card remote-canvas-panel">
          <div className="canvas-header">
            <h4>Remote Preview</h4>
            <span className="badge badge-muted">{remoteWidgets.length} widgets</span>
          </div>
          <div className="remote-preview-grid">
            {remoteWidgets.length === 0
              ? <div style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--text-dim)', padding: '3rem' }}>Preview empty. Add widgets from the left panel.</div>
              : [...remoteWidgets].sort((a, b) => a.position - b.position).map(w => (
                <div key={w.id}
                  className={`preview-widget size-${w.size} accent-${w.color}${dragOverId === w.id ? ' drag-over' : ''}${dragItem.current === w.id ? ' dragging' : ''}`}
                  draggable onDragStart={e => handleDragStart(e, w.id)} onDragOver={e => handleDragOver(e, w.id)}
                  onDrop={e => handleDrop(e, w.id)} onDragEnd={handleDragEnd}>
                  <div className="widget-preview-actions">
                    <button className="btn-remove-widget" onClick={() => removeWidgetFromGrid(w.id)}>&times;</button>
                  </div>
                  <Icon name={w.icon} />
                  <div className="widget-label">{w.title}</div>
                  <div className="text-muted" style={{ fontSize: '0.7rem' }}>
                    {w.type === 'metric' ? w.metricType : w.type === 'ssh' ? 'SSH' : w.type.toUpperCase()}
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      </div>
    </div>
  );

  // ────────────────────────────────────────────────────────
  // VIEW 5: SSH CONNECTIONS MANAGER
  // ────────────────────────────────────────────────────────
  const [sshConnForm, setSshConnForm] = useState({ id: '', name: '', host: '', port: 22, username: '', password: '' });
  const [sshConnEditorOpen, setSshConnEditorOpen] = useState(false);

  const openSshConnEditor = (conn = null) => {
    if (conn) {
      setSshConnForm({ id: conn.id, name: conn.name, host: conn.host, port: conn.port || 22, username: conn.username, password: '' });
    } else {
      setSshConnForm({ id: '', name: '', host: '', port: 22, username: '', password: '' });
    }
    setSshConnEditorOpen(true);
  };

  const saveSshConn = async (e) => {
    e.preventDefault();
    try {
      await apiCall('/api/ssh/connections', 'POST', sshConnForm);
      setSshConnEditorOpen(false);
      fetchSshConnections();
      addToast('SSH connection saved', 'success');
    } catch (err) {
      addToast('Save failed: ' + err.message, 'error');
    }
  };

  const deleteSshConn = async (id, name) => {
    if (!confirm(`Delete "${name}"?`)) return;
    await apiCall(`/api/ssh/connections/${id}`, 'DELETE');
    fetchSshConnections();
    addToast('Connection deleted', 'info');
  };

  const renderSshConnectionsView = () => (
    <div className="view-section">
      <div className="section-header-row">
        <div>
          <h1 className="text-gradient">SSH Connections</h1>
          <p>Save server credentials for one-tap terminal access from the mobile remote.</p>
        </div>
        <button className="btn btn-primary" onClick={() => openSshConnEditor()}><Icon name="plus" /> Add Connection</button>
      </div>

      <div className="scripts-grid">
        {sshConnections.length === 0
          ? <div className="glass-card text-center text-muted" style={{ gridColumn: '1/-1', padding: '3rem' }}>No SSH connections saved. Add one to enable SSH terminal widgets in the remote.</div>
          : sshConnections.map(conn => (
            <div className="glass-card script-card" key={conn.id}>
              <div className="script-header">
                <div>
                  <h3>{conn.name}</h3>
                  <span className="badge badge-muted" style={{ fontSize: '0.6rem', marginTop: '0.3rem' }}>SSH</span>
                </div>
                <div className="meta-status">
                  <span className={`status-dot ${conn.hasPassword ? 'success' : 'warn'}`}></span>
                  <span style={{ fontSize: '0.8rem' }}>{conn.hasPassword ? 'Password set' : 'No auth'}</span>
                </div>
              </div>
              <p className="script-desc font-mono" style={{ fontSize: '0.88rem' }}>{conn.username}@{conn.host}:{conn.port || 22}</p>
              <div className="script-meta">
                <span className="text-muted" style={{ fontSize: '0.78rem' }}>Port {conn.port || 22}</span>
                <div className="script-actions">
                  <button className="btn btn-secondary btn-icon" onClick={() => openSshConnEditor(conn)} title="Edit"><Icon name="edit" /></button>
                  <button className="btn btn-secondary btn-icon text-danger" onClick={() => deleteSshConn(conn.id, conn.name)} title="Delete"><Icon name="trash" /></button>
                  <button className="btn btn-primary btn-icon" onClick={() => setSshTerminalConn(conn)} title="Open Terminal"><Icon name="terminal" /></button>
                </div>
              </div>
            </div>
          ))
        }
      </div>

      {sshConnEditorOpen && (
        <div className="glass-card editor-card margin-top-lg">
          <div className="card-title-bar">
            <h3>{sshConnForm.id ? 'Edit SSH Connection' : 'Add SSH Connection'}</h3>
            <button className="btn btn-secondary btn-icon" onClick={() => setSshConnEditorOpen(false)}><Icon name="close" /></button>
          </div>
          <form onSubmit={saveSshConn} className="editor-form">
            <div className="form-group">
              <label>Connection Label</label>
              <input type="text" required value={sshConnForm.name} onChange={e => setSshConnForm({ ...sshConnForm, name: e.target.value })} placeholder="e.g. Production Web Server" />
            </div>
            <div className="form-row">
              <div className="form-group flex-2">
                <label>Host / IP Address</label>
                <input type="text" required value={sshConnForm.host} onChange={e => setSshConnForm({ ...sshConnForm, host: e.target.value })} placeholder="192.168.1.100 or server.com" />
              </div>
              <div className="form-group" style={{ maxWidth: '120px' }}>
                <label>Port</label>
                <input type="number" value={sshConnForm.port} onChange={e => setSshConnForm({ ...sshConnForm, port: parseInt(e.target.value) || 22 })} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group flex-1">
                <label>Username</label>
                <input type="text" required value={sshConnForm.username} onChange={e => setSshConnForm({ ...sshConnForm, username: e.target.value })} placeholder="root or ubuntu" />
              </div>
              <div className="form-group flex-1">
                <label>Password</label>
                <input type="password" value={sshConnForm.password} onChange={e => setSshConnForm({ ...sshConnForm, password: e.target.value })} placeholder={sshConnForm.id ? 'Leave blank to keep current' : 'Enter password'} />
              </div>
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setSshConnEditorOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary"><Icon name="save" /> Save Connection</button>
            </div>
          </form>
        </div>
      )}

      {sshTerminalConn && (
        <SshTerminalModal conn={sshTerminalConn} token={authToken} onClose={() => setSshTerminalConn(null)} />
      )}
    </div>
  );

  // ────────────────────────────────────────────────────────
  // VIEW 6: HISTORY
  // ────────────────────────────────────────────────────────
  const renderHistoryView = () => (
    <div className="view-section">
      <div className="section-header-row">
        <div>
          <h1 className="text-gradient">Activity History</h1>
          <p>Past command execution logs and run results.</p>
        </div>
        <button className="btn btn-danger" onClick={async () => {
          if (confirm('Delete all history logs?')) { await apiCall('/api/history', 'DELETE'); fetchHistory(); addToast('History cleared', 'info'); }
        }}><Icon name="trash" /> Wipe Logs</button>
      </div>
      <div className="glass-card history-card">
        <div className="table-container">
          <table className="history-table">
            <thead><tr><th>Script</th><th>Trigger</th><th>Time</th><th>Duration</th><th>Status</th><th className="text-right">Logs</th></tr></thead>
            <tbody>
              {history.length === 0
                ? <tr><td colSpan="6" className="text-center text-muted">No runs logged yet.</td></tr>
                : history.map(h => {
                  const dur = h.endTime ? ((new Date(h.endTime) - new Date(h.startTime)) / 1000).toFixed(1) + 's' : '—';
                  const badge = h.status === 'success' ? 'badge-success' : h.status === 'cancelled' ? 'badge-muted' : 'badge-danger';
                  return (
                    <tr key={h.id}>
                      <td style={{ fontWeight: 600, color: '#fff' }}>{h.scriptName}</td>
                      <td><span className="badge badge-info">{h.trigger.toUpperCase()}</span></td>
                      <td>{new Date(h.startTime).toLocaleString()}</td>
                      <td className="font-mono">{dur}</td>
                      <td><span className={`badge ${badge}`}>{h.status}</span></td>
                      <td className="text-right">
                        <button className="btn btn-secondary btn-icon" onClick={() => {
                          setTerminalTitle(`Log: ${h.scriptName}`);
                          setTerminalLogs(h.logs.split('\n'));
                          setTerminalStatus(`Done (exit ${h.exitCode})`);
                          setTerminalExitCode(h.exitCode);
                          setTerminalOpen(true);
                        }}><Icon name="eye" /></button>
                      </td>
                    </tr>
                  );
                })
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // ────────────────────────────────────────────────────────
  // VIEW 7: SETTINGS
  // ────────────────────────────────────────────────────────
  const handleSettingsSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { port: parseInt(settings.port), username: settings.username, remotePin: settings.remotePin };
      if (settings.password?.trim()) payload.password = settings.password;
      const res = await apiCall('/api/settings', 'POST', payload);
      addToast(res.message || 'Settings saved', 'success');
    } catch (err) { addToast('Failed: ' + err.message, 'error'); }
  };

  const renderSettingsView = () => (
    <div className="view-section">
      <div className="section-header">
        <h1 className="text-gradient">Daemon Configuration</h1>
        <p>Network, credentials, and remote access settings.</p>
      </div>
      <div className="settings-layout">
        <div className="glass-card settings-box">
          <h3>Access & Network</h3>
          <p className="settings-desc">Change port, admin credentials, and remote PIN. Restart required for port changes.</p>
          <form onSubmit={handleSettingsSubmit} className="editor-form margin-top-md">
            <div className="form-group">
              <label>Dashboard Port</label>
              <input type="number" required value={settings.port} onChange={e => setSettings({ ...settings, port: e.target.value })} />
              <small className="text-muted">Admin dashboard and mobile remote share this port. Restart to apply.</small>
            </div>
            <div className="form-group">
              <label>Admin Username</label>
              <input type="text" value={settings.username} onChange={e => setSettings({ ...settings, username: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Admin Password</label>
              <input type="password" value={settings.password} onChange={e => setSettings({ ...settings, password: e.target.value })} placeholder="Leave blank to keep current" />
            </div>
            <div className="form-group">
              <label>Mobile Remote PIN (4 digits)</label>
              <input type="text" maxLength="4" pattern="[0-9]{4}" value={settings.remotePin} onChange={e => setSettings({ ...settings, remotePin: e.target.value.replace(/\D/g, '').slice(0, 4) })} placeholder="1234" />
              <small className="text-muted">Used to unlock the mobile remote panel from phone/tablet.</small>
            </div>
            <div className="form-group">
              <label>API Security Token</label>
              <div className="copy-input-row">
                <input type="text" readOnly value={settings.secretToken} className="font-mono" />
                <button type="button" className="btn btn-secondary btn-icon" onClick={() => { navigator.clipboard.writeText(settings.secretToken); addToast('Token copied', 'success'); }}><Icon name="copy" /></button>
              </div>
              <small className="text-muted">Auto-generated. Used for API authentication.</small>
            </div>
            <button type="submit" className="btn btn-primary margin-top-md">Save Configuration</button>
          </form>
        </div>

        <div className="glass-card settings-box">
          <h3>systemd Autostart</h3>
          <p className="settings-desc">Keep ServManager running on server boot.</p>
          <div className="service-setup-instructions margin-top-md">
            <h5>1. Install</h5>
            <pre className="code-block">curl -sSL https://raw.githubusercontent.com/SahilSidhu7/ServManager/main/install.sh | bash</pre>
            <h5 className="margin-top-sm">2. Service file <span className="text-muted">(/etc/systemd/system/servmanager.service)</span></h5>
            <pre className="code-block font-xs">{`[Unit]
Description=ServManager Daemon
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/servmanager
ExecStart=/opt/servmanager/venv/bin/uvicorn backend.main:app --host 0.0.0.0 --port 8080
Restart=always

[Install]
WantedBy=multi-user.target`}</pre>
            <h5 className="margin-top-sm">3. Enable</h5>
            <pre className="code-block">{`sudo systemctl daemon-reload
sudo systemctl enable servmanager
sudo systemctl start servmanager`}</pre>
            <h5 className="margin-top-sm">4. SSH support (optional)</h5>
            <pre className="code-block">pip install asyncssh</pre>
          </div>
        </div>
      </div>
    </div>
  );

  // ────────────────────────────────────────────────────────
  // REMOTE VIEW (mobile/tablet)
  // ────────────────────────────────────────────────────────
  const renderRemoteView = () => (
    <div className="remote-wrapper">
      <header className="remote-header">
        <div className="header-logo">
          <Icon name="server" />
          <div>
            <h1>ServManager Remote</h1>
            <span className="hostname-display">{stats.hostname} · {stats.platform}</span>
          </div>
        </div>
        <div className="header-status">
          <span className="badge badge-success">
            <span className="pulse-dot green" style={{ width: 6, height: 6, marginRight: 4 }}></span>Live
          </span>
          <button className="btn btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', marginLeft: '0.5rem' }} onClick={handleLogout}>
            <Icon name="key" /> Lock
          </button>
        </div>
      </header>

      <main className="remote-grid">
        {remoteWidgets.length === 0
          ? <div className="grid-placeholder"><Icon name="layout" /><p>No widgets. Configure from Admin → Designer.</p></div>
          : [...remoteWidgets].sort((a, b) => a.position - b.position).map(w => {
            const script = scripts.find(s => s.id === w.scriptId);
            const sshConn = sshConnections.find(c => c.id === w.sshConnectionId);
            const status = script?.lastStatus || '';
            const sc = status === 'success' ? 'success' : status === 'failure' ? 'danger' : 'inactive';
            const isRunning = currentRunId && script?.id && currentRunId.includes(script.id) && terminalStatus === 'Running';

            if (w.type === 'button') return (
              <div key={w.id} className={`remote-widget type-button size-${w.size} accent-${w.color}${isRunning ? ' running' : ''}`}
                onClick={() => !isRunning && script && runScript(script, 'remote')}>
                <div className="widget-icon-wrap"><Icon name={w.icon} /></div>
                <div className="widget-body">
                  <div className="widget-title-display">{w.title}</div>
                  {w.description && <div className="widget-sub-display">{w.description}</div>}
                  <div className="widget-action-hint">{isRunning ? 'Running...' : 'Tap to run'}</div>
                </div>
              </div>
            );

            if (w.type === 'indicator') return (
              <div key={w.id} className={`remote-widget type-indicator size-${w.size} accent-${w.color}`}>
                <div className="indicator-status-row">
                  <div className={`indicator-ring ${sc}`}></div>
                  <div className="widget-icon-wrap sm"><Icon name={w.icon} /></div>
                </div>
                <div className="widget-body">
                  <div className="widget-title-display">{w.title}</div>
                  {w.description && <div className="widget-sub-display">{w.description}</div>}
                  <div className={`widget-status-badge ${sc}`}>{status ? status.toUpperCase() : 'UNKNOWN'}</div>
                </div>
              </div>
            );

            if (w.type === 'metric') {
              let val = '--';
              if (w.metricType === 'cpu') val = `${Math.round(stats.cpu)}%`;
              else if (w.metricType === 'ram') val = `${Math.round(stats.ram.pct)}%`;
              else if (w.metricType === 'disk') val = `${Math.round(stats.disk.pct)}%`;
              else if (w.metricType === 'uptime') val = formatUptime(stats.uptime);
              return (
                <div key={w.id} className={`remote-widget type-metric size-${w.size} accent-${w.color}`}>
                  <div className="widget-icon-wrap"><Icon name={w.icon} /></div>
                  <div className="widget-body">
                    <div className="metric-number-display">{val}</div>
                    <div className="widget-title-display">{w.title}</div>
                    {w.description && <div className="widget-sub-display">{w.description}</div>}
                  </div>
                </div>
              );
            }

            if (w.type === 'ssh') return (
              <div key={w.id} className={`remote-widget type-ssh size-${w.size} accent-${w.color}`}
                onClick={() => sshConn && setSshTerminalConn(sshConn)}>
                <div className="widget-icon-wrap"><Icon name="ssh" /></div>
                <div className="widget-body">
                  <div className="widget-title-display">{w.title}</div>
                  {sshConn
                    ? <div className="widget-sub-display font-mono">{sshConn.username}@{sshConn.host}</div>
                    : <div className="widget-sub-display" style={{ color: 'var(--status-danger)' }}>No connection</div>
                  }
                  <div className="widget-action-hint">Tap to open terminal</div>
                </div>
              </div>
            );

            return null;
          })
        }
      </main>

      {/* Console Drawer */}
      <div className={`console-drawer ${remoteDrawerOpen ? '' : 'hidden'}`}>
        <div className="drawer-header">
          <div className="drawer-title">{remoteDrawerTitle}</div>
          <div className="drawer-actions">
            {terminalStatus === 'Running' && (
              <button className="btn btn-danger btn-cancel-drawer" onClick={cancelExecution}><Icon name="stop" /> Kill</button>
            )}
            <button className="btn-close-drawer" onClick={() => setRemoteDrawerOpen(false)}>&times;</button>
          </div>
        </div>
        <div className="drawer-body">
          {terminalLogs.map((line, i) => (
            <div key={i} className={`terminal-line ${line.includes('[system-err]') || line.includes('[stderr]') ? 'error' : line.includes('===') || line.includes('[Step') ? 'system' : ''}`}>
              {line.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')}
            </div>
          ))}
          <div ref={terminalBottomRef} />
        </div>
      </div>

      {sshTerminalConn && (
        <SshTerminalModal conn={sshTerminalConn} token={authToken} onClose={() => setSshTerminalConn(null)} />
      )}
    </div>
  );

  // ────────────────────────────────────────────────────────
  // AUTH SCREENS
  // ────────────────────────────────────────────────────────
  if (showAuthModal) return (
    <div className="modal-overlay">
      <div className="glass-card modal-content auth-card">
        <div className="auth-logo"><Icon name="server" className="icon-svg" style={{ width: 32, height: 32 }} /></div>
        <h2 className="text-gradient">ServManager</h2>
        <p className="text-muted" style={{ marginBottom: '1.5rem' }}>Sign in to access the admin dashboard.</p>
        <div className="form-group">
          <label>Username</label>
          <input type="text" value={authUsername} onChange={e => setAuthUsername(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAuthenticate()} placeholder="admin" autoFocus />
        </div>
        <div className="form-group">
          <label>Password</label>
          <input type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAuthenticate()} placeholder="••••••••" />
        </div>
        {authError && <p style={{ color: 'var(--status-danger)', fontSize: '0.88rem', marginBottom: '0.75rem' }}>{authError}</p>}
        <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleAuthenticate}>Sign In</button>
      </div>
    </div>
  );

  if (isRemoteRoute) {
    if (showRemotePin) return (
      <div className="pin-overlay">
        <div className="pin-card">
          <div className="pin-logo"><Icon name="server" /></div>
          <h2>Remote Access</h2>
          <p className="pin-subtitle">Enter your 4-digit PIN to continue</p>
          <div className={`pin-display${pinShake ? ' shake' : ''}`}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} className={`pin-dot${i < pinValue.length ? (pinShake ? ' error' : ' filled') : ''}`} />
            ))}
          </div>
          <div className="pin-keypad">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
              <button key={n} className="pin-key" onClick={() => handlePinKey(String(n))}>{n}</button>
            ))}
            <div></div>
            <button className="pin-key pin-key-zero" onClick={() => handlePinKey('0')}>0</button>
            <button className="pin-key pin-key-del" onClick={() => setPinValue(p => p.slice(0, -1))}>⌫</button>
          </div>
          {pinError && <p className="pin-error-msg">{pinError}</p>}
        </div>
      </div>
    );
    return renderRemoteView();
  }

  // ────────────────────────────────────────────────────────
  // ADMIN DASHBOARD SHELL
  // ────────────────────────────────────────────────────────
  const NAV = [
    { id: 'stats', icon: 'stats', label: 'Diagnostics' },
    { id: 'scripts', icon: 'terminal', label: 'Scripts' },
    { id: 'workflows', icon: 'flow', label: 'Workflows' },
    { id: 'remote-designer', icon: 'layout', label: 'Remote Designer' },
    { id: 'ssh-connections', icon: 'ssh', label: 'SSH Connections' },
    { id: 'history', icon: 'activity', label: 'Run History' },
    { id: 'settings', icon: 'settings', label: 'Settings' },
  ];

  return (
    <div className="dashboard-container">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-logo"><Icon name="server" /></div>
          <div className="brand-text">
            <h2>ServManager</h2>
            <span className="badge badge-success">FastAPI</span>
          </div>
        </div>

        <nav className="sidebar-menu">
          {NAV.map(({ id, icon, label }) => (
            <button key={id} className={`menu-item ${view === id ? 'active' : ''}`} onClick={() => setView(id)}>
              <Icon name={icon} /> {label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="server-node-info">
            <div className="node-icon"><Icon name="activity" /></div>
            <div className="node-detail">
              <span className="node-name">{stats.hostname}</span>
              <span className="node-ip">up {formatUptime(stats.uptime)}</span>
            </div>
          </div>
          <div className="sidebar-logout">
            <button className="btn btn-logout" onClick={handleLogout}><Icon name="logout" /> Sign Out</button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        {view === 'stats' && renderStatsView()}
        {view === 'scripts' && renderScriptsView()}
        {view === 'workflows' && renderWorkflowsView()}
        {view === 'remote-designer' && renderRemoteDesigner()}
        {view === 'ssh-connections' && renderSshConnectionsView()}
        {view === 'history' && renderHistoryView()}
        {view === 'settings' && renderSettingsView()}
      </main>

      {/* Admin terminal modal */}
      {terminalOpen && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setTerminalOpen(false)}>
          <div className="glass-card modal-content terminal-card">
            <div className="terminal-header">
              <div className="terminal-dots"><span className="dot red"></span><span className="dot yellow"></span><span className="dot green"></span></div>
              <div className="terminal-title">{terminalTitle}</div>
              <button className="btn-close" onClick={() => setTerminalOpen(false)}>&times;</button>
            </div>
            <div className="terminal-body">
              {terminalLogs.map((line, i) => (
                <div key={i} className={`terminal-line ${line.includes('[system-err]') || line.includes('[stderr]') ? 'error' : line.includes('===') || line.includes('[Step') ? 'system' : ''}`}>
                  {line.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')}
                </div>
              ))}
              <div ref={terminalBottomRef} />
            </div>
            <div className="terminal-footer">
              <div className="status-indicator-wrap">
                <span className={`pulse-dot ${terminalStatus === 'Running' || terminalStatus === 'Spawning' ? 'green' : 'red'}`}></span>
                <span>{terminalStatus}{terminalStatus.startsWith('Finished') ? ` (exit ${terminalExitCode})` : ''}</span>
              </div>
              {(terminalStatus === 'Running' || terminalStatus === 'Spawning') && (
                <button className="btn btn-danger" onClick={cancelExecution}><Icon name="stop" /> Abort</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SSH terminal from admin view */}
      {sshTerminalConn && (
        <SshTerminalModal conn={sshTerminalConn} token={authToken} onClose={() => setSshTerminalConn(null)} />
      )}
    </div>
  );
}
