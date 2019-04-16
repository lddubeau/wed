/**
 * Utilities that don't require a DOM to run.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
// tslint:disable-next-line:completed-docs
export class DataProvider {
  private readonly cache: Record<string, string> = Object.create(null);
  private readonly parser: DOMParser = new DOMParser();
  private readonly registered: Record<string, string> = Object.create(null);

  constructor(private readonly base: string) {}

  register(name: string, path: string): void {
    this.registered[name] = path;
  }

  getNamed(name: string): Promise<string> {
    const path = this.registered[name];
    return this.getText(path);
  }

  getNamedDoc(name: string): Promise<Document> {
    const path = this.registered[name];
    return this.getDoc(path);
  }

  getText(path: string): Promise<string> {
    return this._getText(this.base + path);
  }

  async _getText(path: string): Promise<string> {
    const cached = this.cache[path];
    if (cached !== undefined) {
      return cached;
    }

    const data = await (await fetch(path)).text();
    this.cache[path] = data;
    return data;
  }

  async getDoc(path: string): Promise<Document> {
    const data = await this._getText(this.base + path);
    return this.parser.parseFromString(data, "text/xml");
  }
}

// tslint:disable-next-line:no-any
export function makeFakePasteEvent(clipboardData: any): any {
  const event = new $.Event("paste") as JQuery.TriggeredEvent;
  event.originalEvent = {
    clipboardData,
    // tslint:disable-next-line:no-empty
    stopImmediatePropagation: () => {},
    // tslint:disable-next-line:no-empty
    preventDefault: () => {},
    // tslint:disable-next-line:no-empty
    stopPropagation: () => {},
    // tslint:disable-next-line:no-any
  } as any;
  return event;
}
