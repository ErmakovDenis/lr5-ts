// Префиксное дерево (trie).
// Слово — это путь от корня вниз, одна буква на одно ребро.
// Общее начало хранится один раз: «кора» и «корова» делят первые три узла.

export type Dictionary = {
  add(word: string): void;
  addAll(words: Iterable<string>): void;
  has(word: string): boolean;
  readonly size: number;
};

type Node = {
  children: Map<string, Node>;
  // отмечаем узел, на котором кончается слово, иначе не отличить
  // слово «кот» от начала слова «котенок»
  isWord: boolean;
};

const newNode = (): Node => ({ children: new Map(), isWord: false });

export class Trie implements Dictionary {
  private root: Node = newNode();
  private words = 0;
  private nodes = 1; // корень

  // сколько слов в словаре
  get size(): number {
    return this.words;
  }

  // сколько узлов получилось, нужно для замеров
  get nodeCount(): number {
    return this.nodes;
  }

  // идём по буквам слова и создаём узлы, которых не хватает
  add(word: string): void {
    if (word.length === 0) return;

    let node = this.root;

    for (const char of word) {
      let next = node.children.get(char);

      if (next === undefined) {
        next = newNode();
        node.children.set(char, next);
        this.nodes += 1;
      }

      node = next;
    }

    if (!node.isWord) {
      node.isWord = true;
      this.words += 1;
    }
  }

  // добавить сразу список слов
  addAll(words: Iterable<string>): void {
    for (const word of words) this.add(word);
  }

  // спускаемся по тем же рёбрам, нет ребра — нет и слова
  has(word: string): boolean {
    const node = this.find(word);
    return node !== undefined && node.isWord;
  }

  // есть ли слова с таким началом — у Set так не спросишь
  hasPrefix(prefix: string): boolean {
    return this.find(prefix) !== undefined;
  }

  private find(path: string): Node | undefined {
    let node: Node | undefined = this.root;

    for (const char of path) {
      node = node.children.get(char);
      if (node === undefined) return undefined;
    }

    return node;
  }
}
