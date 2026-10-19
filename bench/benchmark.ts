// Замеры на настоящем словаре, запускаются через npm run bench.
// Нужен флаг --expose-gc, он прописан в package.json: без принудительной
// сборки мусора замеры памяти скачут.

import { readFileSync } from 'node:fs';

import { Trie } from '../src/trie.ts';
import { CompressedTrie } from '../src/compressed-trie.ts';
import { ArrayTrie } from '../src/array-trie.ts';
import { Dawg } from '../src/dawg.ts';

const words = readFileSync(new URL('../data/russian-words.txt', import.meta.url), 'utf8')
  .split('\n')
  .filter((word) => word.length > 0);

const chars = words.reduce((sum, word) => sum + word.length, 0);

console.log(`Словарь: ${words.length} слов, ${chars} символов,`);
console.log(`средняя длина слова ${(chars / words.length).toFixed(1)}. Node ${process.version}\n`);

// сколько памяти занято прямо сейчас. Типизированные массивы живут не в куче,
// а в отдельной области, поэтому считаем обе.
function memoryUsed(): number {
  global.gc?.();
  const usage = process.memoryUsage();
  return usage.heapUsed + usage.arrayBuffers;
}

// строим структуру и смотрим, на сколько выросла куча
function build<T>(create: () => T, fill: (dict: T) => void): { dict: T; bytes: number; ms: number } {
  const before = memoryUsed();
  const start = performance.now();

  const dict = create();
  fill(dict);

  const ms = performance.now() - start;
  const bytes = memoryUsed() - before;

  return { dict, bytes, ms };
}

const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);

// --- память и время построения ---------------------------------------------

const set = build(
  () => new Set<string>(),
  (dict) => {
    for (const word of words) dict.add(word);
  },
);

const trie = build(
  () => new Trie(),
  (dict) => dict.addAll(words),
);

const compressed = build(
  () => new CompressedTrie(),
  (dict) => dict.addAll(words),
);

const array = build(
  () => new ArrayTrie(),
  (dict) => dict.addAll(words),
);

// Сами строки словаря уже лежат в памяти — их прочитали из файла.
// Set кладёт к себе только ссылки на них, поэтому выглядит дёшево;
// честно будет показать, сколько весят сами строки.
const stringsBytes = words.reduce((sum, word) => sum + 2 * word.length + 24, 0);

console.log(`Строки словаря сами по себе: ~${mb(stringsBytes)} МБ`);
console.log('(по 2 байта на символ плюс заголовок объекта строки)\n');

const dawg = build(
  () => new Dawg(),
  (dict) => dict.addAll(words),
);

console.log('Память и время построения');
console.log('   структура          память, МБ   на слово, байт   построение, мс');
const rows: [string, { bytes: number; ms: number }][] = [
  ['Set (для сравнения)', set],
  ['Trie', trie],
  ['CompressedTrie', compressed],
  ['ArrayTrie (33 буквы)', array],
  ['Dawg', dawg],
];
for (const [name, result] of rows) {
  console.log(
    `   ${name.padEnd(20)} ${mb(result.bytes).padStart(10)}   ${(result.bytes / words.length)
      .toFixed(0)
      .padStart(14)}   ${result.ms.toFixed(0).padStart(14)}`,
  );
}

// --- сколько узлов получилось ----------------------------------------------

console.log('\nУзлы: сколько их на самом деле');
console.log(`   символов в словаре (N):          ${chars}`);
console.log(`   слов (W):                        ${words.length}`);
console.log(
  `   узлов в Trie:                    ${trie.dict.nodeCount}` +
    `   (${((trie.dict.nodeCount / chars) * 100).toFixed(0)}% от N)`,
);
console.log(
  `   узлов в CompressedTrie:          ${compressed.dict.nodeCount}` +
    `   (${(compressed.dict.nodeCount / words.length).toFixed(2)} на слово)`,
);
console.log(
  `   символов в метках сжатого:       ${compressed.dict.labelChars}` +
    `   (${((compressed.dict.labelChars / chars) * 100).toFixed(0)}% от N)`,
);
console.log(`   ячеек в ArrayTrie (33 на узел):  ${array.dict.cellCount}`);
console.log(
  `   из них полезных:                 ${mb(array.dict.usedBytes)} МБ` +
    ` из ${mb(array.dict.allocatedBytes)} МБ выделенных`,
);
console.log(
  `   узлов в Dawg:                    ${dawg.dict.nodeCount}` +
    `   (${((dawg.dict.nodeCount / chars) * 100).toFixed(1)}% от N,` +
    ` в ${(trie.dict.nodeCount / dawg.dict.nodeCount).toFixed(1)} раза меньше дерева)`,
);

// --- скорость проверки слова -----------------------------------------------

// половина запросов — существующие слова, половина — испорченные,
// иначе проверка на несуществующем слове заканчивается слишком рано
const queries: string[] = [];
for (let i = 0; i < 200_000; i += 1) {
  const word = words[Math.floor(Math.random() * words.length)];
  queries.push(i % 2 === 0 ? word : word + 'ъъ');
}

function measure(has: (word: string) => boolean): number {
  // холостой прогон, пока движок не оптимизировал код
  for (const query of queries) has(query);

  const samples: number[] = [];
  for (let run = 0; run < 5; run += 1) {
    const start = performance.now();
    for (const query of queries) has(query);
    samples.push(performance.now() - start);
  }

  samples.sort((a, b) => a - b);
  return samples[2];
}

console.log('\nПроверка слова: 200 000 запросов');
console.log('   структура              время, мс   на запрос, нс');
const lookups: [string, (word: string) => boolean][] = [
  ['Set (для сравнения)', (word) => set.dict.has(word)],
  ['Trie', (word) => trie.dict.has(word)],
  ['CompressedTrie', (word) => compressed.dict.has(word)],
  ['ArrayTrie (33 буквы)', (word) => array.dict.has(word)],
  ['Dawg', (word) => dawg.dict.has(word)],
];
for (const [name, has] of lookups) {
  const ms = measure(has);
  console.log(
    `   ${name.padEnd(20)} ${ms.toFixed(1).padStart(10)}   ${((ms * 1e6) / queries.length)
      .toFixed(0)
      .padStart(13)}`,
  );
}

console.log('');
