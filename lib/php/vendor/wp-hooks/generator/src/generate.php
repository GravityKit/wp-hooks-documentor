#!/usr/bin/env php
<?php
declare(strict_types=1);

namespace WPHooks\Generator;

use DOMDocument;
use phpDocumentor\Reflection\DocBlockFactory;
use PhpParser\Comment\Doc;
use PhpParser\Node;
use PhpParser\NodeTraverser;
use PhpParser\NodeVisitor\FindingVisitor;
use PhpParser\ParserFactory;
use PhpParser\PrettyPrinter\Standard;

require_once file_exists( dirname( __DIR__, 4 ) . '/vendor/autoload.php' ) ? dirname( __DIR__, 4 ) . '/vendor/autoload.php' : 'vendor/autoload.php';

$options = getopt( '', [
	"input:",
	"output:",
	"ignore-files::",
	"ignore-hooks::",
] );

if ( empty( $options['input' ] ) || empty( $options['output'] ) ) {
	printf(
		"Usage: %s --input=src --output=hooks [--ignore-files=ignore/this,ignore/that] [--ignore-hooks=this_hook,that_hook] \n",
		$argv[0]
	);
	exit( 1 );
}

// Read ignore-files from cli args:
if ( ! empty( $options['ignore-files'] ) ) {
	$options['ignore-files'] = explode( ',', $options['ignore-files'] );
}

// Read ignore-hooks from cli args:
if ( ! empty( $options['ignore-hooks'] ) ) {
	$options['ignore-hooks'] = explode( ',', $options['ignore-hooks'] );
}

$config = ( file_exists( 'composer.json' ) ? json_decode( file_get_contents( 'composer.json' ) ) : false );

if ( ! empty( $config ) && ! empty( $config->extra ) && ! empty( $config->extra->{"wp-hooks"} ) ) {
	// Read ignore-files from Composer config:
	if ( empty( $options['ignore-files'] ) && ! empty( $config->extra->{"wp-hooks"}->{"ignore-files"} ) ) {
		$options['ignore-files'] = array_values( $config->extra->{"wp-hooks"}->{"ignore-files"} );
	}

	// Read ignore-hooks from Composer config:
	if ( empty( $options['ignore-hooks'] ) && ! empty( $config->extra->{"wp-hooks"}->{"ignore-hooks"} ) ) {
		$options['ignore-hooks'] = array_values( $config->extra->{"wp-hooks"}->{"ignore-hooks"} );
	}
}

if ( empty( $options['ignore-files'] ) ) {
	$options['ignore-files'] = [];
}

if ( empty( $options['ignore-hooks'] ) ) {
	$options['ignore-hooks'] = [];
}

$source_dir = $options['input'];
$target_dir = $options['output'];
$ignore_files = $options['ignore-files'];
$ignore_hooks = $options['ignore-hooks'];

if ( ! file_exists( $source_dir ) ) {
	printf(
		'The source directory "%s" does not exist.' . "\n",
		$source_dir
	);
	exit( 1 );
}

if ( ! file_exists( $target_dir ) ) {
	printf(
		'The target directory "%s" does not exist. Please create it first.' . "\n",
		$target_dir
	);
	exit( 1 );
}

echo "Scanning for files...\n";

/**
 * @param string $directory
 *
 * @return array|\WP_Error
 */
function get_wp_files( $directory ) {
	$iterableFiles = new \RecursiveIteratorIterator(
		new \RecursiveDirectoryIterator( $directory )
	);
	$files = array();

	foreach ( $iterableFiles as $file ) {
		if ( 'php' !== $file->getExtension() ) {
			continue;
		}

		$files[] = $file->getPathname();
	}

	return $files;
}

/** @var array<int,string> */
$files = get_wp_files( $source_dir );
$files = array_values( array_filter( $files, function( string $file ) use ( $ignore_files ) : bool {
	foreach ( $ignore_files as $i ) {
		if ( false !== strpos( $file, $i ) ) {
			return false;
		}
	}

	return true;
} ) );

printf(
	"Found %d files. Parsing hooks...\n",
	count( $files )
);

/**
 * Fixes newline handling in parsed text.
 *
 * DocBlock lines, particularly for descriptions, generally adhere to a given character width. For sentences and
 * paragraphs that exceed that width, what is intended as a manual soft wrap (via line break) is used to ensure
 * on-screen/in-file legibility of that text. These line breaks are retained by phpDocumentor. However, consumers
 * of this parsed data may believe the line breaks to be intentional and may display the text as such.
 *
 * This function fixes text by merging consecutive lines of text into a single line. A special exception is made
 * for text appearing in `<code>` and `<pre>` tags, as newlines appearing in those tags are always intentional.
 *
 * @param string $text
 *
 * @return string
 */
function fix_newlines( $text ) {
	// Non-naturally occurring string to use as temporary replacement.
	$replacement_string = '{{{{{}}}}}';

	// Replace newline characters within 'code' and 'pre' tags with replacement string.
	$text = preg_replace_callback(
		"/(?<=<pre><code>)(.+)(?=<\/code><\/pre>)/s",
		function ( $matches ) use ( $replacement_string ) {
			return preg_replace( '/[\n\r]/', $replacement_string, $matches[1] );
		},
		$text
	);

	// Merge consecutive non-blank lines together by replacing the newlines with a space.
	// Three guards keep intentional structure intact:
	//   (?<![\n\r])      preserve blank lines: never merge a newline that follows another newline.
	//   (?!\s*[\n\r])    preserve blank lines: never merge a newline that precedes another newline.
	//   (?![ \t]*(?:[-*+]|\d+\.)\s)  preserve Markdown list items (-, *, + or ordered "N.") on the next line.
	$text = preg_replace(
		"/(?<![\n\r])[\n\r](?!\s*[\n\r])(?![ \t]*(?:[-*+]|\d+\.)\s)/m",
		' ',
		$text
	);

	// Restore newline characters into code blocks.
	$text = str_replace( $replacement_string, "\n", $text );

	return $text;
}

class DocblockFinderVisitor extends FindingVisitor {
	private ?Doc $latest_comment = null;

	public function enterNode(Node $node) {
		$comment = $node->getDocComment();

		if ( $comment ) {
			$this->latest_comment = $comment;
		}

		$filterCallback = $this->filterCallback;
		if ($filterCallback($node)) {
			if ( $this->latest_comment && $this->latest_comment->getEndLine() + 1 === $node->getStartLine() ) {
				$node->setDocComment($this->latest_comment);
			}

			$this->foundNodes[] = $node;
		}

		return null;
	}
}

/**
 * @param array<int,string> $files
 * @param string            $root
 * @param array<int,string> $ignore_hooks
 * @return array
 */
function hooks_parse_files( array $files, string $root, array $ignore_hooks ) : array {
	$output = array();

	// Create a new parser instance
	$parser = ( new ParserFactory() )->createForNewestSupportedVersion();

	$funcs = [
		'do_action',
		'apply_filters',
		'do_action_ref_array',
		'apply_filters_ref_array',
		// Gravity Forms hook functions that support dynamic modifiers (form_id, field_id, etc.)
		'gf_do_action',
		'gf_apply_filters',
	];

	foreach ( $files as $filename ) {
		// Parse the PHP file
		$contents = file_get_contents($filename);

		if ($contents === false) {
			throw new \Exception('Failed to read file ' . $filename);
		}

		$stmts = $parser->parse($contents);

		if (!is_array($stmts)) {
			throw new \Exception('Failed to parse file ' . $filename);
		}

		// Create a new FindingVisitor instance
		$visitor = new DocblockFinderVisitor(
			fn ( Node $node ) => ( $node instanceof Node\Expr\FuncCall )
		);

		// Traverse the AST and resolve names
		$traverser = new NodeTraverser();
		$traverser->addVisitor( $visitor );
		$traverser->traverse($stmts);

		/** @var array<Node\Expr\FuncCall> $found */
		$found = $visitor->getFoundNodes();

		// Process the parsed statements to find calls to do_action() and apply_filters()
		foreach ( $found as $expr ) {
			$funcName = $expr->name;

			if (! ($funcName instanceof Node\Name)) {
				continue;
			}

			$funcNameStr = $funcName->toString();

			if ( ! in_array( $funcNameStr, $funcs, true ) ) {
				continue;
			}

			$docblock = $expr->getDocComment();
			$line     = $expr->getLine();

			if ( $docblock && str_starts_with($docblock->getText(), '/** This action is documented in') ) {
				continue;
			}

			if ( $docblock && str_starts_with($docblock->getText(), '/** This filter is documented in') ) {
				continue;
			}

			$printer = new Standard();
			$firstArg = $expr->args[0]->value;
			$hook_modifiers = [];

			// Handle Gravity Forms style hooks where first arg is array( 'hook_name', $modifier1, $modifier2, ... )
			if ( $firstArg instanceof Node\Expr\Array_ ) {
				$arrayItems = $firstArg->items;
				if ( ! empty( $arrayItems ) && $arrayItems[0] instanceof Node\Expr\ArrayItem ) {
					// First element is the hook name
					$hook_name = $printer->prettyPrintExpr( $arrayItems[0]->value );

					// Remaining elements are modifiers (form_id, field_id, etc.)
					for ( $i = 1; $i < count( $arrayItems ); $i++ ) {
						if ( $arrayItems[$i] instanceof Node\Expr\ArrayItem ) {
							$modifierExpr = $printer->prettyPrintExpr( $arrayItems[$i]->value );
							$hook_modifiers[] = $modifierExpr;
						}
					}
				} else {
					// Fallback: print the whole expression
					$hook_name = $printer->prettyPrintExpr( $firstArg );
				}
			} else {
				$hook_name = $printer->prettyPrintExpr( $firstArg );
			}

			$hook_name = preg_replace( '/^"(.*)"$/', '$1', $hook_name );
			$hook_name = preg_replace( "/^'(.*)'$/", '$1', $hook_name );

			if ( in_array( $hook_name, $ignore_hooks, true ) ) {
				continue;
			}

			$known_problem_hooks = [
				'autocomplete_users_for_site_admins',
				'enable_edit_any_user_configuration',
				'enqueue_block_assets',
				'show_recent_comments_widget_style',
			];

			if ( ! ( $docblock instanceof Doc ) ) {
				echo sprintf(
					"Hook '%s' in file '%s' is missing a docblock.\n",
					$hook_name,
					$filename,
				);

				continue;
			}

			$dbt = $docblock ? $docblock->getText() : '';

			if ( empty( $dbt ) ) {
				if ( in_array( $hook_name, $known_problem_hooks, true ) ) {
					continue;
				}

				echo sprintf(
					"Hook '%s' in file '%s' has an empty docblock.\n",
					$hook_name,
					$filename,
				);

				continue;
			}

			$doc = [
				'description' => '',
				'long_description' => '',
				'tags' => [],
				'long_description_html' => '',
			];

			$dbf = DocBlockFactory::createInstance();
			$db = $dbf->create( $dbt );
			$summary = trim( $db->getSummary() );
			$tags = [];

			foreach ( $db->getTags() as $tag ) {
				$content = '';

				if ( ! method_exists( $tag, 'getVersion' ) && method_exists( $tag, 'getDescription' ) ) {
					$content = (string) $tag->getDescription();
					// Preserve newlines for @example tags (code examples need formatting)
					if ( $tag->getName() !== 'example' ) {
						$content = preg_replace( '#\n\s+#', ' ', $content );
					}
				}

				$tag_data = [
					'name' => $tag->getName(),
					// Preserve raw content for @example tags (code needs formatting)
					'content' => $tag->getName() === 'example' ? $content : fix_newlines($content),
				];

				if ( $tag instanceof \phpDocumentor\Reflection\DocBlock\Tags\InvalidTag && $tag->getName() === 'since' ) {
					$tag_data['content'] = (string) $tag;
					$tag_data['description'] = (string) $tag;
				} elseif ( $tag instanceof \phpDocumentor\Reflection\DocBlock\Tags\Since ) {
					// Version string.
					$version = $tag->getVersion();

					if ( ! empty( $version ) ) {
						$tag_data['content'] = $version;
					}

					// Description string.
					$description = preg_replace( '/[\n\r]+/', ' ', strval( $tag->getDescription() ) );

					if ( ! empty( $description ) ) {
						$markdown = \Parsedown::instance();
						$html = $markdown->text( $description );
						$html = preg_replace( '/^<p>(.*)<\/p>$/', '$1', $html );
						$tag_data['description'] = $html;
					}
				} elseif ( $tag instanceof \phpDocumentor\Reflection\DocBlock\Tags\Deprecated ) {
					$tag_data['content'] = (string) $tag;
				} elseif ( $tag instanceof \phpDocumentor\Reflection\DocBlock\Tags\Param ) {
					$tag_data['types'] = explode( '|', (string) $tag->getType() );
					$tag_data['variable'] = '$' . $tag->getVariableName();

					$markdown = \Parsedown::instance();
					$html = $markdown->text( $tag_data['content'] );
					$html = preg_replace( '/^<p>(.*)<\/p>$/', '$1', $html );
					$tag_data['content'] = $html;
				} elseif ( $tag instanceof \phpDocumentor\Reflection\DocBlock\Tags\Link ) {
					$link = $tag->getLink();
					$tag_data['content'] = sprintf(
						'<a href="%s">%s</a>',
						$link,
						$link
					);
					$tag_data['link'] = $link;
				} elseif ( $tag instanceof \phpDocumentor\Reflection\DocBlock\Tags\Generic ) {
					//
				} elseif ( $tag instanceof \phpDocumentor\Reflection\DocBlock\Tags\See ) {
					$tag_data['refers'] = ltrim( (string) $tag->getReference(), '\\' );
					$markdown = \Parsedown::instance();
					$html = $markdown->text( $tag_data['content'] );
					$html = preg_replace( '/^<p>(.*)<\/p>$/', '$1', $html );
					$tag_data['content'] = $html;
				} elseif ( $tag instanceof \phpDocumentor\Reflection\DocBlock\Tags\InvalidTag && $tag->getName() === 'see' ) {
					//
				} elseif ( $tag instanceof \phpDocumentor\Reflection\DocBlock\Tags\Return_ ) {
					printf(
						'Hook "%s" contains a `@return` tag, which is not supported.' . "\n",
						$hook_name,
					);
				} elseif ( $tag instanceof \phpDocumentor\Reflection\DocBlock\Tags\Var_ ) {
					// @var tags in hook docblocks are typically documentation artifacts, skip them
					$tag_data['types'] = explode( '|', (string) $tag->getType() );
					$tag_data['variable'] = '$' . $tag->getVariableName();
				} elseif ( $tag instanceof \phpDocumentor\Reflection\DocBlock\Tags\InvalidTag ) {
					printf(
						'Unknown tag type "%s" (@%s) for hook "%s" in file "%s".',
						get_class( $tag ),
						$tag->getName(),
						$hook_name,
						$filename,
					);
				} else {
					throw new \Exception(
						sprintf(
							'Unknown tag type "%s" (@%s) for hook "%s" in file "%s".',
							get_class( $tag ),
							$tag->getName(),
							$hook_name,
							$filename,
						)
					);
				}

				$tags[] = $tag_data;
			}

			$markdown = \Parsedown::instance();
			$html = $markdown->text((string) $db->getDescription());
			$html = str_replace( "\n", ' ', $html );
			$long = fix_newlines( (string) $db->getDescription() );
			$long = str_replace(
				'  - ',
				"\n  - ",
				$long
			);
			$long = preg_replace_callback(
				'# ([1-9])\. #',
				static function( array $matches ) : string {
					return "\n {$matches[1]}. ";
				},
				$long
			);
			$doc = [
				'description' => str_replace( "\n", ' ', $summary ),
				'long_description' => $long,
				'tags' => $tags,
				'long_description_html' => $html,
			];
			$out = [];

			$out['name'] = $hook_name;

			$aliases = parse_aliases( $html );

			if ( $aliases ) {
				$out['aliases'] = $aliases;
			}

			$out['file'] = str_replace( "{$root}/", '', $filename );

			// Add the line number to the output.
			$out['line'] = $line;

			switch ( $funcNameStr ) {
				case 'do_action':
					$out['type'] = 'action';
					break;
				case 'apply_filters':
					$out['type'] = 'filter';
					break;
				case 'do_action_ref_array':
					$out['type'] = 'action_reference';
					break;
				case 'apply_filters_ref_array':
					$out['type'] = 'filter_reference';
					break;
				case 'gf_do_action':
					$out['type'] = 'action';
					break;
				case 'gf_apply_filters':
					$out['type'] = 'filter';
					break;
			}

			$out['doc'] = $doc;
			$out['args'] = count( $expr->args ) - 1;

			// Add modifiers for Gravity Forms style hooks (form_id, field_id, entry_id, etc.)
			if ( ! empty( $hook_modifiers ) ) {
				$out['modifiers'] = $hook_modifiers;
			}

			$output[] = $out;
		}
	}

	usort( $output, function( array $a, array $b ) : int {
		return strcmp( $a['name'], $b['name'] );
	} );

	return $output;
}

/**
 * @return array<int, string>
 */
function parse_aliases( string $html ) : array {
	if ( false === strpos( $html, 'Possible hook names include' ) ) {
		return [];
	}

	$aliases = [];

	$html = explode( 'Possible hook names include', $html, 2 );
	$html = explode( '</ul>', end( $html ) );

	$dom = new DOMDocument();
	$dom->loadHTML( reset( $html ) );

	foreach ( $dom->getElementsByTagName( 'li' ) as $li ) {
		$aliases[] = $li->nodeValue;
	}

	sort( $aliases );

	return $aliases;
}

$output = hooks_parse_files( $files, $source_dir, $ignore_hooks );

// Actions
$actions = array_values( array_filter( $output, function( array $hook ) : bool {
	return in_array( $hook['type'], [ 'action', 'action_reference' ], true );
} ) );

$actions = [
	'$schema' => 'https://raw.githubusercontent.com/wp-hooks/generator/1.0.1/schema.json',
	'hooks' => $actions,
];

$result = file_put_contents( $target_dir . '/actions.json', json_encode( $actions, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) );

// Filters
$filters = array_values( array_filter( $output, function( array $hook ) : bool {
	return in_array( $hook['type'], [ 'filter', 'filter_reference' ], true );
} ) );

$filters = [
	'$schema' => 'https://raw.githubusercontent.com/wp-hooks/generator/1.0.1/schema.json',
	'hooks' => $filters,
];

$result = file_put_contents( $target_dir . '/filters.json', json_encode( $filters, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) );

echo "Done\n";
