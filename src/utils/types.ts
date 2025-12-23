export interface HookFile {
  file: string;
  line: number;
}

export interface Hook {
  id: string;
  name: string;
  type: string;
  file: string;
  files?: HookFile[];
  line?: number;
  /**
   * Dynamic hook name modifiers (e.g., form_id, field_id, entry_id).
   * Present when using gf_apply_filters() or gf_do_action() with array syntax.
   * Example: gf_apply_filters( array( 'gform_pre_render', $form_id ), ... )
   * would have modifiers: ['$form_id']
   */
  modifiers?: string[];
  doc: {
    description?: string;
    long_description?: string;
    long_description_html?: string;
    since?: Array<{
      name: string;
      content: string;
      description?: string;
    }>;
    tags?: Array<{
      name: string;
      content: string;
      types?: string[];
      variable?: string;
    }>;
    params?: {
      name: string;
      type: string;
      description: string;
      types?: {
        name: string;
        type: string;
        description: string;
      }[];
    }[];
    return?: {
      type: string;
      description: string;
    };
    uses?: Array<{
      name: string;
      description: string;
    }>;
    see?: Array<{
      reference: string;   // URL or code reference from @see
      description: string; // Description text
    }>;
    link?: Array<{
      url: string;         // URL from @link
      description: string; // Link text/description
    }>;
    deprecated?: Array<{
      version: string;     // Semantic version when deprecated
      description: string; // Reason/alternative from @deprecated
    }>;
    examples?: Array<{
      description: string; // Optional description before code
      code: string;        // Code block content from @example
    }>;
  };
  source: string;
}

export interface HookCollection {
  actions: Hook[];
  filters: Hook[];
}

export interface PHPRunnerOptions {
  input: string;
  output: string;
  ignoreFiles?: string[];
  ignoreHooks?: string[];
}

export interface PHPResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface RawHookData {
  hooks: Array<{
    name: string;
    type: string;
    file: string;
    files?: HookFile[];
    line?: number;
    modifiers?: string[];
    doc?: {
      description?: string;
      long_description?: string;
      long_description_html?: string;
      tags?: Array<{
        name: string;
        content: string;
        types?: string[];
        variable?: string;
        refers?: string;  // For @see tags - contains the URL or reference
        link?: string;    // For @link tags - contains the URL
      }>;
    };
    source: string;
  }>;
}

export interface RawHookCollection {
  actions: RawHookData;
  filters: RawHookData;
}

export interface MarkdownGeneratorConfig {
  outputDir: string;
}

export interface DocusaurusConfig {
  title: string;
  tagline?: string;
  url: string;
  baseUrl: string;
  repoUrl: string;
  githubSourceCodeUrl?: string;
  organizationName?: string;
  projectName?: string;
  templatesDir?: string;
  staticAssetsDir?: string;
  customCss?: string;
  themeConfig?: {
    navbar?: {
      title?: string;
      logo?: {
        alt?: string;
        src?: string;
      };
      items?: Array<{
        to: string;
        label: string;
        position?: 'left' | 'right';
      }>;
    };
    footer?: {
      style?: 'dark' | 'light';
      links?: Array<{
        title: string;
        items: Array<{
          label: string;
          to: string;
        }>;
      }>;
      copyright?: string;
    };
  };
}

export interface WPHooksDocConfig {
  // Plugin configuration
  input: string;
  ignoreFiles: string[];
  ignoreHooks: string[];

  // Docs configuration
  outputDir: string;

  // Docusaurus configuration
  title: string;
  tagline?: string;
  url: string;
  baseUrl: string;
  repoUrl: string;
  githubSourceCodeUrl?: string;
  organizationName?: string;
  projectName?: string;
  templatesDir?: string;
  footerStyle?: 'dark' | 'light';
  footerCopyright?: string;

  // Output configuration
  clean?: boolean;
  skipBuild?: boolean;

  // Hook ID configuration
  /**
   * Character to replace slashes with in hook IDs.
   * Set to '-' to convert 'example/hook' to 'example-hook'.
   * Set to '' (empty string) to strip slashes entirely (default for backwards compatibility).
   * @default ''
   */
  hookIdSlashReplacement?: string;
}

export interface HookCollectorConfig {
  input: string;
  outputDir: string;
  ignoreFiles: string[];
  ignoreHooks: string[];
  /**
   * Character to replace slashes with in hook IDs.
   * @default ''
   */
  hookIdSlashReplacement?: string;
}

export interface CommandOptions {
  config?: string;
  verbose?: boolean;
}
