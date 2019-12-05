/**
 * The main module for the generic mode.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */

import { Container, inject, injectable } from "inversify";
import mergeOptions from "merge-options";
import { DefaultNameResolver, EName } from "salve";

import { action, BaseMode, Binder, BinderCtor, CommonModeOptions,
         EditorAPI, objectCheck, Runtime, tokens, transformation } from "wed";
import { InsertPI } from "./generic-actions";
import { GenericDecorator } from "./generic-decorator";
import { makeTagTr } from "./generic-tr";
import { Metadata, METADATA } from "./metadata";
import { MetadataMultiversionReader } from "./metadata-multiversion-reader";

import Action = action.Action;
import Transformation = transformation.Transformation;
import NamedTransformationData = transformation.NamedTransformationData;

// tslint:disable-next-line:import-name
import EDITOR_INSTANCE = tokens.EDITOR_INSTANCE;
// tslint:disable-next-line:import-name
import MODE_OPTIONS = tokens.MODE_OPTIONS;
// tslint:disable-next-line:import-name
import MODE = tokens.MODE;
// tslint:disable-next-line:import-name
import DECORATOR = tokens.DECORATOR;
// tslint:disable-next-line:import-name
import RUNTIME = tokens.RUNTIME;

export interface GenericModeOptions extends CommonModeOptions {
  metadata: string;
}

/**
 * This is the class that implements the generic mode. This mode decorates all
 * the elements of the file being edited. On the basis of the schema used by wed
 * for validation, it allows the addition of the elements authorized by the
 * schema.
 *
 * Recognized options:
 *
 * - ``metadata``: this option can be a path (a string) pointing to a module
 *   that implements the metadata needed by the mode.
 *
 * - ``autoinsert``: whether or not to fill newly inserted elements as much as
 *   possible. If this option is true, then when inserting a new element, the
 *   mode will try to detect whether the element has any mandatory children and
 *   if so will add these children to the element. For instance, if ``foo`` is
 *   invalid without the child ``baz`` then when inserting ``foo`` in the
 *   document, the following structure would be inserted
 *   ``<foo><baz></baz></foo>``. This automatic insertion of children happens
 *   only in non-ambiguous cases. Taking the same example as before, if ``foo``
 *   could contain ``a`` or ``b``, then the mode won't add any children. This
 *   option is ``true`` by default.
 */
@injectable()
export class GenericMode<Options extends GenericModeOptions =
  GenericModeOptions> extends BaseMode {
  protected resolver!: DefaultNameResolver;
  protected readonly tagTr:
  Record<string, Transformation<NamedTransformationData>>;
  protected readonly insertPIAction: InsertPI;

  readonly insertPITr: Transformation<NamedTransformationData>;

  constructor(@inject(EDITOR_INSTANCE) protected readonly editor: EditorAPI,
              @inject(METADATA) protected readonly metadata: Metadata,
              @inject(MODE_OPTIONS) protected readonly options: Options) {
    super();

    this.insertPIAction = new InsertPI(editor);
    if (this.constructor === GenericMode) {
      // Set our metadata.
      this.wedOptions = mergeOptions({}, this.wedOptions);
      this.wedOptions.metadata = {
        name: "Generic",
        authors: ["Louis-Dominique Dubeau"],
        description:
        "This is a basic mode bundled with wed and which can, " +
          "and probably should be used as the base for other modes.",
        license: "MPL 2.0",
        copyright: "Mangalam Research Center for Buddhist Languages",
      };
    }
    // else it is up to the derived class to set it.

    this.wedOptions.attributes = "edit";
    this.tagTr = makeTagTr(editor, !!options.autoinsert);
    this.insertPITr = this.tagTr["insert-pi"];
  }

  async init(): Promise<void> {
    this.resolver = new DefaultNameResolver();
    const mappings = this.metadata.getNamespaceMappings();
    for (const key of Object.keys(mappings)) {
      this.resolver.definePrefix(key, mappings[key]);
    }
  }

  getAbsoluteNamespaceMappings(): Record<string, string> {
    // We return a copy of the metadata's namespace mapping. A shallow copy
    // is good enough.
    return {... this.metadata.getNamespaceMappings()};
  }

  unresolveName(name: EName): string | undefined {
    return this.metadata.unresolveName(name);
  }

  getAbsoluteResolver(): DefaultNameResolver {
    return this.resolver;
  }

  /**
   * Returns a short description for an element. The element should be named
   * according to the mappings reported by the resolve returned by
   * [["wed/mode".Mode.getAbsoluteResolver]]. The generic mode delegates the
   * call to the metadata.
   *
   * @param name The name of the element.
   *
   * @returns The description. If the value returned is ``undefined``, then the
   * description is not available. If the value returned is ``null``, the
   * description has not been loaded yet.
   */
  shortDescriptionFor(name: string): string | null | undefined {
    const ename = this.resolver.resolveName(name);
    if (ename === undefined) {
      return undefined;
    }
    return this.metadata.shortDescriptionFor(ename);
  }

  /**
   * Returns a URL to the documentation for an element. The element should be
   * named according to the mappings reported by the resolve returned by
   * [["wed/mode".Mode.getAbsoluteResolver]]. The generic mode delegates the
   * call to the metadata.
   *
   * @param name The name of the element.
   *
   * @returns The URL. If the value returned is ``undefined``, then URL is not
   * available. If the value returned is ``null``, the URL has not been loaded
   * yet.
   */
  documentationLinkFor(name: string): string | null | undefined {
    const ename = this.resolver.resolveName(name);
    if (ename === undefined) {
      return undefined;
    }

    return this.metadata.documentationLinkFor(ename);
  }

  /**
   * The generic mode's implementation merely returns what it has stored in its
   * transformation registry.
   */
  getContextualActions(transformationType: string | string[],
                       _tag: string,
                       _container: Node,
                       _offset: number): Action<{}>[] {
    if (!(transformationType instanceof Array)) {
      transformationType = [transformationType];
    }

    const ret = [];
    for (const ttype of transformationType) {
      if (ttype === "insert-pi") {
        ret.push(this.insertPIAction);
      }
      else {
        const val = this.tagTr[ttype];
        if (val !== undefined) {
          ret.push(val as unknown as Action<{}>);
        }
      }
    }

    return ret;
  }
}

export interface GenericBinderCtor extends BinderCtor {
  readonly mode: new (...args: any[]) => GenericMode;
  readonly decorator: new (...args: any[]) => GenericDecorator;
}

type GenericModeCtor = new (...args: any[]) => GenericMode<any>;
type GenericDecoratorCtor = new (...args: any[]) => GenericDecorator;

export class GenericBinder implements Binder {
  static readonly mode: GenericModeCtor = GenericMode;
  static readonly decorator: GenericDecoratorCtor = GenericDecorator;

  /**
   * The template that [[checkOptions]] uses to check the options passed
   * to this mode. Consider this object to be immutable.
   */
  static readonly optionTemplate: objectCheck.Template = {
    metadata: true,
    autoinsert: false,
  };

  get ctor(): GenericBinderCtor {
    return this.constructor as GenericBinderCtor;
  }

  async bind(container: Container): Promise<void> {
    const options = container.get<GenericModeOptions>(MODE_OPTIONS);
    objectCheck.assertExtensively(this.ctor.optionTemplate, options);
    if (options.autoinsert === undefined) {
      options.autoinsert = true;
    }

    container.bind(METADATA).toConstantValue(await this.getMetadata(container));
    container.bind(MODE).to(await this.getMode(container));
    container.bind(DECORATOR).to(await this.getDecorator(container));
  }

  protected async getMetadata(container: Container): Promise<Metadata> {
    const options = container.get<GenericModeOptions>(MODE_OPTIONS);
    const runtime = container.get<Runtime>(RUNTIME);
    return new MetadataMultiversionReader()
      .read(JSON.parse(await runtime
                       .resolveToString(options.metadata)));
  }

  protected async getMode(_container: Container): Promise<GenericModeCtor> {
    return this.ctor.mode;
  }

  protected async getDecorator(_container: Container):
  Promise<GenericDecoratorCtor> {
    return this.ctor.decorator;
  }
}

export { GenericBinder as Binder };

//  LocalWords:  gui jquery Mangalam MPL Dubeau metadata's
