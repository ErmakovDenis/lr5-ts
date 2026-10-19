// DAWG — словарь на автомате.
// Дерево склеивает только одинаковые начала слов, а тут склеиваются ещё и
// одинаковые окончания: «красный», «умный» и «честный» хранят общий хвост
// «ный» один раз. Несколько рёбер ведут в один узел, и вместо дерева
// получается граф.
// Слова подаются по алфавиту, и как только часть дерева перестаёт
// меняться, одинаковые куски в ней заменяются на уже готовые.

import { Trie, type Dictionary } from './trie.ts';

type Node = {
  id: number;
  children: Map<string, Node>;
  isWord: boolean;
};

export class Dawg implements Dictionary {
  private root: Node;
  private nextId = 1;

  // уже минимизированные узлы: по «отпечатку» узла находим такой же
  private registry = new Map<string, Node>();

  // узлы вдоль последнего добавленного слова, их ещё можно менять
  private pending: { parent: Node; char: string; child: Node }[] = [];
  private previous = '';
  private frozen = false;

  // Слова, добавленные после построения. Автомат статический: чтобы
  // добавить в него слово, надо перестраивать всё. Поэтому такие слова
  // складываю в обычное дерево рядом, а has смотрит в оба места.
  private extra = new Trie();

  private words = 0;

  constructor() {
    this.root = this.newNode();
  }

  get size(): number {
    return this.words + this.extra.size;
  }

  // сколько узлов осталось после склейки, считаем обходом:
  // один и тот же узел достижим из разных мест
  get nodeCount(): number {
    const seen = new Set<number>();

    const walk = (node: Node): void => {
      if (seen.has(node.id)) return;
      seen.add(node.id);
      for (const child of node.children.values()) walk(child);
    };

    walk(this.root);
    return seen.size;
  }

  // основной способ наполнить словарь — сразу из всего списка
  addAll(words: Iterable<string>): void {
    if (this.frozen) {
      for (const word of words) this.extra.add(word);
      return;
    }

    // алгоритму нужен алфавитный порядок, поэтому сортируем копию
    for (const word of [...words].sort()) this.insert(word);

    this.finish();
  }

  // одно слово: до построения автомата добавляется как обычно,
  // после — уходит в дерево рядом
  add(word: string): void {
    if (word.length === 0) return;

    if (this.frozen || word < this.previous) {
      if (!this.has(word)) this.extra.add(word);
      return;
    }

    this.insert(word);
  }

  // спускаемся по рёбрам как по обычному дереву,
  // то что узлы общие, на поиске не сказывается
  has(word: string): boolean {
    let node: Node | undefined = this.root;

    for (const char of word) {
      node = node.children.get(char);
      if (node === undefined) return this.extra.has(word);
    }

    return node.isWord || this.extra.has(word);
  }

  private newNode(): Node {
    return { id: this.nextId++, children: new Map(), isWord: false };
  }

  private insert(word: string): void {
    // слова идут по алфавиту, поэтому одинаковые стоят рядом:
    // достаточно сравнить с предыдущим, чтобы не посчитать слово дважды
    if (word === this.previous) return;

    // сколько букв совпало с предыдущим словом — эту часть дерева трогать
    // не надо, а всё, что глубже, уже не изменится и готово к склейке
    let common = 0;
    const limit = Math.min(word.length, this.previous.length);
    while (common < limit && word[common] === this.previous[common]) common += 1;

    this.minimize(common);

    let node =
      this.pending.length === 0 ? this.root : this.pending[this.pending.length - 1].child;

    for (const char of word.slice(common)) {
      const child = this.newNode();
      node.children.set(char, child);
      this.pending.push({ parent: node, char, child });
      node = child;
    }

    node.isWord = true;
    this.previous = word;
    this.words += 1;
  }

  // идём снизу вверх и смотрим, не было ли уже точно такого узла.
  // если был — выкидываем свой и вешаем ссылку на старый
  private minimize(downTo: number): void {
    for (let i = this.pending.length - 1; i >= downTo; i -= 1) {
      const { parent, char, child } = this.pending[i];
      const key = this.fingerprint(child);
      const same = this.registry.get(key);

      if (same !== undefined) {
        parent.children.set(char, same);
      } else {
        this.registry.set(key, child);
      }

      this.pending.pop();
    }
  }

  // отпечаток узла: конец слова или нет и куда ведут рёбра.
  // потомки уже склеены, поэтому хватает их номеров
  private fingerprint(node: Node): string {
    let key = node.isWord ? '1' : '0';

    for (const [char, child] of node.children) {
      key += `|${char}${child.id}`;
    }

    return key;
  }

  // склеить остаток и закрыть автомат
  private finish(): void {
    this.minimize(0);
    this.registry.clear();
    this.frozen = true;
  }
}
