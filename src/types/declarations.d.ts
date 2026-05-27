declare module 'react' {
  export type ReactNode = any;
  export type ReactElement = any;
  export type ComponentType<T = any> = any;
  export type FC<T = any> = any;
  export type RefObject<T> = any;
  export type Context<T> = any;

  export function useState<T>(initialState: T | (() => T)): [T, (newState: T | ((prevState: T) => T)) => void];
  export function useEffect(effect: () => void | (() => void), deps?: any[]): void;
  export function useMemo<T>(factory: () => T, deps: any[] | undefined): T;
  export function useCallback<T extends (...args: any[]) => any>(callback: T, deps: any[]): T;
  export function useRef<T>(initialValue: T): { current: T };
  export function useContext<T>(context: any): T;
  export function createContext<T>(defaultValue: T): any;
  
  export type FormEvent<T = Element> = any;
  export type ChangeEvent<T = Element> = any;
  export type MouseEvent<T = Element> = any;

  export namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
    interface Element {
      [key: string]: any;
    }
  }
}

declare module 'react-dom';
declare module 'react/jsx-runtime';
declare module 'papaparse';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
    interface Element {
      [key: string]: any;
    }
  }
}

export {};
