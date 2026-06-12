import React, { useState, useEffect, useRef } from 'react';

// ----------------------------------------------------
// VECTOR SVG ICON REGISTRY COMPONENT
// ----------------------------------------------------
const SVG_REGISTRY = {
  cpu: <><path d="M4 4h16v16H4zM9 9h6v6H9zM9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 15h3M1 9h3M1 15h3"/></>,
  database: <><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/></>,
  terminal: <><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></>,
  refresh: <><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></>,
  settings: <><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></>,
  home: <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></>,
  flow: <><path d="M12 2v20M17 5H7M12 12h8M4 12h8M12 19h5M7 19h5"/></>,
  layout: <><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line><line x1="9" y1="9" x2="21" y2="9"></line><line x1="9" y1="15" x2="21" y2="15"></line></>,
  stats: <><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></>,
  plus: <><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></>,
  trash: <><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></>,
  edit: <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></>,
  play: <><polygon points="5 3 19 12 5 21 5 3"></polygon></>,
  stop: <><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect></>,
  check: <><polyline points="20 6 9 17 4 12"></polyline></>,
  alert: <><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></>,
  close: <><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></>,
  'external-link': <><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></>,
  search: <><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></>,
  code: <><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></>,
  eye: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></>,
  save: <><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></>,
  server: <><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></>,
  'heart-rate': <><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></>,
  activity: <><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></>,
  key: <><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></>,
  copy: <><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></>,
  info: <><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></>,
  move: <><polyline points="5 9 2 12 5 15"></polyline><polyline points="9 5 12 2 15 5"></polyline><polyline points="15 19 12 22 9 19"></polyline><polyline points="19 9 22 12 19 15"></polyline><line x1="2" y1="12" x2="22" y2="12"></line><line x1="12" y1="2" x2="12" y2="22"></line></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></>
};

function Icon({ name, className = "icon-svg" }) {
  const inner = SVG_REGISTRY[name] || <circle cx="12" cy="12" r="8"/>;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={className} strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
      {inner}
    </svg>
  );
}

// ----------------------------------------------------
// MAIN APP COMPONENT
// ----------------------------------------------------
export default function App() {
  const [view, setView] = useState('stats'); // stats, scripts, workflows, remote-designer, history, settings
  const [authToken, setAuthToken] = useState(localStorage.getItem('servmanager_token') || '');
  const [showAuthModal, setShowAuthModal] = useState(!authToken);
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  // PIN state for remote
  const [pinValue, setPinValue] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinShake, setPinShake] = useState(false);
  const [showRemotePin, setShowRemotePin] = useState(false);
  
  // Real-time system stats
  const [stats, setStats] = useState({
    cpu: 0,
    ram: { total: 0, used: 0, pct: 0 },
    disk: { total: '0G', used: '0G', pct: 0 },
    uptime: 0,
    hostname: 'loading...',
    platform: ''
  });
  
  // Listening Ports list
  const [ports, setPorts] = useState([]);
  
  // Scripts and Workflows lists
  const [scripts, setScripts] = useState([]);
  
  // Remote Layout widgets
  const [remoteWidgets, setRemoteWidgets] = useState([]);
  
  // Logs history
  const [history, setHistory] = useState([]);
  
  // Daemon settings
  const [settings, setSettings] = useState({
    port: 8080,
    separatePorts: false,
    remotePort: 8081,
    secretToken: '',
    username: 'admin',
    password: '',
    remotePin: ''
  });

  // Terminal modal details
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [terminalTitle, setTerminalTitle] = useState('');
  const [terminalLogs, setTerminalLogs] = useState([]);
  const [terminalStatus, setTerminalStatus] = useState('Running'); // Running, Finished, Cancelled
  const [terminalExitCode, setTerminalExitCode] = useState(0);
  const [currentRunId, setCurrentRunId] = useState(null);

  // Slide-up Remote Drawer
  const [remoteDrawerOpen, setRemoteDrawerOpen] = useState(false);
  const [remoteDrawerTitle, setRemoteDrawerTitle] = useState('');

  const socketRef = useRef(null);
  const terminalBottomRef = useRef(null);
  
  const isRemoteRoute = window.location.pathname.startsWith('/remote');
  const [dragOverId, setDragOverId] = useState(null);
  const dragItem = useRef(null);

  // Token query checking on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      setAuthToken(token);
      localStorage.setItem('servmanager_token', token);
      setShowAuthModal(false);
      // Clean query string
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // API Request Helper
  const apiCall = async (endpoint, method = 'GET', body = null) => {
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    const options = { method, headers };
    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      const host = window.location.port === '5173' ? 'http://localhost:8080' : '';
      const res = await fetch(`${host}${endpoint}`, options);
      if (res.status === 401) {
        if (isRemoteRoute) { setShowRemotePin(true); } else { setShowAuthModal(true); }
        throw new Error('Unauthorized');
      }
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Request failed');
      }
      return await res.json();
    } catch (e) {
      console.error(`API Call failed: ${endpoint}`, e);
      throw e;
    }
  };

  // WebSocket Connection
  useEffect(() => {
    if (!authToken) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.port === '5173' ? 'localhost:8080' : window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;

    const connectWs = () => {
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        ws.send(JSON.stringify({ type: 'subscribe-stats' }));
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'stats') {
          setStats(msg.data);
        } else if (msg.type === 'log') {
          setTerminalLogs(prev => [...prev, msg.text]);
        } else if (msg.type === 'script-finished') {
          if (msg.runId === currentRunId || currentRunId === null) {
            setTerminalStatus(msg.status === 'success' ? 'Finished' : msg.status === 'cancelled' ? 'Cancelled' : 'Failed');
            setTerminalExitCode(msg.exitCode);
            // Remove loading flags from scripts
            setScripts(prev => prev.map(s => s.id === msg.scriptId ? { ...s, lastStatus: msg.status } : s));
          }
          fetchScripts();
        } else if (msg.type === 'indicator-update') {
          setScripts(prev => prev.map(s => s.id === msg.scriptId ? { ...s, lastStatus: msg.lastStatus, lastOutput: msg.lastOutput } : s));
        } else if (msg.type === 'remote-reload') {
          fetchRemoteConfig();
        }
      };

      ws.onclose = () => {
        console.log('WebSocket connection lost, reconnecting...');
        setTimeout(connectWs, 3000);
      };
    };

    connectWs();
    return () => {
      if (socketRef.current) socketRef.current.close();
    };
  }, [authToken, currentRunId]);

  // Detect whether remote needs PIN on load
  useEffect(() => {
    if (isRemoteRoute && !authToken) {
      setShowRemotePin(true);
    }
  }, []);

  // Fetch initial views
  useEffect(() => {
    if (!authToken) return;
    if (isRemoteRoute) {
      fetchRemoteConfig();
      fetchScripts();
    } else {
      loadViewDetails(view);
    }
  }, [authToken, view]);

  // Scroll terminal logs to bottom on append
  useEffect(() => {
    if (terminalBottomRef.current) {
      terminalBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [terminalLogs, terminalOpen, remoteDrawerOpen]);

  const loadViewDetails = (targetView) => {
    if (targetView === 'stats') {
      fetchPorts();
    } else if (targetView === 'scripts' || targetView === 'workflows') {
      fetchScripts();
    } else if (targetView === 'remote-designer') {
      fetchRemoteConfig();
      fetchScripts();
    } else if (targetView === 'history') {
      fetchHistory();
    } else if (targetView === 'settings') {
      fetchSettings();
    }
  };

  const fetchPorts = async () => {
    try {
      const data = await apiCall('/api/system/ports');
      setPorts(data);
    } catch (e) {}
  };

  const fetchScripts = async () => {
    try {
      const data = await apiCall('/api/scripts');
      setScripts(data);
    } catch (e) {}
  };

  const fetchRemoteConfig = async () => {
    try {
      const data = await apiCall('/api/remote/config');
      setRemoteWidgets(data.widgets || []);
    } catch (e) {}
  };

  const fetchHistory = async () => {
    try {
      const data = await apiCall('/api/history');
      setHistory(data);
    } catch (e) {}
  };

  const fetchSettings = async () => {
    try {
      const data = await apiCall('/api/settings');
      setSettings(data);
    } catch (e) {}
  };

  // Run script action
  const runScript = async (script, trigger = 'manual') => {
    setTerminalTitle(`Executing: ${script.name}`);
    setTerminalLogs(['Connecting process to server...']);
    setTerminalStatus('Spawning');
    setTerminalOpen(true);
    setRemoteDrawerOpen(true);
    setRemoteDrawerTitle(script.name);

    try {
      const res = await apiCall('/api/scripts/run', 'POST', { id: script.id, trigger });
      setCurrentRunId(res.runId);
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: 'subscribe-log', runId: res.runId }));
      }
      setTerminalStatus('Running');
    } catch (err) {
      setTerminalLogs(prev => [...prev, `[system-err] Failed to start execution: ${err.message}`]);
      setTerminalStatus('Failed');
    }
  };

  const cancelExecution = async () => {
    if (currentRunId) {
      await apiCall('/api/scripts/cancel', 'POST', { runId: currentRunId });
    }
  };

  const handleAuthenticate = async () => {
    if (!authUsername.trim() || !authPassword.trim()) {
      setAuthError('Please enter both username and password.');
      return;
    }
    setAuthError('');
    try {
      const host = window.location.port === '5173' ? 'http://localhost:8080' : '';
      const res = await fetch(`${host}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: authUsername, password: authPassword })
      });
      if (!res.ok) {
        const err = await res.json();
        setAuthError(err.detail || 'Login failed. Check your credentials.');
        return;
      }
      const data = await res.json();
      setAuthToken(data.token);
      localStorage.setItem('servmanager_token', data.token);
      setShowAuthModal(false);
    } catch (e) {
      setAuthError('Network error. Is ServManager running?');
    }
  };

  const handlePinKey = async (digit) => {
    if (pinShake) return;
    const next = pinValue + digit;
    setPinValue(next);
    setPinError('');
    if (next.length === 4) {
      try {
        const host = window.location.port === '5173' ? 'http://localhost:8080' : '';
        const res = await fetch(`${host}/api/remote/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: next })
        });
        if (!res.ok) {
          const err = await res.json();
          setPinError(err.detail || 'Incorrect PIN. Try again.');
          setPinShake(true);
          setTimeout(() => { setPinValue(''); setPinShake(false); }, 600);
          return;
        }
        const data = await res.json();
        setAuthToken(data.token);
        localStorage.setItem('servmanager_token', data.token);
        setShowRemotePin(false);
      } catch (e) {
        setPinError('Network error.');
        setTimeout(() => { setPinValue(''); }, 600);
      }
    }
  };

  const handlePinDelete = () => {
    setPinValue(prev => prev.slice(0, -1));
    setPinError('');
  };

  const handleLogout = () => {
    setAuthToken('');
    localStorage.removeItem('servmanager_token');
    if (isRemoteRoute) { setShowRemotePin(true); } else { setShowAuthModal(true); }
  };

  // Switch tabs
  const handleNavClick = (targetView) => {
    setView(targetView);
  };

  // Format uptime
  const formatUptime = (seconds) => {
    const days = Math.floor(seconds / (3600 * 24));
    const hrs = Math.floor((seconds % (3600 * 24)) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${days > 0 ? days + 'd ' : ''}${hrs}h ${mins}m`;
  };

  // ----------------------------------------------------
  // SUB-VIEWS RENDERING
  // ----------------------------------------------------

  // 1. Stats monitoring view
  const renderStatsView = () => {
    const getDashOffset = (pct) => 251.2 - (pct / 100) * 251.2;

    return (
      <div className="view-section">
        <div className="section-header">
          <h1 className="text-gradient">System Diagnostics</h1>
          <p>Real-time system resources and active network listening ports.</p>
        </div>

        <div className="stats-grid">
          {/* CPU Card */}
          <div className="glass-card stats-card">
            <div className="card-title">
              <h3>CPU Usage</h3>
              <Icon name="cpu" className="icon-svg text-indigo" />
            </div>
            <div className="gauge-container">
              <svg viewBox="0 0 100 100" className="gauge-svg">
                <circle className="gauge-bg" cx="50" cy="50" r="40"></circle>
                <circle className="gauge-value gauge-cpu" cx="50" cy="50" r="40" strokeDasharray="251.2" strokeDashoffset={getDashOffset(stats.cpu)}></circle>
              </svg>
              <div className="gauge-value-text">{Math.round(stats.cpu)}%</div>
            </div>
            <div className="card-details text-center">
              <span>Average Core Load</span>
            </div>
          </div>

          {/* RAM Card */}
          <div className="glass-card stats-card">
            <div className="card-title">
              <h3>RAM Memory</h3>
              <Icon name="database" className="icon-svg text-violet" />
            </div>
            <div className="gauge-container">
              <svg viewBox="0 0 100 100" className="gauge-svg">
                <circle className="gauge-bg" cx="50" cy="50" r="40"></circle>
                <circle className="gauge-value gauge-ram" cx="50" cy="50" r="40" strokeDasharray="251.2" strokeDashoffset={getDashOffset(stats.ram.pct)}></circle>
              </svg>
              <div className="gauge-value-text">{Math.round(stats.ram.pct)}%</div>
            </div>
            <div className="card-details text-center">
              <span>{Math.round(stats.ram.used)} MB / {Math.round(stats.ram.total)} MB</span>
            </div>
          </div>

          {/* Disk Card */}
          <div className="glass-card stats-card">
            <div className="card-title">
              <h3>Disk Storage (Root)</h3>
              <Icon name="server" className="icon-svg text-emerald" />
            </div>
            <div className="gauge-container">
              <svg viewBox="0 0 100 100" className="gauge-svg">
                <circle className="gauge-bg" cx="50" cy="50" r="40"></circle>
                <circle className="gauge-value gauge-disk" cx="50" cy="50" r="40" strokeDasharray="251.2" strokeDashoffset={getDashOffset(stats.disk.pct)}></circle>
              </svg>
              <div className="gauge-value-text">{Math.round(stats.disk.pct)}%</div>
            </div>
            <div className="card-details text-center">
              <span>Used: {stats.disk.used} / Total: {stats.disk.total}</span>
            </div>
          </div>
        </div>

        <div className="glass-card ports-card margin-top-lg">
          <div className="card-title-bar">
            <h3>Active Listening Ports</h3>
            <span className="badge badge-info">{ports.length} Ports Active</span>
          </div>
          <div className="table-container">
            <table className="ports-table">
              <thead>
                <tr>
                  <th>Protocol</th>
                  <th>Port</th>
                  <th>IP Address</th>
                  <th>State</th>
                </tr>
              </thead>
              <tbody>
                {ports.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="text-center text-muted">Scanning active networks...</td>
                  </tr>
                ) : (
                  ports.map((p, idx) => (
                    <tr key={idx}>
                      <td><span className={`badge ${p.proto === 'TCP' ? 'badge-info' : 'badge-warn'}`}>{p.proto}</span></td>
                      <td className="font-mono text-gradient" style={{ fontWeight: 600 }}>{p.port}</td>
                      <td className="font-mono">{p.address}</td>
                      <td><span className="badge badge-success">{p.state}</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // 2. Scripts Manager View
  const [editingScript, setEditingScript] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorForm, setEditorForm] = useState({
    id: '', name: '', description: '', isButton: true, isIndicator: false, interval: 30, content: ''
  });

  const openScriptEditor = (script = null) => {
    if (script) {
      setEditorForm({
        id: script.id,
        name: script.name,
        description: script.description || '',
        isButton: script.isButton,
        isIndicator: script.isIndicator,
        interval: script.interval || 30,
        content: script.content || ''
      });
    } else {
      setEditorForm({
        id: '',
        name: '',
        description: '',
        isButton: true,
        isIndicator: false,
        interval: 30,
        content: '#!/bin/bash\n# Write command line scripts here\necho "Checking server active configurations..."\nexit 0'
      });
    }
    setEditorOpen(true);
  };

  const deleteScript = async (id, name) => {
    if (confirm(`Are you sure you want to delete script "${name}"?`)) {
      await apiCall(`/api/scripts/${id}`, 'DELETE');
      fetchScripts();
    }
  };

  const handleScriptSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      id: editorForm.id || null,
      name: editorForm.name,
      description: editorForm.description,
      type: 'shell',
      isButton: editorForm.isButton,
      isIndicator: editorForm.isIndicator,
      interval: parseInt(editorForm.interval) || 30,
      content: editorForm.content
    };
    await apiCall('/api/scripts', 'POST', payload);
    setEditorOpen(false);
    fetchScripts();
  };

  const renderScriptsView = () => {
    const shellScripts = scripts.filter(s => s.type === 'shell');

    return (
      <div className="view-section">
        <div className="section-header-row">
          <div>
            <h1 className="text-gradient">Scripts Manager</h1>
            <p>Upload, write, and run custom shell command lines.</p>
          </div>
          <button className="btn btn-primary" onClick={() => openScriptEditor()}>
            <Icon name="plus" /> New Script
          </button>
        </div>

        <div className="scripts-grid">
          {shellScripts.length === 0 ? (
            <div className="glass-card text-center text-muted" style={{ gridColumn: '1/-1' }}>No scripts created. Click "New Script" to write one.</div>
          ) : (
            shellScripts.map(s => {
              const statusClass = s.lastStatus === 'success' ? 'success' : s.lastStatus === 'failure' ? 'danger' : 'inactive';
              return (
                <div className="glass-card script-card" key={s.id}>
                  <div className="script-header">
                    <div>
                      <h3>{s.name}</h3>
                      <span className="badge badge-muted" style={{ fontSize: '0.65rem', marginTop: '0.25rem' }}>SHELL</span>
                    </div>
                    <div className="meta-status">
                      <span className={`status-dot ${statusClass}`}></span>
                      <span>{s.lastStatus ? s.lastStatus.toUpperCase() : 'NOT RUN'}</span>
                    </div>
                  </div>
                  <p className="script-desc">{s.description || 'No description provided.'}</p>
                  <div className="script-meta">
                    <span className="text-muted" style={{ fontSize: '0.8rem' }}>Interval: {s.isIndicator ? `${s.interval}s` : 'Manual'}</span>
                    <div className="script-actions">
                      <button className="btn btn-secondary btn-icon" onClick={() => openScriptEditor(s)} title="Edit Script">
                        <Icon name="edit" />
                      </button>
                      <button className="btn btn-secondary btn-icon text-danger" onClick={() => deleteScript(s.id, s.name)} title="Delete Script">
                        <Icon name="trash" />
                      </button>
                      <button className="btn btn-primary btn-icon" onClick={() => runScript(s)} title="Execute Script">
                        <Icon name="play" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {editorOpen && (
          <div className="glass-card editor-card margin-top-lg">
            <div className="card-title-bar">
              <h3>{editorForm.id ? 'Edit Script Settings' : 'Create New Script'}</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setEditorOpen(false)}>&times;</button>
            </div>
            <form onSubmit={handleScriptSubmit} className="editor-form">
              <div className="form-row">
                <div className="form-group flex-2">
                  <label>Script Title</label>
                  <input type="text" value={editorForm.name} required onChange={e => setEditorForm({...editorForm, name: e.target.value})} placeholder="e.g. Purge System Temp Caches" />
                </div>
                <div className="form-group flex-1">
                  <label>Remote Options</label>
                  <div className="checkbox-row">
                    <label className="checkbox-label">
                      <input type="checkbox" checked={editorForm.isButton} onChange={e => setEditorForm({...editorForm, isButton: e.target.checked})} /> Button Trigger
                    </label>
                    <label className="checkbox-label">
                      <input type="checkbox" checked={editorForm.isIndicator} onChange={e => setEditorForm({...editorForm, isIndicator: e.target.checked})} /> Status Badge
                    </label>
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label>Description</label>
                <input type="text" value={editorForm.description} onChange={e => setEditorForm({...editorForm, description: e.target.value})} placeholder="Describe script output triggers..." />
              </div>

              {editorForm.isIndicator && (
                <div className="form-row">
                  <div className="form-group">
                    <label>Poll Scan Interval (seconds)</label>
                    <input type="number" min="5" value={editorForm.interval} onChange={e => setEditorForm({...editorForm, interval: e.target.value})} />
                  </div>
                </div>
              )}

              <div className="form-group">
                <div className="editor-label-bar">
                  <label>Shell Code</label>
                  <span className="badge badge-muted">bash / sh / batch</span>
                </div>
                <textarea className="code-editor-area" required value={editorForm.content} onChange={e => setEditorForm({...editorForm, content: e.target.value})} placeholder="#!/bin/bash"></textarea>
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setEditorOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">
                  <Icon name="save" /> Save Script
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  };

  // 3. Workflows Designer View
  const [designerOpen, setDesignerOpen] = useState(false);
  const [wfForm, setWfForm] = useState({
    id: '', name: '', description: '', isButton: true, isIndicator: false, interval: 30, steps: []
  });

  const openWorkflowDesigner = (wf = null) => {
    if (wf) {
      setWfForm({
        id: wf.id,
        name: wf.name,
        description: wf.description || '',
        isButton: wf.isButton,
        isIndicator: wf.isIndicator,
        interval: wf.interval || 30,
        steps: wf.workflow?.steps || []
      });
    } else {
      setWfForm({
        id: '',
        name: '',
        description: '',
        isButton: true,
        isIndicator: false,
        interval: 30,
        steps: []
      });
    }
    setDesignerOpen(true);
  };

  const addWorkflowStep = (type) => {
    const stepId = 'step_' + Date.now() + Math.random().toString(36).substr(2, 4);
    let name = '';
    let config = {};

    if (type === 'command') {
      name = 'Run Subprocess';
      config = { command: 'echo "hello"' };
    } else if (type === 'check_port') {
      name = 'Scan Socket Port';
      config = { port: '80' };
    } else if (type === 'http_request') {
      name = 'Send Web Hook';
      config = { url: 'http://localhost:8080/api/system/stats', method: 'GET', body: '' };
    } else if (type === 'conditional') {
      name = 'Logical Branch';
      config = { matchType: 'exitcode', value: '0', nextStepId: '', elseStepId: '' };
    } else if (type === 'delay') {
      name = 'Delay Sleep';
      config = { seconds: '2' };
    } else if (type === 'log') {
      name = 'Print Log';
      config = { message: 'Workflow checkpoint passed.' };
    }

    setWfForm(prev => ({
      ...prev,
      steps: [...prev.steps, { id: stepId, type, name, config }]
    }));
  };

  const updateStepConfig = (idx, key, val) => {
    setWfForm(prev => {
      const stepsCopy = [...prev.steps];
      stepsCopy[idx].config[key] = val;
      return { ...prev, steps: stepsCopy };
    });
  };

  const removeWorkflowStep = (idx) => {
    setWfForm(prev => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== idx)
    }));
  };

  const moveWorkflowStep = (idx, direction) => {
    setWfForm(prev => {
      const stepsCopy = [...prev.steps];
      if (direction === 'up' && idx > 0) {
        const temp = stepsCopy[idx];
        stepsCopy[idx] = stepsCopy[idx - 1];
        stepsCopy[idx - 1] = temp;
      } else if (direction === 'down' && idx < stepsCopy.length - 1) {
        const temp = stepsCopy[idx];
        stepsCopy[idx] = stepsCopy[idx + 1];
        stepsCopy[idx + 1] = temp;
      }
      return { ...prev, steps: stepsCopy };
    });
  };

  const handleWorkflowSubmit = async () => {
    if (!wfForm.name) {
      alert('Workflow name is required');
      return;
    }
    const payload = {
      id: wfForm.id || null,
      name: wfForm.name,
      description: wfForm.description,
      type: 'workflow',
      isButton: wfForm.isButton,
      isIndicator: wfForm.isIndicator,
      interval: parseInt(wfForm.interval) || 30,
      workflow: {
        steps: wfForm.steps
      }
    };
    await apiCall('/api/scripts', 'POST', payload);
    setDesignerOpen(false);
    fetchScripts();
  };

  const renderWorkflowsView = () => {
    const workflows = scripts.filter(s => s.type === 'workflow');

    return (
      <div className="view-section">
        <div className="section-header-row">
          <div>
            <h1 className="text-gradient">Workflows Manager</h1>
            <p>Chain system shell executions and API web hooks sequentially.</p>
          </div>
          <button className="btn btn-primary" onClick={() => openWorkflowDesigner()}>
            <Icon name="plus" /> Create Workflow
          </button>
        </div>

        <div className="scripts-grid">
          {workflows.length === 0 ? (
            <div className="glass-card text-center text-muted" style={{ gridColumn: '1/-1' }}>No workflows configured. Click "Create Workflow" to configure.</div>
          ) : (
            workflows.map(w => {
              const statusClass = w.lastStatus === 'success' ? 'success' : w.lastStatus === 'failure' ? 'danger' : 'inactive';
              return (
                <div className="glass-card script-card" key={w.id}>
                  <div className="script-header">
                    <div>
                      <h3>{w.name}</h3>
                      <span className="badge badge-muted" style={{ fontSize: '0.65rem', marginTop: '0.25rem' }}>WORKFLOW</span>
                    </div>
                    <div className="meta-status">
                      <span className={`status-dot ${statusClass}`}></span>
                      <span>{w.lastStatus ? w.lastStatus.toUpperCase() : 'NOT RUN'}</span>
                    </div>
                  </div>
                  <p className="script-desc">{w.description || 'No description provided.'}</p>
                  <div className="script-meta">
                    <span className="text-muted" style={{ fontSize: '0.8rem' }}>Steps: {w.workflow?.steps?.length || 0}</span>
                    <div className="script-actions">
                      <button className="btn btn-secondary btn-icon" onClick={() => openWorkflowDesigner(w)} title="Edit Workflow">
                        <Icon name="edit" />
                      </button>
                      <button className="btn btn-secondary btn-icon text-danger" onClick={() => deleteScript(w.id, w.name)} title="Delete Workflow">
                        <Icon name="trash" />
                      </button>
                      <button className="btn btn-primary btn-icon" onClick={() => runScript(w)} title="Execute Workflow">
                        <Icon name="play" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {designerOpen && (
          <div className="workflow-designer-wrap margin-top-lg">
            <div className="glass-card workflow-designer-card">
              <div className="card-title-bar">
                <h3>{wfForm.id ? 'Modify Workflow Steps' : 'Assemble Workflow'}</h3>
                <button className="btn btn-secondary btn-icon" onClick={() => setDesignerOpen(false)}>&times;</button>
              </div>

              <div className="editor-form-meta">
                <div className="form-row">
                  <div className="form-group flex-2">
                    <label>Workflow Name</label>
                    <input type="text" value={wfForm.name} required onChange={e => setWfForm({...wfForm, name: e.target.value})} placeholder="e.g. Core Web Server Health poller" />
                  </div>
                  <div className="form-group flex-1">
                    <div className="checkbox-row double-spacing">
                      <label className="checkbox-label">
                        <input type="checkbox" checked={wfForm.isButton} onChange={e => setWfForm({...wfForm, isButton: e.target.checked})} /> Remote Button
                      </label>
                      <label className="checkbox-label">
                        <input type="checkbox" checked={wfForm.isIndicator} onChange={e => setWfForm({...wfForm, isIndicator: e.target.checked})} /> Health Indicator
                      </label>
                    </div>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group flex-2">
                    <label>Description</label>
                    <input type="text" value={wfForm.description} onChange={e => setWfForm({...wfForm, description: e.target.value})} placeholder="Describe execution sequences..." />
                  </div>
                  {wfForm.isIndicator && (
                    <div className="form-group flex-1">
                      <label>Background Poller Timer (s)</label>
                      <input type="number" min="5" value={wfForm.interval} onChange={e => setWfForm({...wfForm, interval: e.target.value})} />
                    </div>
                  )}
                </div>
              </div>

              <div className="designer-workspace">
                {/* Available library steps */}
                <div className="blocks-library">
                  <h4>Step Blocks</h4>
                  <p className="library-subtitle">Click to add steps to workflow canvas:</p>
                  <div className="library-blocks-list">
                    <button className="btn btn-secondary lib-block-btn" onClick={() => addWorkflowStep('command')}>
                      <Icon name="terminal" /> Command Exec
                    </button>
                    <button className="btn btn-secondary lib-block-btn" onClick={() => addWorkflowStep('check_port')}>
                      <Icon name="stats" /> Scan Port
                    </button>
                    <button className="btn btn-secondary lib-block-btn" onClick={() => addWorkflowStep('http_request')}>
                      <Icon name="external-link" /> Send API Call
                    </button>
                    <button className="btn btn-secondary lib-block-btn" onClick={() => addWorkflowStep('conditional')}>
                      <Icon name="flow" /> Condition Jump
                    </button>
                    <button className="btn btn-secondary lib-block-btn" onClick={() => addWorkflowStep('delay')}>
                      <Icon name="refresh" /> Delay Sleep
                    </button>
                    <button className="btn btn-secondary lib-block-btn" onClick={() => addWorkflowStep('log')}>
                      <Icon name="info" /> Print Log Msg
                    </button>
                  </div>
                </div>

                {/* Canvas Workspace */}
                <div className="canvas-panel">
                  <div className="canvas-header">
                    <h4>Workflow Execution Sequence</h4>
                    <span className="badge badge-muted">{wfForm.steps.length} Steps</span>
                  </div>
                  <div className="canvas-steps">
                    {wfForm.steps.length === 0 ? (
                      <div className="canvas-placeholder">
                        <Icon name="flow" />
                        <p>No active steps selected. Choose block options from the left library.</p>
                      </div>
                    ) : (
                      wfForm.steps.map((step, idx) => {
                        let stepConfigHtml = null;

                        if (step.type === 'command') {
                          stepConfigHtml = (
                            <div className="step-input-group">
                              <label>Shell Command</label>
                              <input type="text" value={step.config.command || ''} onChange={e => updateStepConfig(idx, 'command', e.target.value)} />
                            </div>
                          );
                        } else if (step.type === 'check_port') {
                          stepConfigHtml = (
                            <div className="step-input-group">
                              <label>Port (TCP)</label>
                              <input type="number" value={step.config.port || ''} onChange={e => updateStepConfig(idx, 'port', e.target.value)} />
                            </div>
                          );
                        } else if (step.type === 'http_request') {
                          stepConfigHtml = (
                            <>
                              <div className="step-input-group flex-2">
                                <label>Target URL</label>
                                <input type="text" value={step.config.url || ''} onChange={e => updateStepConfig(idx, 'url', e.target.value)} />
                              </div>
                              <div className="step-input-group flex-1">
                                <label>Method</label>
                                <select value={step.config.method || 'GET'} onChange={e => updateStepConfig(idx, 'method', e.target.value)}>
                                  <option value="GET">GET</option>
                                  <option value="POST">POST</option>
                                </select>
                              </div>
                            </>
                          );
                        } else if (step.type === 'delay') {
                          stepConfigHtml = (
                            <div className="step-input-group">
                              <label>Duration (Seconds)</label>
                              <input type="number" value={step.config.seconds || '1'} onChange={e => updateStepConfig(idx, 'seconds', e.target.value)} />
                            </div>
                          );
                        } else if (step.type === 'log') {
                          stepConfigHtml = (
                            <div className="step-input-group">
                              <label>Message Content</label>
                              <input type="text" value={step.config.message || ''} onChange={e => updateStepConfig(idx, 'message', e.target.value)} />
                            </div>
                          );
                        } else if (step.type === 'conditional') {
                          const otherSteps = wfForm.steps.filter((_, i) => i !== idx);
                          stepConfigHtml = (
                            <>
                              <div className="step-input-group">
                                <label>Comparison Method</label>
                                <select value={step.config.matchType || 'exitcode'} onChange={e => updateStepConfig(idx, 'matchType', e.target.value)}>
                                  <option value="exitcode">Last Exit Code</option>
                                  <option value="contains">Output Contains</option>
                                  <option value="equals">Output Equals</option>
                                </select>
                              </div>
                              <div className="step-input-group">
                                <label>Value Match</label>
                                <input type="text" value={step.config.value || ''} onChange={e => updateStepConfig(idx, 'value', e.target.value)} />
                              </div>
                              <div className="step-input-group">
                                <label>If True, Jump To</label>
                                <select value={step.config.nextStepId || ''} onChange={e => updateStepConfig(idx, 'nextStepId', e.target.value)}>
                                  <option value="">-- Continue --</option>
                                  {otherSteps.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                              </div>
                              <div className="step-input-group">
                                <label>Else, Jump To</label>
                                <select value={step.config.elseStepId || ''} onChange={e => updateStepConfig(idx, 'elseStepId', e.target.value)}>
                                  <option value="">-- Continue --</option>
                                  {otherSteps.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                              </div>
                            </>
                          );
                        }

                        return (
                          <div className="workflow-step-block" key={step.id}>
                            <div className="step-block-header">
                              <div className="step-block-title">
                                <span className="badge badge-info">{idx + 1}</span>
                                <span>{step.name}</span>
                                <small className="text-muted">({step.type.toUpperCase()})</small>
                              </div>
                              <div className="script-actions">
                                <button className="btn btn-secondary btn-icon" style={{ height: 30, width: 30 }} onClick={() => moveWorkflowStep(idx, 'up')}>&uarr;</button>
                                <button className="btn btn-secondary btn-icon" style={{ height: 30, width: 30 }} onClick={() => moveWorkflowStep(idx, 'down')}>&darr;</button>
                                <button className="btn btn-secondary btn-icon text-danger" style={{ height: 30, width: 30 }} onClick={() => removeWorkflowStep(idx)}>&times;</button>
                              </div>
                            </div>
                            <div className="step-block-config">
                              {stepConfigHtml}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              <div className="form-actions border-top">
                <button type="button" className="btn btn-secondary" onClick={() => setDesignerOpen(false)}>Cancel</button>
                <button type="button" className="btn btn-primary" onClick={handleWorkflowSubmit}>
                  <Icon name="save" /> Save Workflow
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // 4. Remote Designer View
  const [widgetForm, setWidgetForm] = useState({
    title: '', type: 'button', scriptId: '', metricType: 'cpu', size: 'small', color: 'indigo', icon: 'terminal'
  });

  const handleWidgetAdd = (e) => {
    e.preventDefault();
    const bindingScript = scripts.find(s => s.id === widgetForm.scriptId);
    
    const newWidget = {
      id: 'widget_' + Date.now(),
      title: widgetForm.title,
      type: widgetForm.type,
      scriptId: widgetForm.type !== 'metric' ? (widgetForm.scriptId || (scripts[0]?.id || '')) : null,
      metricType: widgetForm.type === 'metric' ? widgetForm.metricType : null,
      size: widgetForm.size,
      color: widgetForm.color,
      icon: widgetForm.icon,
      position: remoteWidgets.length
    };

    setRemoteWidgets(prev => [...prev, newWidget]);
    // Reset form title
    setWidgetForm({ ...widgetForm, title: '' });
  };

  const removeWidgetFromGrid = (id) => {
    setRemoteWidgets(prev => prev.filter(w => w.id !== id).map((w, idx) => ({ ...w, position: idx })));
  };

  const saveRemoteLayout = async () => {
    try {
      await apiCall('/api/remote/config', 'POST', { widgets: remoteWidgets });
      alert('Remote layout settings updated.');
    } catch (e) {
      alert('Failed to save layout configuration: ' + e.message);
    }
  };

  // Drag-and-drop handlers for Remote Designer
  const handleDragStart = (e, id) => {
    dragItem.current = id;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, id) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (id !== dragItem.current) setDragOverId(id);
  };

  const handleDrop = (e, targetId) => {
    e.preventDefault();
    setDragOverId(null);
    if (!dragItem.current || dragItem.current === targetId) return;
    setRemoteWidgets(prev => {
      const sorted = [...prev].sort((a, b) => a.position - b.position);
      const fromIdx = sorted.findIndex(w => w.id === dragItem.current);
      const toIdx = sorted.findIndex(w => w.id === targetId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const moved = sorted.splice(fromIdx, 1)[0];
      sorted.splice(toIdx, 0, moved);
      return sorted.map((w, i) => ({ ...w, position: i }));
    });
    dragItem.current = null;
  };

  const handleDragEnd = () => {
    setDragOverId(null);
    dragItem.current = null;
  };

  const renderRemoteDesigner = () => {
    const boundScripts = scripts.filter(s => s.isButton || s.isIndicator);
    
    return (
      <div className="view-section">
        <div className="section-header-row">
          <div>
            <h1 className="text-gradient">Remote Dashboard Designer</h1>
            <p>Configure custom layouts, actions, and status widgets for tablet control pads.</p>
          </div>
          <div className="designer-actions">
            <a href="/remote" target="_blank" className="btn btn-secondary">
              <Icon name="external-link" /> Open Remote Pad
            </a>
            <button className="btn btn-primary" onClick={saveRemoteLayout}>
              <Icon name="save" /> Save Layout Config
            </button>
          </div>
        </div>

        <div className="designer-layout-container">
          {/* Add widget form panel */}
          <div className="glass-card remote-library-panel">
            <h4>Layout Block Library</h4>
            <p className="library-subtitle">Append active nodes directly into the touch remote dashboard:</p>

            <form onSubmit={handleWidgetAdd} className="editor-form no-margin">
              <div className="form-group">
                <label>Widget Label</label>
                <input type="text" required value={widgetForm.title} onChange={e => setWidgetForm({...widgetForm, title: e.target.value})} placeholder="e.g. Reboot Apache Service" />
              </div>

              <div className="form-group">
                <label>Widget Type</label>
                <select value={widgetForm.type} onChange={e => setWidgetForm({...widgetForm, type: e.target.value})}>
                  <option value="button">Action Command Trigger</option>
                  <option value="indicator">Health Status Ring</option>
                  <option value="metric">System Live resource</option>
                </select>
              </div>

              {widgetForm.type !== 'metric' ? (
                <div className="form-group">
                  <label>Bind to Script Action</label>
                  <select value={widgetForm.scriptId} onChange={e => setWidgetForm({...widgetForm, scriptId: e.target.value})}>
                    <option value="">-- Choose Script/Workflow --</option>
                    {boundScripts.map(s => <option key={s.id} value={s.id}>{s.name} ({s.type.toUpperCase()})</option>)}
                  </select>
                </div>
              ) : (
                <div className="form-group">
                  <label>Hardware Metric Type</label>
                  <select value={widgetForm.metricType} onChange={e => setWidgetForm({...widgetForm, metricType: e.target.value})}>
                    <option value="cpu">CPU Usage (%)</option>
                    <option value="ram">RAM Memory (%)</option>
                    <option value="disk">Root Disk (%)</option>
                    <option value="uptime">System Uptime</option>
                  </select>
                </div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label>Touch Grid Size</label>
                  <select value={widgetForm.size} onChange={e => setWidgetForm({...widgetForm, size: e.target.value})}>
                    <option value="small">Small (1x1)</option>
                    <option value="medium">Medium (2x1)</option>
                    <option value="large">Large (2x2)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Color Accent</label>
                  <select value={widgetForm.color} onChange={e => setWidgetForm({...widgetForm, color: e.target.value})}>
                    <option value="indigo">Indigo (Primary)</option>
                    <option value="violet">Violet</option>
                    <option value="emerald">Emerald</option>
                    <option value="amber">Amber</option>
                    <option value="rose">Rose</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Widget Graphic Icon</label>
                <select value={widgetForm.icon} onChange={e => setWidgetForm({...widgetForm, icon: e.target.value})}>
                  <option value="terminal">Terminal Prompt</option>
                  <option value="activity">Heartpulse</option>
                  <option value="cpu">CPU Chip</option>
                  <option value="database">RAM Grid</option>
                  <option value="server">Server Disk</option>
                  <option value="heart-rate">ECG Line</option>
                  <option value="refresh">Sync Loop</option>
                </select>
              </div>

              <button type="submit" className="btn btn-primary width-100">
                <Icon name="plus" /> Add Widget Block
              </button>
            </form>
          </div>

          {/* Interactive grid preview */}
          <div className="glass-card remote-canvas-panel">
            <div className="canvas-header">
              <h4>Remote Interface Mockup (Grid)</h4>
              <span className="badge badge-info">Preview Mode</span>
            </div>

            <div className="remote-preview-grid">
              {remoteWidgets.length === 0 ? (
                <div style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>
                  Preview canvas is empty. Add blocks from the library.
                </div>
              ) : (
                [...remoteWidgets].sort((a,b) => a.position - b.position).map(w => (
                  <div
                    key={w.id}
                    className={`preview-widget size-${w.size} accent-${w.color}${dragOverId === w.id ? ' drag-over' : ''}${dragItem.current === w.id ? ' dragging' : ''}`}
                    draggable
                    onDragStart={e => handleDragStart(e, w.id)}
                    onDragOver={e => handleDragOver(e, w.id)}
                    onDrop={e => handleDrop(e, w.id)}
                    onDragEnd={handleDragEnd}
                  >
                    <div className="widget-drag-handle" title="Drag to reorder">
                      <Icon name="move" className="icon-svg" style={{ width: '14px', height: '14px' }} />
                    </div>
                    <div className="widget-preview-actions">
                      <button className="btn-remove-widget" onClick={() => removeWidgetFromGrid(w.id)}>&times;</button>
                    </div>
                    <div style={{ fontSize: '1.5rem', opacity: 0.8 }}>
                      <Icon name={w.icon} />
                    </div>
                    <div className="widget-label">{w.title}</div>
                    <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                      {w.type === 'metric' ? `Metric: ${w.metricType.toUpperCase()}` : w.type.toUpperCase()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 5. Activity Log Audit History View
  const clearLogsHistory = async () => {
    if (confirm('Are you sure you want to delete all historical logs? This cannot be undone.')) {
      await apiCall('/api/history', 'DELETE');
      fetchHistory();
    }
  };

  const inspectHistoryLogs = (entry) => {
    setTerminalTitle(`Audit Log: ${entry.scriptName}`);
    setTerminalLogs(entry.logs.split('\n'));
    setTerminalStatus(`Completed (Code: ${entry.exitCode})`);
    setTerminalExitCode(entry.exitCode);
    setTerminalOpen(true);
  };

  const renderHistoryView = () => {
    return (
      <div className="view-section">
        <div className="section-header-row">
          <div>
            <h1 className="text-gradient">Activity History Logs</h1>
            <p>Database logs of past command runs.</p>
          </div>
          <button className="btn btn-danger" onClick={clearLogsHistory}>
            <Icon name="trash" /> Wipe Audit Logs
          </button>
        </div>

        <div className="glass-card history-card">
          <div className="table-container">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Script Reference</th>
                  <th>Trigger Source</th>
                  <th>Execution Time</th>
                  <th>Duration</th>
                  <th>Run Status</th>
                  <th className="text-right">Inspect</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center text-muted">No runs logged yet.</td>
                  </tr>
                ) : (
                  history.map(h => {
                    const statusBadge = h.status === 'success' 
                      ? <span className="badge badge-success">Success</span> 
                      : h.status === 'cancelled'
                        ? <span className="badge badge-muted">Cancelled</span>
                        : <span className="badge badge-danger">Failed</span>;
                        
                    const duration = h.endTime 
                      ? ((new Date(h.endTime) - new Date(h.startTime)) / 1000).toFixed(1) + 's' 
                      : 'N/A';
                      
                    return (
                      <tr key={h.id}>
                        <td><span style={{ fontWeight: 600, color: '#fff' }}>{h.scriptName}</span></td>
                        <td><span className="badge badge-info">{h.trigger.toUpperCase()}</span></td>
                        <td>{new Date(h.startTime).toLocaleString()}</td>
                        <td>{duration}</td>
                        <td>{statusBadge}</td>
                        <td className="text-right">
                          <button className="btn btn-secondary btn-icon" onClick={() => inspectHistoryLogs(h)}>
                            <Icon name="eye" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // 6. Settings Page View
  const handleSettingsSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        port: parseInt(settings.port),
        separatePorts: settings.separatePorts,
        remotePort: parseInt(settings.remotePort) || 8081,
        username: settings.username,
        remotePin: settings.remotePin
      };
      // Only send password if user typed something new
      if (settings.password && settings.password.trim()) {
        payload.password = settings.password;
      }
      const res = await apiCall('/api/settings', 'POST', payload);
      alert(res.message);
    } catch (err) {
      alert('Failed to save configuration: ' + err.message);
    }
  };

  const copySecureToken = () => {
    navigator.clipboard.writeText(settings.secretToken);
    alert('Security token copied to clipboard.');
  };

  const renderSettingsView = () => {
    return (
      <div className="view-section">
        <div className="section-header">
          <h1 className="text-gradient">Daemon Configuration</h1>
          <p>Modify network sockets, access controls, and background settings.</p>
        </div>

        <div className="settings-layout">
          {/* network options */}
          <div className="glass-card settings-box">
            <h3>Network Setup</h3>
            <p className="settings-desc">Change the web ports bound by Uvicorn. Autostart service requires reloading after changes.</p>

            <form onSubmit={handleSettingsSubmit} className="editor-form margin-top-md">
              <div className="form-group">
                <label>Primary Port (Dashboard)</label>
                <input type="number" required value={settings.port} onChange={e => setSettings({...settings, port: e.target.value})} />
              </div>

              <div className="form-group checkbox-row">
                <label className="checkbox-label font-md">
                  <input type="checkbox" checked={settings.separatePorts} onChange={e => setSettings({...settings, separatePorts: e.target.checked})} /> Run Remote on separate port
                </label>
              </div>

              {settings.separatePorts && (
                <div className="form-group">
                  <label>Dedicated Remote Port</label>
                  <input type="number" required value={settings.remotePort} onChange={e => setSettings({...settings, remotePort: e.target.value})} />
                </div>
              )}

              <div className="form-group">
                <label>Admin Username</label>
                <input type="text" value={settings.username} onChange={e => setSettings({...settings, username: e.target.value})} placeholder="admin" />
              </div>

              <div className="form-group">
                <label>Admin Password</label>
                <input type="password" value={settings.password} onChange={e => setSettings({...settings, password: e.target.value})} placeholder="Leave blank to keep current" />
                <small className="text-muted">Leave blank to keep existing password unchanged.</small>
              </div>

              <div className="form-group">
                <label>Mobile Remote PIN (4-digit)</label>
                <input type="text" maxLength="4" pattern="[0-9]{4}" value={settings.remotePin} onChange={e => setSettings({...settings, remotePin: e.target.value.replace(/\D/g, '').slice(0,4)})} placeholder="e.g. 1234" />
                <small className="text-muted">Used to access the mobile remote panel from your phone.</small>
              </div>

              <div className="form-group">
                <label>Security API Token</label>
                <div className="copy-input-row">
                  <input type="text" readOnly className="bg-card font-mono" value={settings.secretToken} />
                  <button type="button" className="btn btn-secondary btn-icon" onClick={copySecureToken}>
                    <Icon name="copy" />
                  </button>
                </div>
                <small className="text-muted">Internal token used for API authorization. Auto-generated on install.</small>
              </div>

              <button type="submit" className="btn btn-primary margin-top-md">
                Save Configuration
              </button>
            </form>
          </div>

          {/* startup guide */}
          <div className="glass-card settings-box">
            <h3>Autostart Service (systemd)</h3>
            <p className="settings-desc">Keep ServManager running in the background automatically when your Linux server boots up.</p>

            <div className="service-setup-instructions margin-top-md">
              <h5>1. Install command-line helper:</h5>
              <pre className="code-block">curl -sSL https://raw.githubusercontent.com/ServManager/install.sh | bash</pre>
              
              <h5 className="margin-top-sm">2. Service File Configuration (`/etc/systemd/system/servmanager.service`):</h5>
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

              <h5 className="margin-top-sm">3. Start service:</h5>
              <pre className="code-block">{`sudo systemctl daemon-reload
sudo systemctl enable servmanager
sudo systemctl start servmanager`}</pre>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 7. Remote Pad View (Optimized for Mobile/Tablet control)
  const renderRemoteView = () => {
    return (
      <div className="remote-wrapper">
        <header className="remote-header">
          <div className="header-logo">
            <Icon name="server" />
            <div>
              <h1>ServManager Remote</h1>
              <span className="hostname-display">{stats.hostname} ({stats.platform})</span>
            </div>
          </div>
          <div className="header-status">
            <span className="badge badge-success">
              <span className="pulse-dot green" style={{ width: 6, height: 6, marginRight: 4 }}></span> Connected
            </span>
            <button
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', marginLeft: '0.5rem' }}
              onClick={handleLogout}
              title="Lock remote panel"
            >
              <Icon name="key" /> Lock
            </button>
          </div>
        </header>

        <main className="remote-grid">
          {remoteWidgets.length === 0 ? (
            <div className="grid-placeholder">
              <Icon name="layout" />
              <p>No widgets found. Configure layouts from the Dashboard Designer settings.</p>
            </div>
          ) : (
            [...remoteWidgets].sort((a,b) => a.position - b.position).map(w => {
              // Retrieve bound script status if indicator
              const script = scripts.find(s => s.id === w.scriptId);
              const status = script?.lastStatus || '';
              const statusClass = status === 'success' ? 'success' : status === 'failure' ? 'danger' : status === 'warn' ? 'warn' : 'inactive';
              
              const isRunning = currentRunId && script && currentRunId.includes(script.id) && terminalStatus === 'Running';

              if (w.type === 'button') {
                return (
                  <div key={w.id} className={`remote-widget size-${w.size} accent-${w.color} ${isRunning ? 'running' : ''}`} onClick={() => !isRunning && runScript(script, 'remote')}>
                    <div className="widget-icon-wrap"><Icon name={w.icon} /></div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div className="widget-title-display">{w.title}</div>
                      <div className="widget-sub-display">Tap to Trigger</div>
                    </div>
                  </div>
                );
              } else if (w.type === 'indicator') {
                return (
                  <div key={w.id} className={`remote-widget size-${w.size} accent-${w.color}`}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div className={`indicator-ring ${statusClass}`}></div>
                      <div className="widget-icon-wrap"><Icon name={w.icon} /></div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div className="widget-title-display">{w.title}</div>
                      <div className="widget-sub-display">{status ? status.toUpperCase() : 'UNKNOWN'}</div>
                    </div>
                  </div>
                );
              } else if (w.type === 'metric') {
                let displayVal = '--';
                if (w.metricType === 'cpu') displayVal = `${Math.round(stats.cpu)}%`;
                else if (w.metricType === 'ram') displayVal = `${Math.round(stats.ram.pct)}%`;
                else if (w.metricType === 'disk') displayVal = `${Math.round(stats.disk.pct)}%`;
                else if (w.metricType === 'uptime') displayVal = formatUptime(stats.uptime);

                return (
                  <div key={w.id} className={`remote-widget size-${w.size} accent-${w.color}`}>
                    <div className="widget-icon-wrap"><Icon name={w.icon} /></div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                      <div className="metric-number-display">{displayVal}</div>
                      <div className="widget-title-display">{w.title}</div>
                    </div>
                  </div>
                );
              }
              return null;
            })
          )}
        </main>

        {/* Console Slide up drawer */}
        <div className={`console-drawer ${remoteDrawerOpen ? '' : 'hidden'}`}>
          <div className="drawer-header">
            <div className="drawer-title">Console Output: {remoteDrawerTitle}</div>
            <div className="drawer-actions">
              {terminalStatus === 'Running' && (
                <button className="btn btn-danger btn-cancel-drawer" onClick={cancelExecution}>
                  <Icon name="stop" /> Kill Task
                </button>
              )}
              <button className="btn-close-drawer" onClick={() => setRemoteDrawerOpen(false)}>&times;</button>
            </div>
          </div>
          <div className="drawer-body">
            {terminalLogs.map((line, idx) => (
              <div key={idx} className={`terminal-line ${line.includes('[system-err]') || line.includes('[stderr]') ? 'error' : line.includes('===') ? 'system' : ''}`}>
                {line.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')}
              </div>
            ))}
            <div ref={terminalBottomRef} />
          </div>
        </div>
      </div>
    );
  };

  // ----------------------------------------------------
  // MAIN SITE SHELL RENDERING
  // ----------------------------------------------------
  if (showAuthModal) {
    return (
      <div className="modal-overlay">
        <div className="glass-card modal-content auth-card">
          <h2 className="text-gradient">ServManager</h2>
          <p>Sign in with your admin credentials to access the dashboard.</p>
          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              value={authUsername}
              onChange={e => setAuthUsername(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAuthenticate()}
              placeholder="admin"
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={authPassword}
              onChange={e => setAuthPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAuthenticate()}
              placeholder="••••••••"
            />
          </div>
          {authError && <p style={{ color: 'var(--status-danger)', fontSize: '0.88rem', marginBottom: '0.5rem' }}>{authError}</p>}
          <button className="btn btn-primary" onClick={handleAuthenticate}>Sign In</button>
        </div>
      </div>
    );
  }

  if (isRemoteRoute) {
    if (showRemotePin) {
      return (
        <div className="pin-overlay">
          <div className="pin-card">
            <h2>Remote Access</h2>
            <p className="pin-subtitle">Enter your 4-digit PIN to continue</p>
            <div className="pin-display">
              {[0,1,2,3].map(i => (
                <div key={i} className={`pin-dot${i < pinValue.length ? (pinShake ? ' error' : ' filled') : ''}`} />
              ))}
            </div>
            <div className="pin-keypad">
              {[1,2,3,4,5,6,7,8,9].map(n => (
                <button key={n} className="pin-key" onClick={() => handlePinKey(String(n))}>{n}</button>
              ))}
              <button className="pin-key pin-key-zero" onClick={() => handlePinKey('0')}>0</button>
              <button className="pin-key pin-key-del" onClick={handlePinDelete}>⌫</button>
            </div>
            {pinError && <p className="pin-error-msg">{pinError}</p>}
          </div>
        </div>
      );
    }
    return renderRemoteView();
  }

  return (
    <div className="dashboard-container">
      {/* Sidebar navigation */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-logo">
            <Icon name="server" />
          </div>
          <div className="brand-text">
            <h2>ServManager</h2>
            <span className="badge badge-success">Python FastAPI</span>
          </div>
        </div>

        <nav className="sidebar-menu">
          <button className={`menu-item ${view === 'stats' ? 'active' : ''}`} onClick={() => handleNavClick('stats')}>
            <Icon name="stats" /> Diagnostics
          </button>
          <button className={`menu-item ${view === 'scripts' ? 'active' : ''}`} onClick={() => handleNavClick('scripts')}>
            <Icon name="terminal" /> Scripts
          </button>
          <button className={`menu-item ${view === 'workflows' ? 'active' : ''}`} onClick={() => handleNavClick('workflows')}>
            <Icon name="flow" /> Workflows
          </button>
          <button className={`menu-item ${view === 'remote-designer' ? 'active' : ''}`} onClick={() => handleNavClick('remote-designer')}>
            <Icon name="layout" /> Designer
          </button>
          <button className={`menu-item ${view === 'history' ? 'active' : ''}`} onClick={() => handleNavClick('history')}>
            <Icon name="activity" /> Run History
          </button>
          <button className={`menu-item ${view === 'settings' ? 'active' : ''}`} onClick={() => handleNavClick('settings')}>
            <Icon name="settings" /> Settings
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="server-node-info">
            <div className="node-icon"><Icon name="activity" /></div>
            <div className="node-detail">
              <span className="node-name">{stats.hostname}</span>
              <span className="node-ip">uptime: {formatUptime(stats.uptime)}</span>
            </div>
          </div>
          <div className="sidebar-logout">
            <button className="btn btn-logout" onClick={handleLogout}>
              <Icon name="logout" /> Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Admin Contents */}
      <main className="main-content">
        {view === 'stats' && renderStatsView()}
        {view === 'scripts' && renderScriptsView()}
        {view === 'workflows' && renderWorkflowsView()}
        {view === 'remote-designer' && renderRemoteDesigner()}
        {view === 'history' && renderHistoryView()}
        {view === 'settings' && renderSettingsView()}
      </main>

      {/* Spawning Terminal Dialog */}
      {terminalOpen && (
        <div className="modal-overlay">
          <div className="glass-card modal-content terminal-card">
            <div className="terminal-header">
              <div className="terminal-dots">
                <span className="dot red"></span>
                <span className="dot yellow"></span>
                <span className="dot green"></span>
              </div>
              <div className="terminal-title">{terminalTitle}</div>
              <button className="btn-close" onClick={() => setTerminalOpen(false)}>&times;</button>
            </div>
            <div className="terminal-body">
              {terminalLogs.map((line, idx) => (
                <div key={idx} className={`terminal-line ${line.includes('[system-err]') || line.includes('[stderr]') ? 'error' : line.includes('===') || line.includes('[Step') ? 'system' : ''}`}>
                  {line.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')}
                </div>
              ))}
              <div ref={terminalBottomRef} />
            </div>
            <div className="terminal-footer">
              <div className="status-indicator-wrap">
                <span className={`pulse-dot ${terminalStatus === 'Running' || terminalStatus === 'Spawning' ? 'green' : 'red'}`}></span>
                <span>{terminalStatus} {terminalStatus.startsWith('Finished') ? `(Code: ${terminalExitCode})` : ''}</span>
              </div>
              {(terminalStatus === 'Running' || terminalStatus === 'Spawning') && (
                <button className="btn btn-danger" onClick={cancelExecution}>
                  <Icon name="stop" /> Abort Task
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

