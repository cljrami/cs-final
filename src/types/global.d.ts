import type { Fancybox as FancyboxClass } from '@fancyapps/ui';

declare global {
  interface Window {
    Fancybox?: typeof FancyboxClass;
  }
}
