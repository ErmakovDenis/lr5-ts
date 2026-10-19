// То же дерево, но узлы лежат не объектами, а в одном массиве чисел:
// на узел отведено 33 ячейки, по одной на букву, в ячейке — номер потомка.
// Это тот самый вариант «33 * N» из задания, сделал его, чтобы сравнить
// с Map-версией на замерах, а не на словах.

import type { Dictionary } from './trie.ts';

export const RUSSIAN = 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя';

export class ArrayTrie implements Dictionary {
  private alphabet: string;
  private index: Map<string, number>;
  private children: Int32Array;
  private wordEnd: Uint8Array;
  private nodes = 1; // узел 0 — корень
  private words = 0;

  constructor(alphabet = RUSSIAN, capacity = 1024) {
    this.alphabet = alphabet;
    this.index = new Map([...alphabet].map((char, i) => [char, i]));
    this.children = new Int32Array(capacity * alphabet.length);
    this.wordEnd = new Uint8Array(capacity);
  }

  get size(): number {
    return this.words;
  }

  get nodeCount(): number {
    return this.nodes;
  }

  // сколько ячеек реально занято под дерево
  get cellCount(): number {
    return this.nodes * this.alphabet.length;
  }

  // байты: по 4 на номер потомка плюс байт на отметку конца слова
  get usedBytes(): number {
    return this.nodes * this.alphabet.length * 4 + this.nodes;
  }

  // сколько выделено на самом деле — массивы растут удвоением,
  // поэтому в конце часть места простаивает
  get allocatedBytes(): number {
    return this.children.byteLength + this.wordEnd.byteLength;
  }

  add(word: string): void {
    if (word.length === 0) return;

    let node = 0;

    for (const char of word) {
      const letter = this.index.get(char);
      if (letter === undefined) {
        throw new Error(`символа «${char}» нет в алфавите`);
      }

      const slot = node * this.alphabet.length + letter;
      let next = this.children[slot];

      if (next === 0) {
        next = this.nodes;
        this.nodes += 1;
        this.grow();
        this.children[slot] = next;
      }

      node = next;
    }

    if (this.wordEnd[node] === 0) {
      this.wordEnd[node] = 1;
      this.words += 1;
    }
  }

  addAll(words: Iterable<string>): void {
    for (const word of words) this.add(word);
  }

  has(word: string): boolean {
    let node = 0;

    for (const char of word) {
      const letter = this.index.get(char);
      if (letter === undefined) return false;

      node = this.children[node * this.alphabet.length + letter];
      if (node === 0) return false;
    }

    return this.wordEnd[node] === 1;
  }

  // места не хватило — удваиваем массивы. редкое добавление выходит
  // дорогим, но в среднем всё равно дёшево
  private grow(): void {
    const capacity = this.wordEnd.length;
    if (this.nodes <= capacity) return;

    const children = new Int32Array(capacity * 2 * this.alphabet.length);
    children.set(this.children);
    this.children = children;

    const wordEnd = new Uint8Array(capacity * 2);
    wordEnd.set(this.wordEnd);
    this.wordEnd = wordEnd;
  }
}
