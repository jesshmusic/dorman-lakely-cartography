/**
 * Basic Foundry VTT type definitions for v13
 * These are minimal definitions for the module's needs
 */

declare global {
  const game: Game;
  const ui: UI;
  const Hooks: HooksAPI;
  const foundry: FoundryAPI;

  interface Game {
    modules: Collection<Module>;
    settings: ClientSettings;
    user: User | null;
    users: Collection<User>;
    scenes: Collection<Scene>;
    ready: boolean;
    [key: string]: any;
  }

  interface Module {
    id: string;
    title: string;
    active: boolean;
    api?: any;
    [key: string]: any;
  }

  interface User {
    id: string;
    name: string;
    isGM: boolean;
    [key: string]: any;
  }

  interface Scene {
    id: string;
    name: string;
    img: string | null;
    createThumbnail(): Promise<void>;
    [key: string]: any;
  }

  interface UI {
    notifications: Notifications;
    [key: string]: any;
  }

  interface Notifications {
    info(message: string): void;
    warn(message: string): void;
    error(message: string): void;
    notify(message: string, type?: string): void;
  }

  interface HooksAPI {
    on(hook: string, fn: (...args: any[]) => void): number;
    once(hook: string, fn: (...args: any[]) => void): number;
    off(hook: string, fn: number | ((...args: any[]) => void)): void;
    call(hook: string, ...args: any[]): boolean;
    callAll(hook: string, ...args: any[]): void;
  }

  interface FoundryAPI {
    utils: {
      randomID(length?: number): string;
      mergeObject(original: any, other: any, options?: any): any;
      [key: string]: any;
    };
    applications: {
      api: {
        ApplicationV2: typeof ApplicationV2;
        HandlebarsApplicationMixin: any;
      };
    };
    [key: string]: any;
  }

  interface ClientSettings {
    get(module: string, key: string): any;
    set(module: string, key: string, value: any): Promise<any>;
    register(module: string, key: string, data: SettingConfig): void;
  }

  interface SettingConfig {
    name: string;
    hint?: string;
    scope: 'world' | 'client';
    config?: boolean;
    type: any;
    default?: any;
    choices?: Record<string, string>;
    range?: { min: number; max: number; step: number };
    onChange?: (value: any) => void;
  }

  interface Collection<T> {
    get(id: string): T | undefined;
    set(id: string, value: T): void;
    has(id: string): boolean;
    find(predicate: (value: T) => boolean): T | undefined;
    filter(predicate: (value: T) => boolean): T[];
    map<U>(fn: (value: T) => U): U[];
    forEach(fn: (value: T) => void): void;
    [Symbol.iterator](): Iterator<T>;
    size: number;
  }

  class ApplicationV2 {
    constructor(options?: ApplicationV2Options);

    static DEFAULT_OPTIONS: ApplicationV2Options;

    render(force?: boolean, options?: any): Promise<this>;
    close(options?: any): Promise<void>;
    bringToFront(): void;
    minimize(): Promise<void>;
    maximize(): Promise<void>;

    get element(): HTMLElement | null;
    get rendered(): boolean;
    get position(): ApplicationPosition;

    protected _renderHTML(context: any, options: any): Promise<string>;
    protected _replaceHTML(result: string, content: HTMLElement, options: any): void;
    protected _attachPartials(partials: Record<string, string>): Promise<void>;
    protected _onRender(context: any, options: any): void;
    protected _onClose(options: any): void;

    _onClickAction(event: Event, target: HTMLElement): void;

    static PARTS: Record<string, ApplicationPart>;
  }

  interface ApplicationV2Options {
    id?: string;
    classes?: string[];
    tag?: string;
    window?: {
      title?: string;
      icon?: string;
      controls?: any[];
      minimizable?: boolean;
      resizable?: boolean;
      positioned?: boolean;
    };
    actions?: Record<string, (event: Event, target: HTMLElement) => void>;
    position?: Partial<ApplicationPosition>;
    [key: string]: any;
  }

  interface ApplicationPosition {
    width: number | string;
    height: number | string;
    top: number;
    left: number;
    scale: number;
    zIndex: number;
  }

  interface ApplicationPart {
    template: string;
    classes?: string[];
    scrollable?: string[];
  }

  class FilePicker {
    static browse(source: string, target: string, options?: any): Promise<any>;
    static upload(source: string, path: string, file: File | Blob, options?: any): Promise<any>;
  }

  function renderTemplate(path: string, data: any): Promise<string>;
}

export {};
