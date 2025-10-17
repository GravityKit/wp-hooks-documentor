import { Hook, HookCollection } from '../utils/types';
import * as fs from 'fs';
import * as path from 'path';
import sanitizeHtml from 'sanitize-html';

export interface MarkdownGeneratorConfig {
  /**
   * The output directory for the markdown files
   */
  outputDir: string;

  /**
   * Plugin name for documentation
   * @default 'Plugin Hooks Documentation'
   */
  title?: string;

  /**
   * Plugin description for documentation
   * @default ''
   */
  tagline?: string;

  /**
   * Github source code url for the plugin
   * @default ''
   */
  githubSourceCodeUrl?: string;
}

export class MarkdownGenerator {
  private config: MarkdownGeneratorConfig;

  constructor(config: MarkdownGeneratorConfig) {
    this.config = config;
  }

  /**
   * Generates markdown documentation from the hook collection
   */
  public async generate(hookCollection: HookCollection): Promise<void> {
    // Ensure output directory exists
    if (!fs.existsSync(this.config.outputDir)) {
      fs.mkdirSync(this.config.outputDir, { recursive: true });
    }

    // Ensure output directories exist
    if (!fs.existsSync(path.join(this.config.outputDir, 'hooks'))) {
      fs.mkdirSync(path.join(this.config.outputDir, 'hooks'), { recursive: true });
    }
    if (!fs.existsSync(path.join(this.config.outputDir, 'hooks/Actions'))) {
      fs.mkdirSync(path.join(this.config.outputDir, 'hooks/Actions'), { recursive: true });
    }
    if (!fs.existsSync(path.join(this.config.outputDir, 'hooks/Filters'))) {
      fs.mkdirSync(path.join(this.config.outputDir, 'hooks/Filters'), { recursive: true });
    }

    // Generate individual hook files
    for (const hook of hookCollection.actions) {
      await this.generateHookFile(hook, 'Action');
    }
    for (const hook of hookCollection.filters) {
      await this.generateHookFile(hook, 'Filter');
    }

    // Generate index file
    await this.generateMainIndex(hookCollection);
  }

  /**
   * Generates documentation for a single hook
   */
  private async generateHookFile(hook: Hook, type: 'Action' | 'Filter'): Promise<void> {
    const content: string[] = [];

    // Add frontmatter
    content.push('---');
    content.push(`id: ${hook.id}`);
    content.push(`title: "${type} - ${hook.name}"`);
    content.push(`sidebar_label: "${hook.name}"`);

    // Add version information if available
    if (hook.doc.since && hook.doc.since.length > 0) {
      // Use the earliest version as the primary since version
      const versions = hook.doc.since.map(s => s.version).sort();
      const primaryVersion = versions[0];
      content.push(`since: "${primaryVersion}"`);

      // Add all versions as tags for filtering
      const versionTags = versions.map(v => `since-${v}`);
      content.push(`tags: [${versionTags.map(t => `"${t}"`).join(', ')}]`);
    }

    // Add deprecated flag if present
    if (hook.doc.deprecated) {
      content.push(`deprecated: true`);
    }

    // Add API visibility markers
    if (hook.doc.api) {
      content.push(`api: true`);
    }
    if (hook.doc.internal) {
      content.push(`internal: true`);
    }

    content.push('---\n');

    // Add hook name and description
    content.push(`# ${type}: ${this.sanitizeHookName(hook.name)}\n`);
    if (hook.doc.description) {
      content.push(`${this.sanitizeContent(hook.doc.description, true)}\n`);
    }
    if (hook.doc.long_description) {
      content.push(`${this.sanitizeContent(hook.doc.long_description, true)}\n`);
    }

    // Add parameters section if there are parameters
    if (hook.doc.params && hook.doc.params.length > 0) {
      content.push('## Parameters\n');
      content.push('| Name | Type | Description |');
      content.push('|------|------|-------------|');
      hook.doc.params.forEach((param) => {
        content.push(
          `| ${this.sanitizeContent(param.name)} | \`${this.sanitizeContent(param.types.join('|'))}\` | ${this.sanitizeContent(param.description || '', true)} |`
        );
      });
      content.push('');
    }

    // Add since and source info
    if (hook.doc.since && hook.doc.since.length > 0) {
      content.push('### Since\n');
      hook.doc.since.forEach((tag) => {
        if (tag?.description) {
          content.push(`- ${tag.version}: ${this.sanitizeContent(tag.description, true)}`);
        } else {
          content.push(`- ${tag.version}`);
        }
      });
    }

    if (hook.files && hook.files.length > 0) {
      content.push('### Source\n');
      hook.files.forEach((file) => {
        if (file.line && file.line > 0 && this.config.githubSourceCodeUrl) {
          content.push(
            `- Defined in [\`${file.file}\` at line ${file.line}](${this.config.githubSourceCodeUrl}/${file.file}#L${file.line})`
          );
        } else if (file.line && file.line > 0) {
          content.push(`- Defined in \`${file.file}\` at line ${file.line}`);
        } else {
          content.push(`- Defined in \`${file.file}\``);
        }
      });
    } else if (hook.file) {
      content.push('### Source\n');
      if (hook.line && hook.line > 0 && this.config.githubSourceCodeUrl) {
        content.push(
          `Defined in [\`${hook.file}\` at line ${hook.line}](${this.config.githubSourceCodeUrl}/${hook.file}#L${hook.line})`
        );
      } else if (hook.line && hook.line > 0) {
        content.push(`Defined in \`${hook.file}\` at line ${hook.line}`);
      } else {
        content.push(`Defined in \`${hook.file}\``);
      }
      content.push('\n');
    }

    // Add returns section for filters only
    if (type === 'Filter' && hook.doc.return) {
      content.push('## Returns');
      content.push(this.sanitizeContent(hook.doc.return.description || '', true));
      content.push('');
      if (hook.doc.return.types && hook.doc.return.types.length > 0) {
        content.push(`Type: ${hook.doc.return.types.join('|')}`);
        content.push('');
      }
    }

    // Add throws section
    if (hook.doc.throws && hook.doc.throws.length > 0) {
      content.push('## Throws\n');
      hook.doc.throws.forEach((throwTag) => {
        content.push(`- \`${throwTag.types.join('|')}\`: ${this.sanitizeContent(throwTag.description || '', true)}`);
      });
      content.push('');
    }

    // Add deprecated warning
    if (hook.doc.deprecated) {
      content.push('## Deprecated\n');
      content.push(`⚠️ ${this.sanitizeContent(hook.doc.deprecated.content, true)}`);
      content.push('');
    }

    // Add version info
    if (hook.doc.version) {
      content.push('## Version\n');
      content.push(this.sanitizeContent(hook.doc.version.content, true));
      content.push('');
    }

    // Add API marker
    if (hook.doc.api) {
      content.push('## API\n');
      content.push('✅ This hook is part of the public API and suitable for third-party consumption.');
      content.push('');
    }

    // Add internal marker
    if (hook.doc.internal) {
      content.push('## Internal\n');
      content.push('🔒 This hook is for internal use only.');
      content.push('');
    }

    // Add see also references
    if (hook.doc.see && hook.doc.see.length > 0) {
      content.push('## See Also\n');
      hook.doc.see.forEach((seeTag) => {
        const desc = seeTag.description ? ` - ${this.sanitizeContent(seeTag.description, true)}` : '';
        content.push(`- ${this.sanitizeContent(seeTag.reference, true)}${desc}`);
      });
      content.push('');
    }

    // Add uses references
    if (hook.doc.uses && hook.doc.uses.length > 0) {
      content.push('## Uses\n');
      hook.doc.uses.forEach((useTag) => {
        const desc = useTag.description ? ` - ${this.sanitizeContent(useTag.description, true)}` : '';
        content.push(`- ${this.sanitizeContent(useTag.reference, true)}${desc}`);
      });
      content.push('');
    }

    // Add related links
    if (hook.doc.link && hook.doc.link.length > 0) {
      content.push('## Related Links\n');
      hook.doc.link.forEach((linkTag) => {
        const desc = linkTag.description ? ` - ${this.sanitizeContent(linkTag.description, true)}` : '';
        content.push(`- ${this.sanitizeContent(linkTag.reference, true)}${desc}`);
      });
      content.push('');
    }

    // Add examples
    if (hook.doc.example && hook.doc.example.length > 0) {
      content.push('## Examples\n');
      hook.doc.example.forEach((example, index) => {
        if (hook.doc.example && hook.doc.example.length > 1) {
          content.push(`### Example ${index + 1}\n`);
        }
        if (example.description) {
          content.push(this.sanitizeContent(example.description, true));
          content.push('');
        }
        if (example.content) {
          content.push('```php');
          content.push(example.content);
          content.push('```');
          content.push('');
        }
      });
    }

    // Add method documentation (for magic methods)
    if (hook.doc.method && hook.doc.method.length > 0) {
      content.push('## Magic Methods\n');
      hook.doc.method.forEach((method) => {
        const staticModifier = method.static ? 'static ' : '';
        const returnTypes = method.returnTypes ? `${method.returnTypes.join('|')} ` : '';
        content.push(`- \`${staticModifier}${returnTypes}${method.name}\`: ${this.sanitizeContent(method.description || '', true)}`);
      });
      content.push('');
    }

    // Add property documentation (for magic properties)
    if (hook.doc.property && hook.doc.property.length > 0) {
      content.push('## Magic Properties\n');
      hook.doc.property.forEach((prop) => {
        content.push(`- \`${prop.types.join('|')} ${prop.name}\`: ${this.sanitizeContent(prop.description || '', true)}`);
      });
      content.push('');
    }

    // Add read-only properties
    if (hook.doc.propertyRead && hook.doc.propertyRead.length > 0) {
      content.push('## Read-Only Properties\n');
      hook.doc.propertyRead.forEach((prop) => {
        content.push(`- \`${prop.types.join('|')} ${prop.name}\`: ${this.sanitizeContent(prop.description || '', true)}`);
      });
      content.push('');
    }

    // Add write-only properties
    if (hook.doc.propertyWrite && hook.doc.propertyWrite.length > 0) {
      content.push('## Write-Only Properties\n');
      hook.doc.propertyWrite.forEach((prop) => {
        content.push(`- \`${prop.types.join('|')} ${prop.name}\`: ${this.sanitizeContent(prop.description || '', true)}`);
      });
      content.push('');
    }

    // Add variable type info
    if (hook.doc.var) {
      content.push('## Variable Type\n');
      content.push(`Type: \`${hook.doc.var.types.join('|')}\``);
      if (hook.doc.var.description) {
        content.push(`\n${this.sanitizeContent(hook.doc.var.description, true)}`);
      }
      content.push('');
    }

    // Add global variables
    if (hook.doc.global && hook.doc.global.length > 0) {
      content.push('## Global Variables\n');
      hook.doc.global.forEach((globalTag) => {
        const variable = globalTag.variable ? ` ${globalTag.variable}` : '';
        const desc = globalTag.description ? ` - ${this.sanitizeContent(globalTag.description, true)}` : '';
        content.push(`- \`${globalTag.types.join('|')}${variable}\`${desc}`);
      });
      content.push('');
    }

    // Add package info
    if (hook.doc.package) {
      content.push('## Package\n');
      content.push(this.sanitizeContent(hook.doc.package.content, true));
      content.push('');
    }

    // Add subpackage info
    if (hook.doc.subpackage) {
      content.push('## Subpackage\n');
      content.push(this.sanitizeContent(hook.doc.subpackage.content, true));
      content.push('');
    }

    // Add category info
    if (hook.doc.category) {
      content.push('## Category\n');
      content.push(this.sanitizeContent(hook.doc.category.content, true));
      content.push('');
    }

    // Add author info
    if (hook.doc.author && hook.doc.author.length > 0) {
      content.push('## Authors\n');
      hook.doc.author.forEach((author) => {
        const email = author.email ? ` <${author.email}>` : '';
        content.push(`- ${this.sanitizeContent(author.name, true)}${email}`);
      });
      content.push('');
    }

    // Add copyright info
    if (hook.doc.copyright) {
      content.push('## Copyright\n');
      content.push(this.sanitizeContent(hook.doc.copyright.content, true));
      content.push('');
    }

    // Add license info
    if (hook.doc.license) {
      const url = hook.doc.license.url ? ` (${hook.doc.license.url})` : '';
      content.push('## License\n');
      content.push(`${this.sanitizeContent(hook.doc.license.name, true)}${url}`);
      content.push('');
    }

    // Add todos
    if (hook.doc.todo && hook.doc.todo.length > 0) {
      content.push('## TODO\n');
      hook.doc.todo.forEach((todo) => {
        content.push(`- [ ] ${this.sanitizeContent(todo.content, true)}`);
      });
      content.push('');
    }

    // Write to file
    const fileName = `${hook.id}.md`;
    await fs.promises.writeFile(
      path.join(
        this.config.outputDir,
        'hooks',
        type === 'Action' ? 'Actions' : 'Filters',
        fileName
      ),
      content.join('\n')
    );
  }

  /**
   * Generates the main index file
   */
  private async generateMainIndex(hookCollection: HookCollection): Promise<void> {
    const content: string[] = [];

    // Add frontmatter
    content.push('---');
    content.push('id: index');
    content.push(`title: ${this.config.title}`);
    content.push('sidebar_label: Hooks');
    content.push('---\n');

    // Add title and description
    content.push(`# ${this.config.title}\n`);
    if (this.config.tagline) {
      content.push(`${this.config.tagline}\n`);
    }

    // Add available hooks section
    content.push('## Available Hooks\n');
    content.push(`This plugin provides the following hooks:\n`);

    // Add actions section
    if (hookCollection.actions.length > 0) {
      content.push('### Actions\n');
      hookCollection.actions.forEach((hook) => {
        content.push(
          `- [${this.sanitizeHookName(hook.name)}](./Actions/${hook.id}.md) - ${
            hook.doc.description || ''
          }`
        );
      });
      content.push('');
    }

    // Add filters section
    if (hookCollection.filters.length > 0) {
      content.push('### Filters\n');
      hookCollection.filters.forEach((hook) => {
        content.push(
          `- [${this.sanitizeHookName(hook.name)}](./Filters/${hook.id}.md) - ${
            hook.doc.description || ''
          }`
        );
      });
      content.push('');
    }

    // Write to file
    await fs.promises.writeFile(
      path.join(this.config.outputDir, 'hooks', 'index.md'),
      content.join('\n')
    );
  }

  private sanitizeContent(content: string, removeNewLines: boolean = false): string {
    let sanitized = sanitizeHtml(content, {
      disallowedTagsMode: 'recursiveEscape',
    });
    if (removeNewLines) {
      sanitized = sanitized.replace(/\n/g, '');
    }

    return sanitized.replace(/[{}|]/g, (match) => `\\${match}`);
  }

  private sanitizeHookName(hookName: string): string {
    return hookName.replace(/[{}]/g, (match) => `\\${match}`);
  }
}
