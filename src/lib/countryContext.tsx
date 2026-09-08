"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { DEFAULT_COUNTRY } from "./countryHelper";

/**
 * Which country the site is following right now.
 *
 * One selection, shared by the zone page, the home widget, the ticker and the
 * pool tables -- every place that used to compare against a hardcoded "POL".
 *
 * Held in sessionStorage rather than localStorage on purpose: the site is
 * Poland-first, and a reader who looked up Brazil once should come back to
 * Poland next time they open it, not to whatever they last browsed.
 */

const STORAGE_KEY = "bvl.country";

interface CountryContextValue {
  /** Federation code, e.g. "POL". Never empty. */
  country: string;
  setCountry: (code: string) => void;
  /**
   * False until the stored choice has been read.
   *
   * The first render has to match the server's, which cannot know the
   * selection, so consumers that fetch wait for this rather than fetching
   * Poland and then immediately fetching again.
   */
  ready: boolean;
}

const CountryContext = createContext<CountryContextValue>({
  country: DEFAULT_COUNTRY,
  setCountry: () => {},
  ready: false,
});

export function CountryProvider({ children }: { children: React.ReactNode }) {
  const [country, setStored] = useState(DEFAULT_COUNTRY);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(STORAGE_KEY);
      // Anything but three letters is not a federation code, whatever put it
      // there; fall back rather than send it to the API.
      if (saved && /^[A-Z]{3}$/.test(saved)) setStored(saved);
    } catch {
      // Blocked storage costs the reader nothing but the memory of their
      // choice, so it is not worth surfacing.
    }
    setReady(true);
  }, []);

  const setCountry = useCallback((code: string) => {
    setStored(code);
    try {
      window.sessionStorage.setItem(STORAGE_KEY, code);
    } catch {
      // Same again: the selection still applies for this page view.
    }
  }, []);

  return (
    <CountryContext.Provider value={{ country, setCountry, ready }}>
      {children}
    </CountryContext.Provider>
  );
}

export function useCountry(): CountryContextValue {
  return useContext(CountryContext);
}
