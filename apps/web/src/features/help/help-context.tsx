import { createContext, useContext } from 'react';

/** Lets any screen open the help panel or start the guided tour. */
export type HelpContextValue = { openHelp: () => void; startTour: () => void };

export const HelpContext = createContext<HelpContextValue>({ openHelp: () => {}, startTour: () => {} });

export const useHelp = () => useContext(HelpContext);
