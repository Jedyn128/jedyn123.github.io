/* In-memory copy of the database for the dashboard pages.
 * It starts empty and is filled from Supabase by js/store.js after sign-in. */
(function () {
  'use strict';
  window.DB = {
    user: null,
    users: [],
    projects: [],
    facilities: [],
    staff: [],
    devices: [],
    models: [],
    deviceUpdates: [],
    caseHistory: [],
    activity: [],
    audit: [],
    currentProject: null,
  };
})();
