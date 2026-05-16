/**
 * Mount once inside <BrowserRouter>. Fires a pageview beacon on every SPA route
 * change (pathname only — we don't track query string changes; lang toggle would
 * spam the API). See utils/analytics.ts for the wire format.
 */
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { bindLifecycle, trackPageview } from '../utils/analytics';

export default function AnalyticsBeacon() {
  const location = useLocation();
  const initialRef = useRef(true);

  useEffect(() => {
    bindLifecycle();
  }, []);

  useEffect(() => {
    // document.referrer is only meaningful on the very first navigation; subsequent
    // route changes are in-app, so we don't pass ref (server will store '').
    const ref = initialRef.current ? document.referrer : '';
    initialRef.current = false;
    trackPageview(location.pathname, ref);
  }, [location.pathname]);

  return null;
}
