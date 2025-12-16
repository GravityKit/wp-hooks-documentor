import { PHPRunner } from './php-runner';
import {
  HookCollection,
  Hook,
  RawHookCollection,
  RawHookData,
  HookCollectorConfig,
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

  /**
   * Parse @uses, @see, or @link tag content to extract reference and description.
   * Format: "reference description" where reference is a FQSEN or URL
   */
  private parseTagReference(content: string): { reference: string; description: string } {
    const trimmed = content.trim();
    if (!trimmed) {
      return { reference: '', description: '' };
    }

    // URL pattern - extract URL and rest as description
    const urlMatch = trimmed.match(/^(https?:\/\/\S+)\s*(.*)/i);
    if (urlMatch) {
      return {
        reference: urlMatch[1],
        description: urlMatch[2] || '',
      };
    }

    // FQSEN pattern - class, method, function, property, constant references
    // Examples: MyClass, MyClass::method(), MyClass::$property, MyClass::CONSTANT
    const fqsenMatch = trimmed.match(/^(\\?[a-zA-Z_][a-zA-Z0-9_\\]*(?:::[a-zA-Z_$][a-zA-Z0-9_]*(?:\(\))?)?)\s*(.*)/);
    if (fqsenMatch) {
      return {
        reference: fqsenMatch[1],
        description: fqsenMatch[2] || '',
      };
    }

    // If no clear pattern, treat entire content as description
    return { reference: '', description: trimmed };
  }

  private parseNestedTypes(description: string): {
    description: string;
    types: { name: string; type: string; description: string }[];
  } {
    if (!description.includes('@type')) {
      return { description, types: [] };
    }

    const types: { name: string; type: string; description: string }[] = [];
    const typeRegex = /@type\s+([^\s]+)\s+(\$[^\s]+)\s+([^\n@}]+)/g;
    let match;

    while ((match = typeRegex.exec(description)) !== null) {
      types.push({
        type: match[1].trim(),
        name: match[2].trim(),
        description: match[3].trim(),
      });
    }

    let cleanDescription = description
      .replace(/@type[^\n]+/g, '')
      .replace(/\{\s*/g, '')
      .replace(/\s*\}/g, '')
      .trim();

    return { description: cleanDescription, types };
  }

  private getHookId(hookName: string): string {
    let id = hookName;

    // Replace slashes with configured replacement character (default: strip)
    const slashReplacement = this.config.hookIdSlashReplacement ?? '';
    id = id.replace(/\//g, slashReplacement);

    return id
      .replace(/[^a-zA-Z0-9\-_.~]/g, '')
      .replace(/^__/, '')
      .replace(/^_/, '');
  }

  private transformHook(hook: RawHookData['hooks'][0]): Hook {
    const hookName = this.escapeHookName(hook.name);
    const hookId = this.getHookId(hookName);

    return {
      id: hookId,
      name: hookName,
      type: hook.type,
      file: hook.file,
      files: hook.files || [],
      line: hook.line || 0,
      doc: {
        description: hook.doc?.description || '',
        long_description: hook.doc?.long_description || '',
        long_description_html: hook.doc?.long_description_html || '',
        since: hook.doc?.tags?.filter((tag) => tag.name === 'since') || [],
        params:
          hook.doc?.tags
            ?.filter((tag) => tag.name === 'param')
            ?.map((p) => {
              const parsed = this.parseNestedTypes(p.content || '');
              return {
                name: p.variable || '',
                type: p.types?.join('|') || '',
                description: parsed.description,
                types: parsed.types.length > 0 ? parsed.types : undefined,
              };
            }) || [],
        tags:
          hook.doc?.tags?.filter(
            (tag) =>
              tag.name !== 'param' &&
              tag.name !== 'return' &&
              tag.name !== 'since' &&
              tag.name !== 'uses' &&
              tag.name !== 'see' &&
              tag.name !== 'link' &&
              tag.name !== 'deprecated' &&
              tag.name !== 'example'
          ) || [],
        return:
          (hook.doc?.tags
            ?.filter((tag) => tag.name === 'return')
            ?.map((tag) => ({
              type: tag.types?.join('|') || '',
              description: tag.content || '',
            })) || [])[0] || null,
        uses:
          hook.doc?.tags
            ?.filter((tag) => tag.name === 'uses')
            ?.map((tag) => {
              // If variable field is provided by parser, use it
              if (tag.variable) {
                return {
                  name: tag.variable,
                  description: tag.content || '',
                };
              }
              // Otherwise parse from content: "@uses FQSEN description"
              const parsed = this.parseTagReference(tag.content || '');
              return {
                name: parsed.reference,
                description: parsed.description,
              };
            }) || [],
        see:
          hook.doc?.tags
            ?.filter((tag) => tag.name === 'see')
            ?.map((tag) => {
              // If refers field is provided by parser, use it
              if (tag.refers) {
                return {
                  reference: tag.refers,
                  description: tag.content || '',
                };
              }
              // Otherwise parse from content: "@see URI|FQSEN description"
              const parsed = this.parseTagReference(tag.content || '');
              return {
                reference: parsed.reference,
                description: parsed.description,
              };
            }) || [],
        link:
          hook.doc?.tags
            ?.filter((tag) => tag.name === 'link')
            ?.map((tag) => {
              // If link field is provided by parser, use it
              if (tag.link) {
                return {
                  url: tag.link,
                  description: tag.content || '',
                };
              }
              // Otherwise parse from content: "@link URL description"
              const parsed = this.parseTagReference(tag.content || '');
              return {
                url: parsed.reference,
                description: parsed.description,
              };
            }) || [],
        deprecated:
          hook.doc?.tags
            ?.filter((tag) => tag.name === 'deprecated')
            ?.map((tag) => {
              // Parse @deprecated [version] [description]
              const content = tag.content?.trim() || '';
              // Match optional semantic version at start, rest is description
              const versionMatch = content.match(/^(\d+\.\d+(?:\.\d+)?(?:-[a-zA-Z0-9.-]+)?)\s*(.*)/);
              if (versionMatch) {
                return {
                  version: versionMatch[1],
                  description: versionMatch[2] || '',
                };
              }
              // No version found, treat entire content as description
              return {
                version: '',
                description: content,
              };
            }) || [],
        examples:
          hook.doc?.tags
            ?.filter((tag) => tag.name === 'example')
            ?.map((tag) => {
              const content = tag.content?.trim() || '';
              // Check if content starts with a markdown code fence
              const fencedMatch = content.match(/^```(\w*)\n([\s\S]*?)```\s*([\s\S]*)$/);
              if (fencedMatch) {
                return {
                  description: fencedMatch[3]?.trim() || '',
                  code: fencedMatch[2]?.trim() || '',
                };
              }
              // Check if there's a description before the code (text before first line of code)
              // Code typically starts with add_filter, add_action, apply_filters, do_action, <?, or function
              const codeStartMatch = content.match(/^(.*?)((?:add_filter|add_action|apply_filters|do_action|<\?php|function\s)[\s\S]*)$/s);
              if (codeStartMatch && codeStartMatch[1]) {
                return {
                  description: codeStartMatch[1].trim(),
                  code: codeStartMatch[2].trim(),
                };
              }
              // Treat entire content as code
              return {
                description: '',
                code: content,
              };
            }) || [],
      },
      source: hook.source,
    };
  }
}
