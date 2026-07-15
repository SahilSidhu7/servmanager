import { useState, useEffect, useRef } from 'react';
import { Icon } from './icons.jsx';
import { wsUrl } from './api.js';

// ─────────────────────────────────────────────────────────
// Toasts
// ─────────────────────────────────────────────────────────
export function ToastContainer({ toasts, onRemove }) {
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <Icon name={t.type === 'success' ? 'check' : t.type === 'error' ? 'alert' : 'info'} />
          <span>{t.message}</span>
          <button className="toast-close" onClick={() => onRemove(t.id)} aria-label="Dismiss">&times;</button>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Modal shell
// ─────────────────────────────────────────────────────────
export function Modal({ title, onClose, children, wide = false, footer = null }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className={`modal-card${wide ? ' modal-wide' : ''}`} role="dialog" aria-label={title}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Confirm dialog (replaces window.confirm)
// ─────────────────────────────────────────────────────────
export function ConfirmDialog({ confirm, onClose }) {
  if (!confirm) return null;
  return (
    <Modal title={confirm.title} onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-danger" onClick={() => { confirm.onConfirm(); onClose(); }}>
            {confirm.action || 'Delete'}
          </button>
        </>
      }>
      <p className="confirm-text">{confirm.message}</p>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────
// Resource meter — rack-style segmented bar
// ─────────────────────────────────────────────────────────
const SEGMENTS = 24;

export function Meter({ label, icon, pct, detail }) {
  const lit = Math.round((Math.min(100, Math.max(0, pct)) / 100) * SEGMENTS);
  const level = pct >= 90 ? 'danger' : pct >= 75 ? 'warn' : 'ok';
  return (
    <div className="meter-card card">
      <div className="meter-head">
        <span className="meter-label"><Icon name={icon} /> {label}</span>
        <span className={`meter-value level-${level}`}>{Math.round(pct)}<small>%</small></span>
      </div>
      <div className="meter-track" role="img" aria-label={`${label} at ${Math.round(pct)} percent`}>
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <span key={i} className={`meter-seg${i < lit ? ` on level-${level}` : ''}`} />
        ))}
      </div>
      <div className="meter-detail">{detail}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Code editor with line numbers
// ─────────────────────────────────────────────────────────
export function CodeEditor({ value, onChange, placeholder, minHeight = '280px' }) {
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
    <div className="code-editor-wrap" style={{ minHeight }}>
      <div className="code-editor-gutter" ref={gutterRef} aria-hidden="true">
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
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// SSH terminal modal (xterm.js, lazy-loaded)
// ─────────────────────────────────────────────────────────
export function SshTerminalModal({ conn, onClose }) {
  const containerRef = useRef(null);
  const cleanupRef = useRef(null);
  const [status, setStatus] = useState('connecting');

  useEffect(() => {
    if (!containerRef.current) return;

    const setup = async () => {
      const { Terminal } = await import('@xterm/xterm');
      const { FitAddon } = await import('@xterm/addon-fit');

      const term = new Terminal({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: 'ui-monospace, "Cascadia Code", Consolas, monospace',
        theme: {
          background: '#0e0d0c',
          foreground: '#e6e0d6',
          cursor: '#d96a20',
          selectionBackground: 'rgba(217, 106, 32, 0.3)',
        },
        convertEol: true,
        scrollback: 5000,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(containerRef.current);
      fitAddon.fit();

      const ws = new WebSocket(wsUrl(`/ws/ssh/${conn.id}`));

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
        setStatus(s => (s === 'error' ? s : 'closed'));
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
        } catch { /* container gone mid-resize */ }
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
  }, [conn.id]);

  const statusCls = status === 'connected' ? 'badge-ok' : status === 'connecting' ? 'badge-warn' : 'badge-danger';

  return (
    <div className="ssh-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="ssh-terminal-card">
        <div className="ssh-terminal-header">
          <div className="ssh-terminal-info">
            <Icon name="ssh" />
            <span className="ssh-conn-name">{conn.name}</span>
            <span className="mono muted">{conn.username}@{conn.host}:{conn.port || 22}</span>
            <span className={`badge ${statusCls}`}>{status}</span>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close terminal"><Icon name="close" /></button>
        </div>
        <div ref={containerRef} className="ssh-terminal-body" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Terminal log lines (shared by run modal + remote drawer)
// ─────────────────────────────────────────────────────────
export function LogLines({ lines, bottomRef }) {
  return (
    <>
      {lines.map((line, i) => (
        <div key={i} className={`terminal-line ${line.includes('[system-err]') || line.includes('[stderr]') ? 'error' : line.includes('===') ? 'system' : ''}`}>
          {/* eslint-disable-next-line no-control-regex -- strip ANSI escapes */}
          {line.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')}
        </div>
      ))}
      <div ref={bottomRef} />
    </>
  );
}
