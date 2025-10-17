/**
 * Hooks by Version Component
 *
 * Displays all hooks organized by the version they were introduced.
 * Place in src/components/HooksByVersion.jsx in your Docusaurus site.
 *
 * This component is automatically populated by the docusaurus-plugin-hook-versions plugin.
 */

import React, { useState } from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import styles from './HooksByVersion.module.css';

export default function HooksByVersion({ hooks }) {
  const [selectedVersion, setSelectedVersion] = useState('all');
  const versions = Object.keys(hooks).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));

  const filteredHooks = selectedVersion === 'all' ? hooks : { [selectedVersion]: hooks[selectedVersion] };

  return (
    <Layout title="Hooks by Version" description="Browse WordPress hooks organized by version">
      <div className="container margin-vert--lg">
        <h1>Hooks by Version</h1>
        <p>Browse hooks by the version they were introduced.</p>

        {/* Version Filter */}
        <div className="margin-bottom--lg">
          <label htmlFor="version-select" style={{ marginRight: '10px', fontWeight: 'bold' }}>
            Filter by Version:
          </label>
          <select
            id="version-select"
            value={selectedVersion}
            onChange={(e) => setSelectedVersion(e.target.value)}
            style={{
              padding: '8px 16px',
              borderRadius: '4px',
              border: '1px solid #ccc',
              fontSize: '16px',
            }}
          >
            <option value="all">All Versions</option>
            {versions.map((version) => (
              <option key={version} value={version}>
                Version {version}
              </option>
            ))}
          </select>
        </div>

        {/* Hooks List */}
        {Object.keys(filteredHooks)
          .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
          .map((version) => (
            <div key={version} className="margin-bottom--xl">
              <h2>Version {version}</h2>
              <p className="text--secondary">
                {filteredHooks[version].length} hook{filteredHooks[version].length !== 1 ? 's' : ''} added
              </p>

              <div className="row">
                {filteredHooks[version].map((hook) => (
                  <div key={hook.id} className="col col--6 margin-bottom--md">
                    <div
                      style={{
                        padding: '16px',
                        border: '1px solid var(--ifm-color-emphasis-300)',
                        borderRadius: '8px',
                        height: '100%',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                        <h3 style={{ margin: 0, fontSize: '1.1rem' }}>
                          <Link to={hook.permalink}>{hook.title}</Link>
                        </h3>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {hook.frontMatter.deprecated && (
                            <span
                              style={{
                                backgroundColor: '#f5a623',
                                color: 'white',
                                padding: '2px 8px',
                                borderRadius: '8px',
                                fontSize: '0.75rem',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              Deprecated
                            </span>
                          )}
                          {hook.frontMatter.api && (
                            <span
                              style={{
                                backgroundColor: '#00a86b',
                                color: 'white',
                                padding: '2px 8px',
                                borderRadius: '8px',
                                fontSize: '0.75rem',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              API
                            </span>
                          )}
                        </div>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--ifm-color-emphasis-700)' }}>
                        {hook.description || 'No description available'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
      </div>
    </Layout>
  );
}
