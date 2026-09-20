import { marked } from 'marked';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import hardware from '../../docs/HARDWARE.md?raw';
import spec from '../../docs/BUTTON_STANDARD.md?raw';
import '../styles/prose.css';

export function Standard({ doc = 'standard' }: { doc?: 'standard' | 'hardware' }) {
  const html = useMemo(() => marked.parse(doc === 'hardware' ? hardware : spec, { async: false }), [doc]);
  return (
    <div className="prose-page">
      <header className="setup__head">
        <Link to="/" className="brand"><span className="brand__dot" /><span>Pax <b>Buttonica</b></span></Link>
        <span style={{ display: 'flex', gap: 8 }}>
          <Link to={doc === 'hardware' ? '/standard' : '/hardware'} className="btn btn--sm btn--ghost">{doc === 'hardware' ? 'Button standard' : 'Build guide'}</Link>
          <Link to="/demo" className="btn btn--sm">Open the simulator</Link>
        </span>
      </header>
      {/* These are our own files, bundled at build time — not user input. */}
      <article className="prose" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
