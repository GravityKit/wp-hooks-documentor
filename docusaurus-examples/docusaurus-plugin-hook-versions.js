/**
 * Docusaurus Plugin: Hook Versions
 *
 * Automatically reads frontmatter from hook documentation and creates:
 * - Version-based navigation pages
 * - "What's New" pages for each version
 * - Deprecation warning pages
 * - API vs Internal hook listings
 *
 * Installation:
 * 1. Place this file in your Docusaurus site's plugins directory
 * 2. Add to docusaurus.config.js:
 *    plugins: [
 *      './plugins/docusaurus-plugin-hook-versions',
 *    ]
 *
 * The plugin will create these pages:
 * - /hooks/by-version - All hooks organized by version
 * - /hooks/whats-new/[version] - New hooks in each version
 * - /hooks/deprecated - List of deprecated hooks
 * - /hooks/api - Public API hooks only
 */

module.exports = function (context, options) {
  return {
    name: 'docusaurus-plugin-hook-versions',

    async contentLoaded({ content, actions }) {
      const { createData, addRoute } = actions;

      // Get all hook pages from the docs
      const hooks = await context.globalData['docusaurus-plugin-content-docs']?.default?.docs || [];

      // Organize hooks by version
      const hooksByVersion = {};
      const deprecatedHooks = [];
      const apiHooks = [];
      const internalHooks = [];

      hooks.forEach((doc) => {
        const { frontMatter } = doc;

        // Organize by version
        if (frontMatter.since) {
          if (!hooksByVersion[frontMatter.since]) {
            hooksByVersion[frontMatter.since] = [];
          }
          hooksByVersion[frontMatter.since].push(doc);
        }

        // Collect deprecated hooks
        if (frontMatter.deprecated) {
          deprecatedHooks.push(doc);
        }

        // Collect API hooks
        if (frontMatter.api) {
          apiHooks.push(doc);
        }

        // Collect internal hooks
        if (frontMatter.internal) {
          internalHooks.push(doc);
        }
      });

      // Create data files
      const hooksData = await createData(
        'hooks-by-version.json',
        JSON.stringify(hooksByVersion, null, 2)
      );

      const deprecatedData = await createData(
        'deprecated-hooks.json',
        JSON.stringify(deprecatedHooks, null, 2)
      );

      const apiData = await createData(
        'api-hooks.json',
        JSON.stringify(apiHooks, null, 2)
      );

      // Create routes
      addRoute({
        path: '/hooks/by-version',
        component: '@site/src/components/HooksByVersion',
        modules: {
          hooks: hooksData,
        },
        exact: true,
      });

      addRoute({
        path: '/hooks/deprecated',
        component: '@site/src/components/DeprecatedHooks',
        modules: {
          hooks: deprecatedData,
        },
        exact: true,
      });

      addRoute({
        path: '/hooks/api',
        component: '@site/src/components/ApiHooks',
        modules: {
          hooks: apiData,
        },
        exact: true,
      });

      // Create individual "What's New" pages for each version
      Object.keys(hooksByVersion).forEach(async (version) => {
        const versionData = await createData(
          `whats-new-${version}.json`,
          JSON.stringify(hooksByVersion[version], null, 2)
        );

        addRoute({
          path: `/hooks/whats-new/${version}`,
          component: '@site/src/components/WhatsNewInVersion',
          modules: {
            hooks: versionData,
            version,
          },
          exact: true,
        });
      });
    },
  };
};
