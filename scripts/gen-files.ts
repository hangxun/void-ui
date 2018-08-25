import * as p from 'path';
import * as fs from 'fs';
import * as globby from 'globby';
import * as mkdirp from 'mkdirp';
import * as changeCase from 'change-case';
import chalk from 'chalk';
const labelLength: number = 20;

type Resolver = (path: string, name: string, ext: string) => string;
interface FileInfo {
  path: string;
  name: string;
  ext: string;
}

interface GenerateOptions {
  patterns: string | string[];
  output: string;
  comments?: string[];
  header?: string;
  footer?: string;
  body?(files: FileInfo[]): string;
  item?(info: FileInfo): string;
}

/**
 * Replace the matching part with alias in the path.
 * @param path the path
 */
function alias(path: string): string {
  return path.replace(/^docs/, '@docs').replace(/^lib/, '@void/ui/lib');
}

/**
 * Use files paths to generate export/import statements.
 */
function scriptResolve({ path, name, ext }: FileInfo): string {
  switch (ext) {
    case '.vue':
      return `export { default as ${name} } from '${path}';`;

    case '.ts':
    case '.tsx':
    case '.js':
    case '.jsx':
      return `export * from '${path.replace(/\.(j|t)sx?$/, '')}';`;

    default:
      throw new Error(`Cannot import ${ext} file (${path}) in .ts file.`);
  }
}

/**
 * Use files paths to generate export/import statements.
 */
function styleResolve({ path, name, ext }: FileInfo): string {
  switch (ext) {
    case '.scss':
    case '.less':
      return `@import '~${path.replace(/\.(scss|less)$/, '')}';`;
    case '.css':
      return `@import url('~${path.replace(/\.css$/, '')}');`;

    default:
      throw new Error(`Cannot import ${ext} file (${path}) in .scss/.less file.`);
  }
}

function generateComments(comments: string[], jsdoc: boolean = true): string {
  return jsdoc
    ? ['/**', ...comments.map(c => ` * ${c}`), ' */'].join('\n')
    : comments.map(c => `// ${c}`).join('\n');
}

const banner: string = generateComments(
  [
    'Do not edit this file.',
    'It is auto generated by script "scripts/gen-files.ts".',
    'To update this file, please run command "yarn gen-files".',
  ],
  false,
);

/**
 * Auto generate source code
 */
async function generateFiles(options: GenerateOptions): Promise<void> {
  let body: string;
  const files: FileInfo[] = (await globby([
    ...(Array.isArray(options.patterns) ? options.patterns : [options.patterns]),
    `!${options.output}`,
  ]))
    .sort()
    .map(f => ({
      path: alias(f),
      name: p.basename(f).replace(/\.[A-Za-z0-9\-\_]+/, ''),
      ext: p.extname(f),
    }));

  if (files.length === 0) {
    return console.info(
      chalk.bgYellow.black(' Files No Found '.padEnd(labelLength, ' ')),
      chalk.green(options.output),
    );
  }

  if (options.body) {
    body = options.body(files);
  } else if (options.item) {
    body = files.map(options.item).join('\n');
  } else if (/\.(j|t)sx?$/.test(options.output)) {
    body = files.map(scriptResolve).join('\n');
  } else if (/\.(scss|less|css)$/.test(options.output)) {
    body = files.map(styleResolve).join('\n');
  } else {
    throw new Error(
      `
Cannot generate "${options.output}",
${p.extname(options.output)} file is not default supported,
please provide a resolver function.
`,
    );
  }

  const content: string = [
    banner,
    '\n\n',
    ...(options.comments && options.comments.length > 0
      ? [generateComments(options.comments), '\n\n']
      : []),
    ...(options.header ? [options.header, '\n'] : []),
    body,
    ...(options.footer ? ['\n', options.footer] : []),
    '\n',
  ].join('');

  return new Promise<void>((resolve, reject) => {
    const dir: string = p.dirname(options.output);
    if (!fs.existsSync(dir)) {
      mkdirp.sync(dir);
    }
    if (!fs.existsSync(options.output)) {
      fs.writeFileSync(options.output, '');
    }

    fs.readFile(options.output, 'utf-8', (readError, oldContent) => {
      if (readError) {
        return reject(readError);
      }
      if (content === oldContent) {
        console.info(
          chalk.bgCyan.black(' Nothing Changed '.padEnd(labelLength, ' ')),
          chalk.green(options.output),
        );

        return resolve();
      }

      fs.writeFile(options.output, content, writeError => {
        if (writeError) {
          return reject(writeError);
        }
        console.info(
          chalk.bgCyanBright.black(' File Updated '.padEnd(labelLength, ' ')),
          chalk.greenBright(options.output),
        );

        return resolve();
      });
    });
  });
}

const optionsList: GenerateOptions[] = [
  // lib
  {
    patterns: ['lib/components/**/*.(tsx|ts)', '!lib/components/base/**/*'],
    output: 'lib/components/all.ts',
    comments: ['All components of void-ui.'],
  },
  {
    patterns: ['lib/components/**/*.scss', '!lib/components/base/**/*'],
    output: 'lib/components/all.scss',
    comments: ['All components style of void-ui.'],
  },

  // docs

  // components
  {
    patterns: ['docs/components/**/*.(tsx|ts)'],
    output: 'docs/components/all.ts',
    comments: ['All components of void-ui documentation.'],
  },
  {
    patterns: ['docs/components/**/*.scss'],
    output: 'docs/components/all.scss',
    comments: ['All components style of void-ui documentation.'],
  },

  // examples
  {
    patterns: ['docs/examples/**/*.scss'],
    output: 'docs/examples/all.scss',
    comments: ['All examples style of void-ui documentation.'],
  },
  {
    patterns: ['docs/examples/*/**/*.tsx'],
    output: 'docs/examples/all-tsx.ts',
    comments: ['All .tsx examples of void-ui documentation.'],
    header: 'export default {',
    footer: '};',
    item: ({ path, name, ext }) => {
      const key: string = path.replace('@docs/examples/', '').replace(/\.tsx/, '');
      const chunkName: string = p.basename(p.dirname(path));

      return `  '${key}': async () => import(/* webpackChunkName: "${chunkName}" */ '${path}'),`;
    },
  },
  {
    patterns: ['docs/examples/*/**/*.vue'],
    output: 'docs/examples/all-vue.ts',
    comments: ['All .vue examples of void-ui documentation.'],
    header: 'export default {',
    footer: '};',
    item: ({ path, name, ext }) => {
      const key: string = path.replace('@docs/examples/', '').replace(/\.vue/, '');
      const chunkName: string = p.basename(p.dirname(path));

      return `  '${key}': async () => import(/* webpackChunkName: "${chunkName}" */ '${path}'),`;
    },
  },
  {
    patterns: [
      'docs/examples/*/**/*.scss',
      'docs/examples/*/**/*.tsx',
      'docs/examples/*/**/*.vue',
    ],
    output: 'docs/examples/all.ts',
    comments: ['All examples source code of void-ui documentation.'],
    header: 'export default {',
    footer: '};',
    body: files => {
      const record: Record<string, string[]> = {};
      files.forEach(info => {
        const key: string = info.path
          .replace('@docs/examples/', '')
          .replace(/\.(scss|tsx?|vue)/, '');
        (record[key] || (record[key] = [])).push(`'${info.ext.substring(1)}'`);
      });

      return Object.entries(record)
        .map(([path, exts]) => `  '${path}': [ ${exts.join(', ')} ],`)
        .join('\n');
    },
  },

  // views
  {
    patterns: ['docs/views/**/*.scss'],
    output: 'docs/views/all.scss',
    comments: ['All views style of void-ui documentation.'],
  },
];

Promise.all(optionsList.map(generateFiles)).catch((e: Error) => {
  console.error(e.message);
  console.error(e.stack);
});
