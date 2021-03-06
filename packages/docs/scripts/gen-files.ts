/**
 * Auto generate files
 */
import { GenFilesOptions, genFiles } from '@huiji/shared-utils';
import * as fs from 'fs';
import * as pth from 'path';

const ARTICLE_LANGUAGES: ReadonlyArray<string> = ['zh-CN'];

const optionsList: GenFilesOptions[] = [
  // components
  {
    patterns: ['src/components/**/*.(tsx|ts)'],
    output: 'src/components/all.ts',
    comments: ['All components of void-ui documentation.'],
  },
  {
    patterns: ['src/components/**/*.scss'],
    output: 'src/components/all.scss',
    comments: ['All components style of void-ui documentation.'],
  },

  // examples
  {
    patterns: ['src/examples/**/*.scss'],
    output: 'src/examples/all.scss',
    comments: ['All examples style of void-ui documentation.'],
  },
  {
    patterns: ['src/examples/*/**/*.tsx'],
    output: 'src/examples/all-tsx.ts',
    comments: ['All .tsx examples of void-ui documentation.'],
    header: 'export default {',
    footer: '};',
    item: ({ path, name, ext }) => {
      const key: string = path.replace('./', '').replace(/\.tsx/, '');
      const chunkName: string = `examples-${pth.dirname(key).replace(/\//g, '_')}`;

      return `${`  '${key}'`.padEnd(
        48,
        ' ',
      )}: async () => import(/* webpackChunkName: "${chunkName}" */ '${path.replace(
        /\.tsx$/,
        '',
      )}'),`;
    },
  },
  {
    patterns: ['src/examples/*/**/*.vue'],
    output: 'src/examples/all-vue.ts',
    comments: ['All .vue examples of void-ui documentation.'],
    header: 'export default {',
    footer: '};',
    item: ({ path, name, ext }) => {
      const key: string = path.replace('./', '').replace(/\.vue/, '');
      const chunkName: string = `examples-${pth.dirname(key).replace(/\//g, '_')}`;

      return `${`  '${key}'`.padEnd(
        48,
        ' ',
      )}: async () => import(/* webpackChunkName: "${chunkName}" */ '${path}'),`;
    },
  },
  {
    patterns: [
      'src/examples/*/**/*.scss',
      'src/examples/*/**/*.tsx',
      'src/examples/*/**/*.vue',
    ],
    output: 'src/examples/all.ts',
    comments: ['All examples source code of void-ui documentation.'],
    header: 'export default {',
    footer: '};',
    body: files => {
      const record: Record<string, string[]> = {};
      files.forEach(info => {
        const key: string = info.path.replace('./', '').replace(/\.(scss|tsx?|vue)/, '');
        (record[key] || (record[key] = [])).push(`'${info.ext.substring(1)}'`);
      });

      return Object.entries(record)
        .map(([path, exts]) => `  '${path}': [ ${exts.join(', ')} ],`)
        .join('\n');
    },
  },
];

const optionsListArticle: GenFilesOptions[] = ARTICLE_LANGUAGES.map<GenFilesOptions>(
  lang => ({
    patterns: [`src/articles/${lang}/**/*.md`],
    output: `src/articles/${lang}/all.ts`,
    comments: ['All articles'],
    header:
      "import { RouteConfig } from 'vue-router';\n\n const articles: RouteConfig[] = [",
    footer: '];\n\nexport default articles',
    body: files => {
      return files
        .map(info => {
          const path: string = info.path.replace('./', '').replace(/\.md$/, '');

          const name: string = fs
            .readFileSync(info.path.replace('.', `src/articles/${lang}`), 'utf-8')
            .split('\n')[0]
            .replace(/^#+/, '')
            .trim();

          return `  {
    path: '${path}',
    name: '${name}',
    component: async () => import('${info.path}'),
  },`;
        })
        .join('\n');
    },
  }),
);

Promise.all([...optionsList, ...optionsListArticle].map(genFiles)).catch((e: Error) => {
  console.error(e.message);
  console.error(e.stack);
});
