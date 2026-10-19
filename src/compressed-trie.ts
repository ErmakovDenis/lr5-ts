// Сжатое дерево (radix tree).
// В обычном дереве много узлов с единственным потомком: в «абажурчик»
// после «абажур» развилок нет, а узел на каждую букву всё равно создаётся.
// Тут такие цепочки склеены в одно ребро с куском слова на нём.

import type { Dictionary } from './trie.ts';

type Edge = {
  label: string; // кусок слова на ребре
  node: Node;
};

type Node = {
  // ключ — первая буква метки, по ней сразу находим нужное ребро
  children: Map<string, Edge>;
  isWord: boolean;
};

const newNode = (isWord = false): Node => ({ children: new Map(), isWord });

// сколько одинаковых символов в начале двух строк
function commonPrefix(a: string, b: string): number {
  const limit = Math.min(a.length, b.length);
  let i = 0;

  while (i < limit && a[i] === b[i]) i += 1;

  return i;
}

export class CompressedTrie implements Dictionary {
  private root: Node = newNode();
  private words = 0;
  private nodes = 1;

  get size(): number {
    return this.words;
  }

  get nodeCount(): number {
    return this.nodes;
  }

  // сколько всего символов в метках — столько и хранится
  get labelChars(): number {
    let total = 0;

    const walk = (node: Node): void => {
      for (const edge of node.children.values()) {
        total += edge.label.length;
        walk(edge.node);
      }
    };

    walk(this.root);
    return total;
  }

  add(word: string): void {
    if (word.length === 0) return;

    let node = this.root;
    let rest = word;

    while (rest.length > 0) {
      const edge = node.children.get(rest[0]);

      // такого начала ещё не было — вешаем остаток слова одним ребром
      if (edge === undefined) {
        node.children.set(rest[0], { label: rest, node: newNode(true) });
        this.nodes += 1;
        this.words += 1;
        return;
      }

      const common = commonPrefix(edge.label, rest);

      // метка целиком совпала с началом остатка — идём дальше вниз
      if (common === edge.label.length) {
        node = edge.node;
        rest = rest.slice(common);
        continue;
      }

      // совпало только частично — ребро надо разрезать:
      // «абажур» и «абажей» дадут общее «аба» и две ветки от него
      const middle = newNode();
      this.nodes += 1;

      const tail = edge.label.slice(common);
      middle.children.set(tail[0], { label: tail, node: edge.node });

      edge.label = edge.label.slice(0, common);
      edge.node = middle;

      rest = rest.slice(common);

      if (rest.length === 0) {
        // новое слово закончилось ровно в точке разреза
        middle.isWord = true;
      } else {
        middle.children.set(rest[0], { label: rest, node: newNode(true) });
        this.nodes += 1;
      }

      this.words += 1;
      return;
    }

    // слово кончилось на уже существующем узле
    if (!node.isWord) {
      node.isWord = true;
      this.words += 1;
    }
  }

  addAll(words: Iterable<string>): void {
    for (const word of words) this.add(word);
  }

  // слово должно кончиться ровно на узле: если оно обрывается
  // посреди ребра, такого слова нет
  has(word: string): boolean {
    let node = this.root;
    let rest = word;

    while (rest.length > 0) {
      const edge = node.children.get(rest[0]);
      if (edge === undefined) return false;
      if (!rest.startsWith(edge.label)) return false;

      node = edge.node;
      rest = rest.slice(edge.label.length);
    }

    return node.isWord;
  }

  // а префиксу обрываться посреди ребра можно: «абаж» лежит внутри
  // метки «абажур», и слова с таким началом есть
  hasPrefix(prefix: string): boolean {
    let node = this.root;
    let rest = prefix;

    while (rest.length > 0) {
      const edge = node.children.get(rest[0]);
      if (edge === undefined) return false;

      if (rest.length < edge.label.length) return edge.label.startsWith(rest);
      if (!rest.startsWith(edge.label)) return false;

      node = edge.node;
      rest = rest.slice(edge.label.length);
    }

    return true;
  }
}
