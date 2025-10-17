/**
 * Version Badge Component for Docusaurus
 *
 * Display version information from hook frontmatter as badges.
 * Place in src/components/VersionBadge.jsx in your Docusaurus site.
 *
 * Usage in custom page:
 * import VersionBadge from '@site/src/components/VersionBadge';
 * <VersionBadge version="2.0.0" />
 */

import React from 'react';

export default function VersionBadge({ version, deprecated, api, internal }) {
  return (
    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
      {version && (
        <span
          style={{
            backgroundColor: '#2e8555',
            color: 'white',
            padding: '4px 12px',
            borderRadius: '12px',
            fontSize: '0.85rem',
            fontWeight: '500',
          }}
        >
          Since {version}
        </span>
      )}

      {deprecated && (
        <span
          style={{
            backgroundColor: '#f5a623',
            color: 'white',
            padding: '4px 12px',
            borderRadius: '12px',
            fontSize: '0.85rem',
            fontWeight: '500',
          }}
        >
          ⚠️ Deprecated
        </span>
      )}

      {api && (
        <span
          style={{
            backgroundColor: '#00a86b',
            color: 'white',
            padding: '4px 12px',
            borderRadius: '12px',
            fontSize: '0.85rem',
            fontWeight: '500',
          }}
        >
          ✅ Public API
        </span>
      )}

      {internal && (
        <span
          style={{
            backgroundColor: '#9b59b6',
            color: 'white',
            padding: '4px 12px',
            borderRadius: '12px',
            fontSize: '0.85rem',
            fontWeight: '500',
          }}
        >
          🔒 Internal
        </span>
      )}
    </div>
  );
}
