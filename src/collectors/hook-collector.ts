import { PHPRunner } from './php-runner';
import {
  HookCollection,
  Hook,
  RawHookCollection,
  RawHookData,
  HookCollectorConfig,
  ParamTag,
  ReturnTag,
  ThrowsTag,
  SinceTag,
  SimpleTag,
  ReferenceTag,
  TypeTag,
  MethodTag,
  PropertyTag,
  ExampleTag,
  LicenseTag,
  AuthorTag,
  HookDoc,
} from '../utils/types';
import fsExtra from 'fs-extra';
import path from 'path';
import { MESSAGES } from '../utils/messages';

const { readJSON, ensureDir } = fsExtra;

export class HookCollector {
  private phpRunner: PHPRunner;

  constructor(private config: HookCollectorConfig) {
    this.phpRunner = new PHPRunner();
  }

  async collect(): Promise<HookCollection> {
    try {
      console.log(MESSAGES.COLLECTING_HOOKS);

      // Ensure output directory exists
      await ensureDir(this.config.outputDir);

      // Generate hooks using wp-hooks/generator
      await this.phpRunner.generateHooks({
        input: this.config.input,
        output: path.join(this.config.outputDir, '.hooks-temp'),
        ignoreFiles: this.config.ignoreFiles,
        ignoreHooks: this.config.ignoreHooks,
      });

      console.log(MESSAGES.PROCESSING_HOOKS);

      // Read and parse the generated files
      const actionsFile = path.join(this.config.outputDir, '.hooks-temp/actions.json');
      const filtersFile = path.join(this.config.outputDir, '.hooks-temp/filters.json');

      const [actions, filters] = await Promise.all([readJSON(actionsFile), readJSON(filtersFile)]);

      // Transform and deduplicate hooks
      const collection = this.transformHooks({ actions, filters });

      // Clean JSON files
      await fsExtra.remove(path.join(this.config.outputDir, '.hooks-temp'));

      console.log(MESSAGES.HOOKS_GENERATED);

      return collection;
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(`${MESSAGES.ERROR_PROCESS_HOOKS}: ${error.message}`);
      }
      throw new Error(MESSAGES.ERROR_PROCESS_HOOKS);
    }
  }

  private transformHooks(rawData: RawHookCollection): HookCollection {
    // Helper function to merge hooks with the same name and transform them.
    const prepareHooks = (hooks: RawHookData['hooks']): Hook[] => {
      const hookMap = new Map<string, RawHookData['hooks'][0][]>();

      // Group hooks by name
      hooks.forEach((hook) => {
        const hookId = this.getHookId(this.escapeHookName(hook.name));
        if (!hookMap.has(hookId)) {
          hookMap.set(hookId, []);
        }
        hookMap.get(hookId)?.push(hook);
      });

      // Merge and transform hooks
      return Array.from(hookMap.entries()).map(([_, hooks]) => {
        if (hooks.length === 1) {
          return this.transformHook(hooks[0]);
        }

        // Merge multiple hooks with the same name
        const mergedHook = { ...hooks[0] };

        // Collect sources of all hooks.
        mergedHook.files = [];
        hooks.forEach((h) => {
          const file = {
            file: h.file || '',
            line: h.line || 0,
          };
          mergedHook.files?.push(file);
        });

        return this.transformHook(mergedHook);
      });
    };

    return {
      actions: prepareHooks(rawData.actions.hooks),
      filters: prepareHooks(rawData.filters.hooks),
    };
  }

  private escapeHookName(hookName: string): string {
    let escapedHookName = hookName;
    /**
     * Replace PHP-style interpolations with {$var}_suffix
     * Example:
     * 'woocommerce_analytics_' . $field . '_' . $context
     * becomes
     * 'woocommerce_analytics_{$field}_$context'
     */
    escapedHookName = hookName.replace(
      /['"]\s*\.\s*(\$(?:[a-zA-Z_]\w*)(?:->\w+|\[[^\]]+\]|\(\))*((?:->\w+|\[[^\]]+\]|\(\)))*)\s*\.\s*['"]?_?([a-zA-Z0-9_]*)/g,
      (_, variable, rest, suffix) => `{${variable}${rest || ''}}${suffix ? `_${suffix}` : ''}`
    );

    /**
     * Handle trailing .$var without suffix
     * Example:
     * 'woocommerce_analytics_' . $field
     * becomes
     * 'woocommerce_analytics_{$field}'
     */
    escapedHookName = hookName.replace(
      /['"]\s*\.\s*(\$(?:[a-zA-Z_]\w*)(?:->\w+|\[[^\]]+\]|\(\))*((?:->\w+|\[[^\]]+\]|\(\)))*)/g,
      (_, variable, rest) => `{${variable}${rest || ''}}`
    );

    /**
     * Remove quotes from hook name
     */
    escapedHookName = hookName.replace(/['"]/g, '');

    return escapedHookName;
  }

  private getHookId(hookName: string): string {
    return hookName
      .replace(/[^a-zA-Z0-9\-_.~]/g, '')
      .replace(/^__/, '')
      .replace(/^_/, '');
  }

  /**
   * Helper methods for parsing PHPDoc tags
   */

  private parseParamTags(tags: Array<{ name: string; content: string; types?: string[]; variable?: string }>): ParamTag[] {
    return tags
      .filter((tag) => tag.name === 'param')
      .map((tag) => ({
        name: tag.variable || '',
        types: tag.types || [],
        description: tag.content || '',
      }));
  }

  private parseReturnTag(tags: Array<{ name: string; content: string; types?: string[]; variable?: string }>): ReturnTag | undefined {
    const returnTags = tags.filter((tag) => tag.name === 'return');
    if (returnTags.length === 0) return undefined;

    const tag = returnTags[0];
    return {
      types: tag.types || [],
      description: tag.content || '',
    };
  }

  private parseThrowsTags(tags: Array<{ name: string; content: string; types?: string[]; variable?: string }>): ThrowsTag[] {
    return tags
      .filter((tag) => tag.name === 'throws')
      .map((tag) => ({
        types: tag.types || [],
        description: tag.content || '',
      }));
  }

  private parseSinceTags(tags: Array<{ name: string; content: string; types?: string[]; variable?: string }>): SinceTag[] {
    return tags
      .filter((tag) => tag.name === 'since')
      .map((tag) => ({
        version: tag.content?.split(' ')[0] || '',
        description: tag.content?.split(' ').slice(1).join(' ') || '',
      }));
  }

  private parseSimpleTag(tags: Array<{ name: string; content: string; types?: string[]; variable?: string }>, tagName: string): SimpleTag | undefined {
    const filtered = tags.filter((tag) => tag.name === tagName);
    if (filtered.length === 0) return undefined;
    return { content: filtered[0].content || '' };
  }

  private parseSimpleTags(tags: Array<{ name: string; content: string; types?: string[]; variable?: string }>, tagName: string): SimpleTag[] {
    return tags
      .filter((tag) => tag.name === tagName)
      .map((tag) => ({ content: tag.content || '' }));
  }

  private parseReferenceTags(tags: Array<{ name: string; content: string; types?: string[]; variable?: string }>, tagName: string): ReferenceTag[] {
    return tags
      .filter((tag) => tag.name === tagName)
      .map((tag) => {
        // Content format: "reference description"
        const parts = (tag.content || '').split(' ');
        return {
          reference: parts[0] || '',
          description: parts.slice(1).join(' ') || undefined,
        };
      });
  }

  private parseVarTag(tags: Array<{ name: string; content: string; types?: string[]; variable?: string }>): TypeTag | undefined {
    const varTags = tags.filter((tag) => tag.name === 'var');
    if (varTags.length === 0) return undefined;

    const tag = varTags[0];
    return {
      types: tag.types || [],
      variable: tag.variable,
      description: tag.content || '',
    };
  }

  private parseGlobalTags(tags: Array<{ name: string; content: string; types?: string[]; variable?: string }>): TypeTag[] {
    return tags
      .filter((tag) => tag.name === 'global')
      .map((tag) => ({
        types: tag.types || [],
        variable: tag.variable,
        description: tag.content || '',
      }));
  }

  private parseMethodTags(tags: Array<{ name: string; content: string; types?: string[]; variable?: string }>): MethodTag[] {
    return tags
      .filter((tag) => tag.name === 'method')
      .map((tag) => {
        // Content format: "[static] [type] name(params) description"
        const content = tag.content || '';
        const isStatic = content.trim().startsWith('static');

        // Simple parsing - can be enhanced based on actual format
        return {
          static: isStatic,
          name: tag.variable || '',
          description: content,
        };
      });
  }

  private parsePropertyTags(tags: Array<{ name: string; content: string; types?: string[]; variable?: string }>, tagName: string): PropertyTag[] {
    return tags
      .filter((tag) => tag.name === tagName)
      .map((tag) => ({
        types: tag.types || [],
        name: tag.variable || '',
        description: tag.content || '',
      }));
  }

  private parseExampleTags(tags: Array<{ name: string; content: string; types?: string[]; variable?: string }>): ExampleTag[] {
    return tags
      .filter((tag) => tag.name === 'example')
      .map((tag) => ({
        content: tag.content || '',
        description: tag.content || '',
      }));
  }

  private parseSourceTags(tags: Array<{ name: string; content: string; types?: string[]; variable?: string }>): ExampleTag[] {
    return tags
      .filter((tag) => tag.name === 'source')
      .map((tag) => {
        // Content format: "[startLine [numberOfLines]] description"
        const parts = (tag.content || '').split(' ');
        const startLine = parts[0] ? parseInt(parts[0], 10) : undefined;
        const numberOfLines = parts[1] ? parseInt(parts[1], 10) : undefined;

        return {
          startLine,
          numberOfLines,
          description: parts.slice(2).join(' ') || undefined,
        };
      });
  }

  private parseLicenseTag(tags: Array<{ name: string; content: string; types?: string[]; variable?: string }>): LicenseTag | undefined {
    const licenseTags = tags.filter((tag) => tag.name === 'license');
    if (licenseTags.length === 0) return undefined;

    const tag = licenseTags[0];
    const parts = (tag.content || '').split(' ');

    // Format can be: "URL name" or just "name"
    const hasUrl = parts[0]?.startsWith('http');
    return {
      url: hasUrl ? parts[0] : undefined,
      name: hasUrl ? parts.slice(1).join(' ') : parts.join(' '),
    };
  }

  private parseAuthorTags(tags: Array<{ name: string; content: string; types?: string[]; variable?: string }>): AuthorTag[] {
    return tags
      .filter((tag) => tag.name === 'author')
      .map((tag) => {
        // Content format: "Name <email>" or just "Name"
        const content = tag.content || '';
        const emailMatch = content.match(/<([^>]+)>/);

        return {
          name: emailMatch ? content.replace(/<[^>]+>/, '').trim() : content,
          email: emailMatch ? emailMatch[1] : undefined,
        };
      });
  }

  private transformHook(hook: RawHookData['hooks'][0]): Hook {
    const hookName = this.escapeHookName(hook.name);
    const hookId = this.getHookId(hookName);
    const tags = hook.doc?.tags || [];

    // Define all recognized tag names for filtering
    const recognizedTags = new Set([
      'param', 'return', 'throws', 'var', 'global', 'since', 'deprecated', 'version',
      'api', 'internal', 'ignore', 'package', 'subpackage', 'category',
      'see', 'uses', 'link', 'method', 'property', 'property-read', 'property-write',
      'example', 'filesource', 'source', 'author', 'copyright', 'license', 'todo'
    ]);

    // Build comprehensive doc object with all official PHPDoc tags
    const doc: HookDoc = {
      // Core documentation
      description: hook.doc?.description || '',
      long_description: hook.doc?.long_description || '',
      long_description_html: hook.doc?.long_description_html || '',

      // Function/Method tags
      params: this.parseParamTags(tags),
      return: this.parseReturnTag(tags),
      throws: this.parseThrowsTags(tags),

      // Class/Object tags
      method: this.parseMethodTags(tags),
      property: this.parsePropertyTags(tags, 'property'),
      propertyRead: this.parsePropertyTags(tags, 'property-read'),
      propertyWrite: this.parsePropertyTags(tags, 'property-write'),

      // Type tags
      var: this.parseVarTag(tags),
      global: this.parseGlobalTags(tags),

      // Version/Status tags
      since: this.parseSinceTags(tags),
      deprecated: this.parseSimpleTag(tags, 'deprecated'),
      version: this.parseSimpleTag(tags, 'version'),

      // Code organization tags
      package: this.parseSimpleTag(tags, 'package'),
      subpackage: this.parseSimpleTag(tags, 'subpackage'),
      category: this.parseSimpleTag(tags, 'category'),

      // Visibility/Access tags
      api: this.parseSimpleTag(tags, 'api'),
      internal: this.parseSimpleTag(tags, 'internal'),
      ignore: this.parseSimpleTag(tags, 'ignore'),

      // Reference tags
      see: this.parseReferenceTags(tags, 'see'),
      uses: this.parseReferenceTags(tags, 'uses'),
      link: this.parseReferenceTags(tags, 'link'),

      // Code display tags
      example: this.parseExampleTags(tags),
      filesource: this.parseSimpleTag(tags, 'filesource'),
      source: this.parseSourceTags(tags),

      // Legal/Metadata tags
      author: this.parseAuthorTags(tags),
      copyright: this.parseSimpleTag(tags, 'copyright'),
      license: this.parseLicenseTag(tags),

      // Development tags
      todo: this.parseSimpleTags(tags, 'todo'),

      // Generic fallback for unrecognized tags
      tags: tags.filter((tag) => !recognizedTags.has(tag.name)),
    };

    return {
      id: hookId,
      name: hookName,
      type: hook.type,
      file: hook.file,
      files: hook.files || [],
      line: hook.line || 0,
      doc,
      source: hook.source,
    };
  }
}
