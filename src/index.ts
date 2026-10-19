// Демонстрация, запускается через npm start

import { readFileSync } from 'node:fs';

import { Trie } from './trie.ts';
import { CompressedTrie } from './compressed-trie.ts';
import { Dawg } from './dawg.ts';

const line = (title: string) => console.log(`\n=== ${title} ===`);

line('1. Функциональные требования');

const dict = new Dawg();

// добавление списка слов
dict.addAll(['кот', 'кора', 'корова', 'король', 'кит']);
console.log('добавили список, слов в словаре:', dict.size);

// добавление одного слова
dict.add('котенок');
console.log('добавили ещё одно, стало:', dict.size);

// проверка существования
for (const word of ['кот', 'котенок', 'коте', 'кит', 'собака']) {
  console.log(`  есть ли «${word}»: ${dict.has(word) ? 'да' : 'нет'}`);
}

line('2. Почему начало слова — это не слово');

const sameWords = new Trie();
sameWords.addAll(['кот', 'кора', 'корова', 'король', 'кит', 'котенок']);

console.log('есть ли слово «кор»:            ', sameWords.has('кор'));
console.log('есть ли слова на «кор»:         ', sameWords.hasPrefix('кор'));
console.log('есть ли слова на «коф»:         ', sameWords.hasPrefix('коф'));

line('3. Сколько узлов экономит склейка окончаний');

const sample = ['красный', 'умный', 'честный', 'темный', 'страшный'];

const trie = new Trie();
trie.addAll(sample);

const compressed = new CompressedTrie();
compressed.addAll(sample);

const dawg = new Dawg();
dawg.addAll(sample);

const chars = sample.reduce((sum, word) => sum + word.length, 0);

console.log(`слова: ${sample.join(', ')}`);
console.log(`символов всего (N):     ${chars}`);
console.log(`узлов в Trie:           ${trie.nodeCount}`);
console.log(`узлов в CompressedTrie: ${compressed.nodeCount}`);
console.log(`узлов в Dawg:           ${dawg.nodeCount}  (общий хвост «ный» хранится один раз)`);

line('4. На настоящем словаре');

const words = readFileSync(new URL('../data/russian-words.txt', import.meta.url), 'utf8')
  .split('\n')
  .filter((word) => word.length > 0);

const real = new Dawg();
real.addAll(words);

console.log(`загрузили ${real.size} слов`);
console.log('есть ли «абажурчик»:', real.has('абажурчик'));
console.log('есть ли «абажурчека»:', real.has('абажурчека'));
console.log('узлов в автомате:', real.nodeCount);

console.log('');
