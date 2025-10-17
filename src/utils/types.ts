export interface HookFile {
  file: string;
  line: number;
}

/**
 * PHPDoc Tag Interfaces
 * Based on official PHPDoc documentation: https://docs.phpdoc.org/guide/guides/docblocks.html
 */

// Simple text tags
export interface SimpleTag {
  content: string;
}

// Reference tags (@see, @uses, @link)
export interface ReferenceTag {
  reference: string;
  description?: string;
}

// Type-based tags (@var, @global)
export interface TypeTag {
  types: string[];
  variable?: string;
  description?: string;
}

// Parameter tag (@param)
export interface ParamTag {
  name: string;
  types: string[];
  description?: string;
}

// Return tag (@return)
export interface ReturnTag {
  types: string[];
  description?: string;
}

// Throws tag (@throws)
export interface ThrowsTag {
  types: string[];
  description?: string;
}

// Method tag (@method)
export interface MethodTag {
  static?: boolean;
  returnTypes?: string[];
  name: string;
  parameters?: Array<{
    name: string;
    types?: string[];
  }>;
  description?: string;
}

// Property tags (@property, @property-read, @property-write)
export interface PropertyTag {
  types: string[];
  name: string;
  description?: string;
}

// Example tag (@example)
export interface ExampleTag {
  location?: string;
  startLine?: number;
  numberOfLines?: number;
  description?: string;
  content?: string;
}

// Since tag (@since)
export interface SinceTag {
  version: string;
  description?: string;
}

// License tag (@license)
export interface LicenseTag {
  url?: string;
  name: string;
}

// Author tag (@author)
export interface AuthorTag {
  name: string;
  email?: string;
}

/**
 * Complete Hook Documentation structure with all official PHPDoc tags
 */
export interface HookDoc {
  // Core documentation
  description?: string;
  long_description?: string;
  long_description_html?: string;

  // Function/Method tags
  params?: ParamTag[];
  return?: ReturnTag;
  throws?: ThrowsTag[];

  // Class/Object tags
  method?: MethodTag[];
  property?: PropertyTag[];
  propertyRead?: PropertyTag[];
  propertyWrite?: PropertyTag[];

  // Type tags
  var?: TypeTag;
  global?: TypeTag[];

  // Version/Status tags
  since?: SinceTag[];
  deprecated?: SimpleTag;
  version?: SimpleTag;

  // Code organization tags
  package?: SimpleTag;
  subpackage?: SimpleTag;
  category?: SimpleTag;

  // Visibility/Access tags
  api?: SimpleTag;
  internal?: SimpleTag;
  ignore?: SimpleTag;

  // Reference tags
  see?: ReferenceTag[];
  uses?: ReferenceTag[];
  link?: ReferenceTag[];

  // Code display tags
  example?: ExampleTag[];
  filesource?: SimpleTag;
  source?: ExampleTag[];

  // Legal/Metadata tags
  author?: AuthorTag[];
  copyright?: SimpleTag;
  license?: LicenseTag;

  // Development tags
  todo?: SimpleTag[];

  // Generic fallback for any unrecognized tags
  tags?: Array<{
    name: string;
    content: string;
    types?: string[];
    variable?: string;
  }>;
}

export interface Hook {
  id: string;
  name: string;
  type: string;
  file: string;
  files?: HookFile[];
  line?: number;
  doc: HookDoc;
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
    doc?: {
      description?: string;
      long_description?: string;
      long_description_html?: string;
      tags?: Array<{
        name: string;
        content: string;
        types?: string[];
        variable?: string;
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
}

export interface HookCollectorConfig {
  input: string;
  outputDir: string;
  ignoreFiles: string[];
  ignoreHooks: string[];
}

export interface CommandOptions {
  config?: string;
  verbose?: boolean;
}
