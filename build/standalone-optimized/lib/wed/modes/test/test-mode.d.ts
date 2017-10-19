import { Action } from "wed/action";
import { GenericModeOptions, Mode as GenericMode } from "wed/modes/generic/generic";
import { GenericDecorator } from "wed/modes/generic/generic-decorator";
import { Template } from "wed/object-check";
import { ModeValidator } from "wed/validator";
import { Editor } from "wed/wed";
export declare class TestDecorator extends GenericDecorator {
    private readonly elementLevel;
    protected readonly mode: TestMode;
    addHandlers(): void;
    elementDecorator(root: Element, el: Element): void;
    private _navigationContextMenuHandler(wedEv, ev);
}
export interface TestModeOptions extends GenericModeOptions {
    ambiguous_fileDesc_insert: boolean;
    fileDesc_insert_needs_input: boolean;
    hide_attributes: boolean;
    nameSuffix?: string;
    stylesheets?: string[];
}
/**
 * This mode is purely designed to help test wed, and nothing
 * else. Don't derive anything from it and don't use it for editing.
 */
export declare class TestMode extends GenericMode<TestModeOptions> {
    private typeaheadAction;
    private draggableAction;
    private resizableAction;
    private draggableResizableAction;
    readonly optionTemplate: Template;
    constructor(editor: Editor, options: TestModeOptions);
    init(): Promise<void>;
    getStylesheets(): string[];
    getContextualActions(transformationType: string | string[], tag: string, container: Node, offset: number): Action<{}>[];
    makeDecorator(): GenericDecorator;
    getAttributeCompletions(attr: Attr): string[];
    getValidator(): ModeValidator;
}
export { TestMode as Mode };
