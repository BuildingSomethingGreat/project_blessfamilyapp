import { createContext, useContext } from 'react';

/** Whether the loader just played on this page load. The hero delays its entrance (`--hd`) to follow it. */
export const BootContext = createContext<{ justLoaded: boolean }>({ justLoaded: false });
export const useBoot = () => useContext(BootContext);
