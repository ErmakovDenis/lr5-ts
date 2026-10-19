import test from 'node:test';
import assert from 'node:assert/strict';

import { Trie, type Dictionary } from '../src/trie.ts';
import { CompressedTrie } from '../src/compressed-trie.ts';
import { ArrayTrie } from '../src/array-trie.ts';
import { Dawg } from '../src/dawg.ts';

// все три реализации должны вести себя одинаково, поэтому
// один и тот же набор тестов гоняем по каждой из них
const implementations: [string, () => Dictionary][] = [
  ['Trie', () => new Trie()],
  ['CompressedTrie', () => new CompressedTrie()],
  ['ArrayTrie', () => new ArrayTrie()],
  ['Dawg', () => new Dawg()],
];

for (const [name, create] of implementations) {
  test(`${name}: пустой словарь`, () => {
    const dict = create();

    assert.equal(dict.size, 0);
    assert.equal(dict.has('кот'), false);
    assert.equal(dict.has(''), false);
  });

  test(`${name}: добавили одно слово`, () => {
    const dict = create();
    dict.add('кот');

    assert.equal(dict.has('кот'), true);
    assert.equal(dict.size, 1);
  });

  test(`${name}: добавили список слов`, () => {
    const dict = create();
    dict.addAll(['кот', 'код', 'кора', 'корова']);

    assert.equal(dict.size, 4);
    for (const word of ['кот', 'код', 'кора', 'корова']) {
      assert.equal(dict.has(word), true, `не нашлось слово «${word}»`);
    }
  });

  test(`${name}: начало слова — ещё не слово`, () => {
    const dict = create();
    dict.add('котенок');

    assert.equal(dict.has('кот'), false, 'кот отдельно не добавляли');
    assert.equal(dict.has('котенок'), true);
  });

  test(`${name}: слово, которое является началом другого`, () => {
    const dict = create();
    dict.addAll(['кот', 'котенок']);

    assert.equal(dict.has('кот'), true);
    assert.equal(dict.has('котенок'), true);
    assert.equal(dict.has('коте'), false, 'середина слова словом не является');
    assert.equal(dict.size, 2);
  });

  test(`${name}: продолжение слова не находится`, () => {
    const dict = create();
    dict.add('кот');

    assert.equal(dict.has('коты'), false);
    assert.equal(dict.has('котик'), false);
  });

  test(`${name}: повторное добавление не плодит слова`, () => {
    const dict = create();
    dict.addAll(['кот', 'кот', 'кот']);

    assert.equal(dict.size, 1);
  });

  test(`${name}: слова без общего начала`, () => {
    const dict = create();
    dict.addAll(['абажур', 'яма', 'метель']);

    assert.equal(dict.size, 3);
    assert.equal(dict.has('яма'), true);
    assert.equal(dict.has('ямб'), false);
  });

  test(`${name}: слово из одной буквы`, () => {
    const dict = create();
    dict.addAll(['я', 'яма']);

    assert.equal(dict.has('я'), true);
    assert.equal(dict.has('яма'), true);
    assert.equal(dict.size, 2);
  });

  test(`${name}: совпадает с обычным Set на случайных словах`, () => {
    const letters = 'абвгд';
    const dict = create();
    const set = new Set<string>();

    for (let i = 0; i < 500; i += 1) {
      const length = 1 + Math.floor(Math.random() * 6);
      let word = '';
      for (let j = 0; j < length; j += 1) {
        word += letters[Math.floor(Math.random() * letters.length)];
      }

      dict.add(word);
      set.add(word);
    }

    assert.equal(dict.size, set.size);

    // проверяем и то, что есть в словаре, и то, чего в нём нет
    for (const word of set) assert.equal(dict.has(word), true, `пропало «${word}»`);

    for (let i = 0; i < 500; i += 1) {
      const length = 1 + Math.floor(Math.random() * 6);
      let word = '';
      for (let j = 0; j < length; j += 1) {
        word += letters[Math.floor(Math.random() * letters.length)];
      }

      assert.equal(dict.has(word), set.has(word), `расхождение на «${word}»`);
    }
  });
}

// hasPrefix есть только у деревьев на Map
test('поиск по началу слова', () => {
  for (const dict of [new Trie(), new CompressedTrie()]) {
    dict.addAll(['абажур', 'абажурный', 'яма']);

    assert.equal(dict.hasPrefix('аба'), true);
    assert.equal(dict.hasPrefix('абажур'), true);
    assert.equal(dict.hasPrefix('абажурн'), true, 'префикс внутри склеенного ребра');
    assert.equal(dict.hasPrefix('абв'), false);
    assert.equal(dict.hasPrefix(''), true, 'пустой префикс есть у всех');
  }
});

test('сжатое дерево даёт меньше узлов, чем обычное', () => {
  const words = ['абажур', 'абажурный', 'абажурчик', 'абак', 'яма'];

  const trie = new Trie();
  trie.addAll(words);

  const compressed = new CompressedTrie();
  compressed.addAll(words);

  assert.equal(trie.size, compressed.size);
  assert.ok(
    compressed.nodeCount < trie.nodeCount,
    `узлов: сжатое ${compressed.nodeCount}, обычное ${trie.nodeCount}`,
  );
});

test('ArrayTrie ругается на символ не из алфавита', () => {
  const dict = new ArrayTrie();

  assert.throws(() => dict.add('hello'), /нет в алфавите/);
  assert.equal(dict.has('hello'), false, 'но проверка просто не находит слово');
});

test('Dawg: склеивает одинаковые окончания', () => {
  // у всех слов разные начала, но одинаковый хвост «ный»:
  // в дереве он хранился бы трижды, в автомате — один раз
  const words = ['красный', 'умный', 'честный'];

  const trie = new Trie();
  trie.addAll(words);

  const dawg = new Dawg();
  dawg.addAll(words);

  assert.equal(dawg.size, trie.size);
  assert.ok(
    dawg.nodeCount < trie.nodeCount,
    `узлов: автомат ${dawg.nodeCount}, дерево ${trie.nodeCount}`,
  );

  for (const word of words) assert.equal(dawg.has(word), true);
  assert.equal(dawg.has('ный'), false, 'хвост сам по себе словом не стал');
});

test('Dawg: слова можно добавлять и после построения', () => {
  const dawg = new Dawg();
  dawg.addAll(['кот', 'кора']);

  assert.equal(dawg.has('кит'), false);

  dawg.add('кит');
  assert.equal(dawg.has('кит'), true);
  assert.equal(dawg.size, 3);

  dawg.add('кит');
  assert.equal(dawg.size, 3, 'повтор не считается новым словом');
});

test('Dawg: слова, пришедшие не по алфавиту', () => {
  const dawg = new Dawg();

  for (const word of ['яма', 'абажур', 'метель', 'абак']) dawg.add(word);

  for (const word of ['яма', 'абажур', 'метель', 'абак']) {
    assert.equal(dawg.has(word), true, `не нашлось «${word}»`);
  }
  assert.equal(dawg.size, 4);
  assert.equal(dawg.has('ям'), false);
});
